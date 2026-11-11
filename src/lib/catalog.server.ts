import { connectDatabase } from "../../server/db";
import {
  ArtworkModel,
  ArtistProfileModel,
  CollectionModel,
  GalleryProfileModel,
  StoreModel,
  SubscriptionModel,
} from "../../server/models";
import {
  catalogSearchFilter,
  type CatalogSearch,
  findPublicArtwork,
  productsFromPage,
  publicStoreFilter,
  publicArtworkFilter,
  readArtworkPage,
  readStorePage,
} from "../../server/services/catalog";
import { publicArtwork, publicStore } from "../../server/lib/serializers";
import { queryCreatorFromDatabase } from "./creator-db.server";
import { uniqueById } from "./catalog-product";
import type { Creator, EditorialCollection } from "./artdera";
import { isActiveProfessionalSubscription } from "../../server/services/plans";
import { cachedCatalog } from "../../server/lib/catalog-cache";
import { Types } from "mongoose";
import { ApiError } from "../../server/lib/http";

async function queryProduct(slug: string) {
  await connectDatabase();
  const artwork = await findPublicArtwork(slug, false);
  if (!artwork) return null;
  const store = await StoreModel.findById((artwork.storeId as any)?._id ?? artwork.storeId).lean();
  return productsFromPage([publicArtwork(artwork)], store ? [publicStore(store)] : [])[0];
}

async function queryCatalogPage(query?: { cursor?: string; limit?: number } & CatalogSearch) {
  await connectDatabase();
  const page = await readArtworkPage({
    ...query,
    populate: false,
    section: query?.section === "decora" ? "decora" : undefined,
    filter: catalogSearchFilter(query),
  });
  const storeIds = [...new Set(page.items.map((item) => item.storeId))];
  const stores = await StoreModel.find({ _id: { $in: storeIds } }).lean();
  return { ...page, products: productsFromPage(page.items, stores.map(publicStore)) };
}

async function queryProducts(query?: { category?: string; creatorSlug?: string; limit?: number }) {
  if (query?.creatorSlug) return (await loadStoreCatalog(query.creatorSlug))?.works ?? [];
  await connectDatabase();
  const page = await readArtworkPage({
    filter: catalogSearchFilter({ category: query?.category }),
    populate: false,
    limit: query?.limit ?? 60,
  });
  const stores = await StoreModel.find({
    _id: { $in: page.items.map((item) => item.storeId) },
  }).lean();
  return productsFromPage(page.items, stores.map(publicStore));
}

async function queryStoreCatalog(slug: string, cursor?: string) {
  await connectDatabase();
  try {
    const [page, creatorMeta] = await Promise.all([
      readStorePage(slug, cursor),
      cursor ? Promise.resolve(null) : queryCreatorFromDatabase(slug),
    ]);
    return { ...page, creatorMeta, works: productsFromPage(page.artworks, [page.store]) };
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 404)
      return null;
    throw error;
  }
}

async function queryCreators(query?: {
  type?: "artist" | "gallery";
  limit?: number;
  slugs?: string[];
  cursor?: string;
}): Promise<(Creator & { pageCursor: string })[]> {
  await connectDatabase();
  let seek = {};
  if (query?.cursor) {
    try {
      const cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
      const createdAt = new Date(cursor.createdAt);
      if (
        cursor.type !== query.type ||
        !Number.isFinite(createdAt.getTime()) ||
        !/^[a-f0-9]{24}$/.test(cursor.id)
      )
        throw new Error("Invalid cursor");
      seek = {
        $or: [
          { createdAt: { $lt: createdAt } },
          { createdAt, _id: { $lt: new Types.ObjectId(cursor.id) } },
        ],
      };
    } catch {
      throw new ApiError(422, "INVALID_CURSOR", "Refresh the creator directory.");
    }
  }
  const stores = await StoreModel.find({
    ...publicStoreFilter,
    ...(query?.type ? { ownerType: query.type } : {}),
    ...(query?.slugs?.length ? { slug: { $in: query.slugs } } : {}),
    ...seek,
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(query?.limit ?? 1000)
    .lean();
  const owners = stores.map((store) => store.ownerId);
  const [artists, galleries, subscriptions] = await Promise.all([
    ArtistProfileModel.find({ userId: { $in: owners } }).lean(),
    GalleryProfileModel.find({ userId: { $in: owners } }).lean(),
    SubscriptionModel.find({
      userId: { $in: owners },
      planId: "professional",
      status: "active",
      currentPeriodEnd: { $gt: new Date() },
    }).lean(),
  ]);
  const artistMap = new Map(artists.map((item) => [String(item.userId), item]));
  const galleryMap = new Map(galleries.map((item) => [String(item.userId), item]));
  const proMap = new Map(
    subscriptions
      .filter((item) => isActiveProfessionalSubscription(item))
      .map((item) => [String(item.userId), item]),
  );
  return stores.map((store) => {
    const artist = artistMap.get(String(store.ownerId));
    const gallery = galleryMap.get(String(store.ownerId));
    const subscription = proMap.get(String(store.ownerId));
    return {
      pageCursor: Buffer.from(
        JSON.stringify({ type: query?.type, createdAt: store.createdAt, id: String(store._id) }),
      ).toString("base64url"),
      store: publicStore(store),
      slug: store.slug,
      name:
        store.ownerType === "artist"
          ? artist?.displayName || store.name
          : gallery?.galleryName || store.name,
      handle: `@${store.slug}`,
      location: [store.city, store.country].filter(Boolean).join(", "),
      discipline:
        store.ownerType === "gallery"
          ? "Art Gallery"
          : artist?.professionalTitle || artist?.mediums?.[0] || "Visual Art",
      bio:
        artist?.shortBio || artist?.fullBio || gallery?.description || store.shortDescription || "",
      portrait: artist?.profileImageUrl || gallery?.logoUrl || store.logoUrl || "",
      verified: store.verificationStatus === "approved",
      approvedSeller: true,
      accountType: store.ownerType,
      works: [],
      planId: subscription ? "professional" : undefined,
      subscriptionStatus: subscription?.status,
      subscriptionExpiresAt: subscription?.currentPeriodEnd?.toISOString(),
    };
  });
}

async function queryCollectionCatalog() {
  await connectDatabase();
  const rows = await CollectionModel.find({ isPublished: true, isDemo: { $ne: true } })
    .sort({ sortOrder: 1, _id: 1 })
    .lean();
  const items = await ArtworkModel.find({
    ...publicArtworkFilter,
    _id: { $in: rows.flatMap((row) => row.artworkIds) },
  }).lean();
  const stores = await StoreModel.find({ _id: { $in: items.map((item) => item.storeId) } }).lean();
  const products = productsFromPage(items.map(publicArtwork), stores.map(publicStore));
  const byId = new Map(products.map((product) => [product.id, product]));
  const collections: EditorialCollection[] = rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    blurb: row.description || "",
    products: row.artworkIds
      .map((id: unknown) => byId.get(String(id))?.slug)
      .filter((slug: string | undefined): slug is string => Boolean(slug)),
    cover: row.coverImageUrl || "",
  }));
  return { products, collections };
}

async function queryHomeCatalog() {
  const [page, curated] = await Promise.all([
    queryCatalogPage({ limit: 24 }),
    queryCollectionCatalog(),
  ]);
  const products = uniqueById([...page.products, ...curated.products]).filter(
    (product) => product.artwork?.section !== "decora",
  );
  // The homepage uses creators attached to these works and three named
  // spotlights. Do not serialize 1,000 unrelated artist biographies into HTML.
  const slugs = [
    ...new Set([
      ...products.map((product) => product.creatorSlug).filter(Boolean),
      "kausar-bhatti",
      "kamran-qazi-student",
      "abdul-rasheed-studio",
    ]),
  ];
  const creators = await queryCreators({ slugs, limit: 1000 });
  if (!creators.length) creators.push(...(await queryCreators({ limit: 3 })));
  return {
    products,
    creators,
    collections: curated.collections,
  };
}

async function cached<T>(key: string, query: () => Promise<T>) {
  await connectDatabase();
  return cachedCatalog(key, query);
}

export function loadProduct(slug: string) {
  return cached(`product:${slug}`, () => queryProduct(slug));
}
export function loadProductDetail(slug: string) {
  return cached(`detail:${slug}`, async () => {
    const productData = await queryProduct(slug);
    const creatorData = productData?.creatorSlug
      ? await queryCreatorFromDatabase(productData.creatorSlug)
      : null;
    return { productData, creatorData };
  });
}
export function loadCatalogPage(query?: Parameters<typeof queryCatalogPage>[0]) {
  return cached(`page:${JSON.stringify(query ?? {})}`, () => queryCatalogPage(query));
}
export function loadProducts(query?: Parameters<typeof queryProducts>[0]) {
  return cached(`products:${JSON.stringify(query ?? {})}`, () => queryProducts(query));
}
export function loadStoreCatalog(slug: string, cursor?: string) {
  return cached(`store:${slug}:${cursor ?? ""}`, () => queryStoreCatalog(slug, cursor));
}
export function loadCreators(query?: Parameters<typeof queryCreators>[0]) {
  return cached(`creators:${JSON.stringify(query ?? {})}`, () => queryCreators(query));
}
export async function loadCreatorPage(query: { type: "artist" | "gallery"; cursor?: string }) {
  const rows = await loadCreators({ ...query, limit: 37 });
  const items = rows.slice(0, 36);
  return { items, nextCursor: rows.length > 36 ? items.at(-1)!.pageCursor : null };
}
export function loadCollectionCatalog() {
  return cached("collections", queryCollectionCatalog);
}
export function loadHomeCatalog() {
  return cached("home", queryHomeCatalog);
}
