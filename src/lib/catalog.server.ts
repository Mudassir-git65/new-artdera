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

export async function loadProduct(slug: string) {
  await connectDatabase();
  const artwork = await findPublicArtwork(slug);
  if (!artwork) return null;
  const store = await StoreModel.findById((artwork.storeId as any)?._id ?? artwork.storeId).lean();
  return productsFromPage([publicArtwork(artwork)], store ? [publicStore(store)] : [])[0];
}

export async function loadCatalogPage(query?: { cursor?: string; limit?: number } & CatalogSearch) {
  await connectDatabase();
  const page = await readArtworkPage({ ...query, filter: catalogSearchFilter(query) });
  const storeIds = [...new Set(page.items.map((item) => item.storeId))];
  const stores = await StoreModel.find({ _id: { $in: storeIds } }).lean();
  return { ...page, products: productsFromPage(page.items, stores.map(publicStore)) };
}

export async function loadProducts(query?: {
  category?: string;
  creatorSlug?: string;
  limit?: number;
}) {
  if (query?.creatorSlug) return (await loadStoreCatalog(query.creatorSlug))?.works ?? [];
  await connectDatabase();
  const page = await readArtworkPage({
    filter: catalogSearchFilter({ category: query?.category }),
    limit: query?.limit ?? 60,
  });
  const stores = await StoreModel.find({
    _id: { $in: page.items.map((item) => item.storeId) },
  }).lean();
  return productsFromPage(page.items, stores.map(publicStore));
}

export async function loadStoreCatalog(slug: string, cursor?: string) {
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

export async function loadCreators(query?: {
  type?: "artist" | "gallery";
  limit?: number;
}): Promise<Creator[]> {
  await connectDatabase();
  const stores = await StoreModel.find({
    ...publicStoreFilter,
    ...(query?.type ? { ownerType: query.type } : {}),
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

export async function loadCollectionCatalog() {
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

export async function loadHomeCatalog() {
  const [page, creators, curated] = await Promise.all([
    loadCatalogPage({ limit: 24 }),
    loadCreators(),
    loadCollectionCatalog(),
  ]);
  return {
    products: uniqueById([...page.products, ...curated.products]),
    creators,
    collections: curated.collections,
  };
}
