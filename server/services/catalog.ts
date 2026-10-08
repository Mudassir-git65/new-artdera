import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { ArtworkModel, PromotionModel, StoreModel } from "../models";
import { ApiError } from "../lib/http";
import { publicArtwork, publicStore } from "../lib/serializers";
import { catalogProduct } from "../../src/lib/catalog-product";
import type { Artwork, Store } from "../../src/marketplace/types";

// Listing quotas are enforced on writes. Reads never truncate by subscription.
export const publicArtworkFilter = {
  status: "published",
  moderationStatus: "approved",
  isDemo: { $ne: true },
};
export const publicStoreFilter = { isPublished: true, status: "active", isDemo: { $ne: true } };
export const catalogSorts: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1, _id: -1 },
  popular: { views: -1, wishlistCount: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
};

export function resolveArtworkIdentity(value: string) {
  const clean = value.trim().toLowerCase();
  const match = clean.match(/^([a-f0-9]{24})(?:-|$)/);
  return match
    ? { _id: new mongoose.Types.ObjectId(match[1]) }
    : { $or: [{ slug: clean }, { slugAliases: clean }] };
}

export async function findPublicStore(value: string) {
  return StoreModel.findOne({
    ...publicStoreFilter,
    $or: [{ slug: value.toLowerCase() }, { slugAliases: value.toLowerCase() }],
  }).lean();
}

export async function findPublicArtwork(value: string) {
  return ArtworkModel.findOne({ ...publicArtworkFilter, ...resolveArtworkIdentity(value) })
    .populate("artistId", "fullName")
    .populate("storeId", "name slug verificationStatus")
    .lean();
}

export interface CatalogQuery {
  filter?: Record<string, any>;
  store?: Record<string, any>;
  sort?: string;
  limit?: number;
  page?: number;
  cursor?: string;
}

export interface CatalogSearch {
  category?: string;
  q?: string;
  kind?: string;
  color?: string;
  room?: string;
  framed?: string;
  min?: number;
  max?: number;
  sort?: string;
}

export function catalogSearchFilter(query: CatalogSearch = {}) {
  const filter: Record<string, any> = {};
  const escape = (text: string) => text.slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (query.category) {
    const category = escape(query.category.replaceAll("-", " ").replace(/s$/, ""));
    filter.$or = [{ category: new RegExp(category, "i") }, { medium: new RegExp(category, "i") }];
    if (/painting/i.test(query.category)) filter.$or.push({ medium: /oil|acrylic|canvas/i });
    if (/original/i.test(query.category)) filter.$or.push({ artworkType: "original" });
    if (/print/i.test(query.category))
      filter.$or.push({ artworkType: { $in: ["print", "limited_edition"] } });
  }
  if (query.q?.trim()) {
    const pattern = new RegExp(escape(query.q.trim()), "i");
    filter.$and = [
      {
        $or: ["title", "description", "medium", "category", "tags", "style", "subject"].map(
          (field) => ({ [field]: pattern }),
        ),
      },
    ];
  }
  if (query.kind) {
    const kinds: Record<string, string> = {
      Original: "original",
      "Limited Edition": "limited_edition",
      "Open Edition": "print",
    };
    filter.artworkType = {
      $in: query.kind
        .split(",")
        .map((kind) => kinds[kind])
        .filter(Boolean),
    };
  }
  if (query.color) filter.colours = query.color;
  if (query.room) filter.themes = new RegExp(`^${escape(query.room.replaceAll("-", " "))}$`, "i");
  if (query.framed === "true") filter.isFramed = true;
  if (Number.isFinite(query.min) || Number.isFinite(query.max)) {
    filter.price = {
      ...(Number.isFinite(query.min) ? { $gte: query.min } : {}),
      ...(Number.isFinite(query.max) ? { $lte: query.max } : {}),
    };
  }
  return filter;
}

export async function readArtworkPage(query: CatalogQuery = {}) {
  const filter = { ...query.filter, ...publicArtworkFilter };
  const sortName = query.sort && catalogSorts[query.sort] ? query.sort : "newest";
  const sort = catalogSorts[sortName];
  const limit = Math.min(Math.max(query.limit ?? 24, 1), 100);
  const page = query.page ?? 1;
  const scope = createHash("sha256")
    .update(
      JSON.stringify({ filter, sortName }, (_key, value) =>
        value instanceof RegExp ? { regex: value.source, flags: value.flags } : value,
      ),
    )
    .digest("hex");
  let seek: Record<string, any> = {};
  if (query.cursor) {
    try {
      const cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
      const fields = Object.entries(sort);
      if (
        cursor.scope !== scope ||
        !Array.isArray(cursor.values) ||
        cursor.values.length !== fields.length
      )
        throw new Error("Invalid cursor scope");
      const values = fields.map(([field], index) => {
        const value = cursor.values[index];
        if (field === "_id") {
          if (typeof value !== "string" || !/^[a-f0-9]{24}$/.test(value))
            throw new Error("Invalid ID");
          return new mongoose.Types.ObjectId(value);
        }
        if (field === "createdAt") {
          const date = new Date(value);
          if (!Number.isFinite(date.getTime())) throw new Error("Invalid date");
          return date;
        }
        if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid number");
        return value;
      });
      seek = {
        $or: fields.map(([field, direction], index) => ({
          ...Object.fromEntries(fields.slice(0, index).map(([key], i) => [key, values[i]])),
          [field]: { [direction === 1 ? "$gt" : "$lt"]: values[index] },
        })),
      };
    } catch {
      throw new ApiError(
        422,
        "INVALID_CURSOR",
        "The artwork cursor is invalid. Refresh the listing.",
      );
    }
  }
  // find() casts ownership IDs; aggregate($match) did not. Sorting before a
  // facet also avoids an unindexed sort of the full catalog inside the facet.
  const listing = ArtworkModel.find({ $and: [filter, seek] })
    .sort(sort)
    .skip(query.cursor ? 0 : (page - 1) * limit)
    .limit(limit + 1);
  if (!query.store) listing.populate("artistId", "fullName").populate("storeId", "name slug");
  const now = new Date();
  const promotionFilter = {
    status: { $in: ["active", "scheduled"] },
    startAt: { $lte: now },
    endAt: { $gt: now },
  };
  const [rows, total, storePromotions] = await Promise.all([
    listing.lean(),
    ArtworkModel.countDocuments(filter),
    query.store
      ? PromotionModel.find({ ...promotionFilter, storeId: query.store._id })
          .select("artworkId")
          .lean()
      : Promise.resolve(null),
  ]);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor =
    hasMore && last
      ? Buffer.from(
          JSON.stringify({
            scope,
            values: Object.keys(sort).map((field) => (last as Record<string, any>)[field] ?? 0),
          }),
        ).toString("base64url")
      : null;
  // Select each ID once BEFORE placement. Promotions can reorder this page,
  // never remove catalog items or repeat the same promotion on every page.
  const promotions =
    storePromotions ??
    (await PromotionModel.find({
      ...promotionFilter,
      artworkId: { $in: items.map((item) => item._id) },
    })
      .select("artworkId")
      .lean());
  const promoted = new Set(promotions.map((promotion) => String(promotion.artworkId)));
  const boosted = items
    .filter((item) => promoted.has(String(item._id)))
    .slice(0, Math.floor(items.length / 5));
  const boostedIds = new Set(boosted.map((item) => String(item._id)));
  const ordinary = items.filter((item) => !boostedIds.has(String(item._id)));
  const ordered = [...ordinary];
  boosted.forEach((item, index) => ordered.splice(index * 5 + 4, 0, item));
  return {
    items: ordered.map((item) =>
      publicArtwork({
        ...item,
        storeId: query.store ?? item.storeId,
        isSponsored: boostedIds.has(String(item._id)),
      }),
    ),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    hasMore,
    nextCursor,
  };
}

export async function readStorePage(slug: string, cursor?: string) {
  const store = await findPublicStore(slug);
  if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found");
  const page = await readArtworkPage({ filter: { storeId: store._id }, store, limit: 60, cursor });
  return {
    store: publicStore(store),
    artworks: page.items,
    total: page.total,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}

export function productsFromPage(
  items: ReturnType<typeof publicArtwork>[],
  stores: ReturnType<typeof publicStore>[],
) {
  const byId = new Map(stores.map((store) => [store.id, store]));
  return items.map((item) =>
    catalogProduct(item as Artwork, byId.get(item.storeId) as Store | undefined),
  );
}
