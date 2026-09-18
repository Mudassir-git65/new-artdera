import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ArtworkModel, PromotionModel, StoreModel } from "../models";
import { ApiError, asyncRoute, limitQuery, ok, pageQuery } from "../lib/http";
import { requireAuth, requireRole, requireVerified } from "../middleware/auth";
import { publicArtwork } from "../lib/serializers";
import { releaseListingSlot, requirePermission, reserveListingSlot } from "../services/plans";
import { audit } from "../services/audit";
import { notify } from "../services/notifications";
import { mergeSponsoredResults } from "../services/sponsored";
import { sanitizeText } from "../lib/security";
import { trackArtworkView } from "../services/view-tracker";

export const artworksRouter = Router();
const legacyStatuses: Record<string, string> = {
  Draft: "draft",
  "Pending Review": "pending_review",
  Published: "published",
  Rejected: "rejected",
  Sold: "sold",
  Reserved: "reserved",
  Archived: "archived",
};
const activeStatuses = new Set(["pending_review", "published", "reserved"]);
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const artworkInput = z
  .object({
    storeId: z.string().min(1).optional(),
    title: z.string().trim().min(2).max(180),
    slug: slug.optional(),
    description: z.string().trim().max(8000).default(""),
    story: z
      .union([
        z.string().trim().max(2000),
        z.object({ text: z.string().trim().max(2000).default("") }),
      ])
      .optional(),
    category: z.string().trim().min(1).max(80),
    medium: z.string().trim().min(1).max(80),
    style: z.string().trim().max(80).default(""),
    subject: z.string().trim().max(100).default(""),
    themes: z.array(z.string().trim().max(80)).max(30).default([]),
    colours: z.array(z.string().trim().max(50)).max(20).default([]),
    yearCreated: z.number().int().min(1000).max(2200).optional(),
    year: z.number().int().min(1000).max(2200).optional(),
    artworkType: z.enum(["original", "print", "limited_edition"]).optional(),
    kind: z.enum(["Original", "Print", "Limited Edition"]).optional(),
    editionType: z.enum(["open", "limited", "unique"]).nullable().optional(),
    editionNumber: z.number().int().positive().optional(),
    editionTotal: z.number().int().positive().optional(),
    price: z.number().nonnegative().max(1_000_000_000),
    discountPrice: z.number().nonnegative().max(1_000_000_000).optional(),
    width: z.number().nonnegative().optional(),
    height: z.number().nonnegative().optional(),
    depth: z.number().nonnegative().optional(),
    dimensions: z.string().trim().max(120).optional(),
    measurementUnit: z.enum(["cm", "in"]).default("cm"),
    weight: z.number().nonnegative().optional(),
    weightKg: z.number().nonnegative().optional(),
    weightUnit: z.enum(["kg", "lb"]).default("kg"),
    orientation: z
      .enum(["portrait", "landscape", "square", "Portrait", "Landscape", "Square"])
      .default("portrait"),
    isFramed: z.boolean().optional(),
    framed: z.boolean().optional(),
    hasGlass: z.boolean().default(false),
    isFragile: z.boolean().default(false),
    quantity: z.number().int().nonnegative().max(10_000).default(1),
    images: z
      .array(
        z
          .object({
            id: z.string().optional(),
            url: z.string().min(1).max(1500),
            alt: z.string().max(180).default(""),
            isPrimary: z.boolean().default(false),
          })
          .strip(),
      )
      .max(20)
      .default([]),
    videoUrl: z.string().max(1500).optional(),
    certificateAvailable: z.boolean().optional(),
    certificate: z.boolean().optional(),
    pickupCity: z.string().trim().max(100).optional(),
    domesticShipping: z.boolean().default(true),
    internationalShipping: z.boolean().default(false),
    shipsFromCountry: z.string().trim().max(80).default("Pakistan"),
    shipsFromCity: z.string().trim().max(100).optional(),
    packagedWeight: z.number().nonnegative().optional(),
    packageDimensions: z
      .object({
        width: z.number().nonnegative().optional(),
        height: z.number().nonnegative().optional(),
        length: z.number().nonnegative().optional(),
        unit: z.enum(["cm", "in"]).default("cm"),
      })
      .optional(),
    canFramedArtworkBeShippedInternationally: z.boolean().default(false),
    requiresWoodenCratePackaging: z.boolean().default(false),
    internationalShippingNotes: z.string().trim().max(1000).optional(),
    processingTime: z.string().trim().max(80).optional(),
    tags: z.array(z.string().trim().max(60)).max(40).default([]),
    status: z
      .enum([
        "draft",
        "pending_review",
        "published",
        "rejected",
        "reserved",
        "sold",
        "archived",
        "Draft",
        "Pending Review",
        "Published",
        "Rejected",
        "Reserved",
        "Sold",
        "Archived",
      ])
      .default("draft"),
    customOrders: z.boolean().default(false),
  })
  .strict();

function normalizeArtwork(input: z.infer<typeof artworkInput>) {
  const status = legacyStatuses[input.status] ?? input.status;
  const artworkType =
    input.artworkType ??
    (input.kind === "Print"
      ? "print"
      : input.kind === "Limited Edition"
        ? "limited_edition"
        : "original");
  const dimensions = input.dimensions?.match(/([\d.]+)\D+([\d.]+)(?:\D+([\d.]+))?/);
  const storyText = typeof input.story === "string" ? input.story : (input.story?.text ?? "");
  const sanitizedStoryText = sanitizeText(storyText, 2000);
  return {
    title: sanitizeText(input.title, 180),
    slug: input.slug,
    description: sanitizeText(input.description, 8000),
    story: sanitizedStoryText ? { text: sanitizedStoryText, updatedAt: new Date() } : { text: "" },
    category: sanitizeText(input.category, 80),
    medium: sanitizeText(input.medium, 80),
    style: sanitizeText(input.style, 80),
    subject: sanitizeText(input.subject, 100),
    themes: input.themes,
    colours: input.colours,
    yearCreated: input.yearCreated ?? input.year,
    artworkType,
    editionType: input.editionType,
    editionNumber: input.editionNumber,
    editionTotal: input.editionTotal,
    price: input.price,
    discountPrice: input.discountPrice,
    width: input.width ?? (dimensions ? Number(dimensions[1]) : undefined),
    height: input.height ?? (dimensions ? Number(dimensions[2]) : undefined),
    depth: input.depth ?? (dimensions?.[3] ? Number(dimensions[3]) : undefined),
    measurementUnit: input.measurementUnit,
    weight: input.weight ?? input.weightKg,
    weightUnit: input.weightUnit,
    orientation: input.orientation.toLowerCase(),
    isFramed: input.isFramed ?? input.framed ?? false,
    hasGlass: input.hasGlass,
    isFragile: input.isFragile,
    quantity: input.quantity,
    images: input.images.map((image) => ({
      url: image.url,
      alt: sanitizeText(image.alt, 180),
      isPrimary: image.isPrimary,
    })),
    videoUrl: input.videoUrl,
    certificateAvailable: input.certificateAvailable ?? input.certificate ?? false,
    pickupCity: input.pickupCity,
    domesticShipping: input.domesticShipping,
    internationalShipping: input.internationalShipping,
    shipsFromCountry: input.shipsFromCountry,
    shipsFromCity: input.shipsFromCity,
    packagedWeight: input.packagedWeight,
    packageDimensions: input.packageDimensions,
    canFramedArtworkBeShippedInternationally: input.canFramedArtworkBeShippedInternationally,
    requiresWoodenCratePackaging: input.requiresWoodenCratePackaging,
    internationalShippingNotes: input.internationalShippingNotes,
    processingTime: input.processingTime,
    tags: input.tags.map((tag) => sanitizeText(tag, 60)),
    status,
    moderationStatus:
      status === "pending_review"
        ? "pending"
        : status === "published"
          ? "approved"
          : "not_submitted",
    customOrders: input.customOrders,
  };
}

artworksRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const page = pageQuery(req.query.page);
    const limit = limitQuery(req.query.limit, 24, 60);
    const filter: Record<string, any> = { status: "published", moderationStatus: "approved" };
    const text = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
    if (text) filter.$text = { $search: text };
    for (const field of ["category", "medium", "style", "orientation", "pickupCity"] as const) {
      if (typeof req.query[field] === "string") filter[field] = req.query[field];
    }
    if (typeof req.query.storeId === "string") filter.storeId = req.query.storeId;
    if (typeof req.query.artistId === "string") filter.artistId = req.query.artistId;
    if (typeof req.query.galleryId === "string") filter.galleryId = req.query.galleryId;
    if (req.query.framed === "true") filter.isFramed = true;
    if (req.query.framed === "false") filter.isFramed = false;
    if (req.query.internationalShipping === "true") filter.internationalShipping = true;
    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      filter.price = {};
      if (Number.isFinite(minPrice)) filter.price.$gte = Math.max(0, minPrice);
      if (Number.isFinite(maxPrice)) filter.price.$lte = Math.max(0, maxPrice);
    }
    if (req.query.verified === "true") {
      const stores = await StoreModel.find({ verificationStatus: "approved", isPublished: true })
        .select("_id")
        .lean();
      filter.storeId = { $in: stores.map((store) => store._id) };
    }
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      popular: { views: -1, wishlistCount: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
    };
    const sort = sortMap[String(req.query.sort)] ?? sortMap.newest;
    const now = new Date();
    const activePromotions = await PromotionModel.find({
      status: "active",
      startAt: { $lte: now },
      endAt: { $gt: now },
      artworkId: { $exists: true },
    })
      .sort({ startAt: 1, _id: 1 })
      .select("artworkId")
      .lean();
    const sponsoredIds = activePromotions.map((promotion) => promotion.artworkId);
    const organicFilter = { ...filter, _id: { $nin: sponsoredIds } };
    const skipOrganic = (page - 1) * Math.ceil(limit * 0.8);
    
    // Use a single $facet aggregation to fetch both organic results and total count 
    // in one database round-trip, saving ~50ms of network latency per request.
    const [organicResult] = await ArtworkModel.aggregate([
      { $match: organicFilter },
      {
        $facet: {
          items: [
            { $sort: sort },
            { $skip: skipOrganic },
            { $limit: limit },
            {
              $project: {
                title: 1,
                slug: 1,
                price: 1,
                medium: 1,
                artworkType: 1,
                width: 1,
                height: 1,
                measurementUnit: 1,
                yearCreated: 1,
                isFramed: 1,
                colours: 1,
                images: 1,
                isSponsored: 1,
                storeId: 1,
                artistId: 1,
                category: 1,
                status: 1,
                moderationStatus: 1,
                createdAt: 1,
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "artistId",
                foreignField: "_id",
                as: "artistDetails",
              },
            },
            {
              $lookup: {
                from: "stores",
                localField: "storeId",
                foreignField: "_id",
                as: "storeDetails",
              },
            },
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ]);
    
    // Process organic lookup results to match Mongoose populate format
    const organic = (organicResult?.items || []).map((item: any) => ({
      ...item,
      artistId: item.artistDetails?.[0] ? { _id: item.artistId, fullName: item.artistDetails[0].fullName } : item.artistId,
      storeId: item.storeDetails?.[0] ? { _id: item.storeId, name: item.storeDetails[0].name } : item.storeId,
    }));

    const total = organicResult?.totalCount?.[0]?.count || 0;

    const sponsored = sponsoredIds.length
      ? await ArtworkModel.find({ ...filter, _id: { $in: sponsoredIds } })
          .sort({ _id: 1 })
          .limit(Math.ceil(limit / 5))
          .populate("artistId", "fullName")
          .populate("storeId", "name")
          .lean()
      : [];
    const items = mergeSponsoredResults(organic, sponsored, limit).map(publicArtwork);
    return ok(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
  }),
);

artworksRouter.get(
  "/mine",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const stores = await StoreModel.find({ ownerId: req.auth!.user._id }).select("_id").lean();
    const items = await ArtworkModel.find({ storeId: { $in: stores.map((store) => store._id) } })
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, items.map(publicArtwork));
  }),
);

artworksRouter.get(
  "/slug/:slug",
  asyncRoute(async (req, res) => {
    const item = await ArtworkModel.findOne({
      slug: slug.parse(req.params.slug),
      status: "published",
      moderationStatus: "approved",
    })
      .populate("artistId", "fullName")
      .populate("storeId", "name slug verificationStatus")
      .lean();
    if (!item) throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");
    void trackArtworkView(item, req);
    return ok(res, publicArtwork(item));
  }),
);

artworksRouter.post(
  "/",
  requireVerified,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const input = artworkInput.parse(req.body);
    const store = await StoreModel.findOne({
      ...(input.storeId ? { _id: input.storeId } : {}),
      ownerId: req.auth!.user._id,
    });
    if (!store)
      throw new ApiError(404, "STORE_NOT_FOUND", "Create your store before adding artwork");
    const normalized = normalizeArtwork(input);
    if (normalized.internationalShipping)
      await requirePermission(req.auth!.user._id, "international-tools");
    if (activeStatuses.has(normalized.status)) await reserveListingSlot(req.auth!.user._id);
    try {
      const item = await ArtworkModel.create({
        ...normalized,
        storeId: store._id,
        artistId: req.auth!.user.role === "artist" ? req.auth!.user._id : undefined,
        slug:
          normalized.slug ??
          `${
            input.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")
              .slice(0, 70) || "artwork"
          }-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`,
      });
      if (normalized.status === "pending_review")
        await notify(
          req.auth!.user._id,
          "artwork_submitted",
          "Artwork submitted",
          `${item.title} is awaiting moderation.`,
          "/artist/dashboard/artworks",
        );
      await audit(req, "artwork.created", "Artwork", item._id, undefined, item.toObject());
      return ok(res, publicArtwork(item.toObject()), "Artwork created", 201);
    } catch (error) {
      if (activeStatuses.has(normalized.status)) await releaseListingSlot(req.auth!.user._id);
      throw error;
    }
  }),
);

artworksRouter.patch(
  "/bulk",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        ids: z.array(z.string()).min(1).max(200),
        action: z.enum(["submit", "archive", "restore", "delete"]),
      })
      .strict()
      .parse(req.body);
    const stores = await StoreModel.find({ ownerId: req.auth!.user._id }).select("_id").lean();
    const items = await ArtworkModel.find({
      _id: { $in: input.ids },
      storeId: { $in: stores.map((store) => store._id) },
    });
    if (items.length !== new Set(input.ids).size)
      throw new ApiError(403, "FORBIDDEN", "One or more artworks cannot be changed");
    if (input.action === "delete") {
      if (items.some((item) => !["draft", "archived", "rejected"].includes(item.status)))
        throw new ApiError(
          409,
          "ARTWORK_DELETE_NOT_ALLOWED",
          "Only drafts, rejected, or archived artworks can be deleted",
        );
      await ArtworkModel.deleteMany({ _id: { $in: items.map((item) => item._id) } });
      await audit(req, "artwork.bulk_deleted", "Artwork", undefined, undefined, { ids: input.ids });
      return ok(res, { ids: input.ids }, "Artworks deleted");
    }
    for (const item of items) {
      const wasActive = activeStatuses.has(item.status);
      const next =
        input.action === "submit"
          ? "pending_review"
          : input.action === "archive"
            ? "archived"
            : "draft";
      const willBeActive = activeStatuses.has(next);
      if (!wasActive && willBeActive) await reserveListingSlot(req.auth!.user._id);
      if (wasActive && !willBeActive) await releaseListingSlot(req.auth!.user._id);
      item.status = next;
      item.moderationStatus = next === "pending_review" ? "pending" : "not_submitted";
      await item.save();
    }
    return ok(
      res,
      items.map((item) => publicArtwork(item.toObject())),
      "Artworks updated",
    );
  }),
);

artworksRouter.patch(
  "/:id",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const input = artworkInput.partial().parse(req.body);
    const stores = await StoreModel.find({ ownerId: req.auth!.user._id }).select("_id").lean();
    const item = await ArtworkModel.findOne({
      _id: req.params.id,
      storeId: { $in: stores.map((store) => store._id) },
    });
    if (!item) throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");
    const before = item.toObject();
    // Build the patch base from the editable model fields only. Public serializers
    // intentionally contain computed/read-only properties and must never be fed
    // back into a strict write schema.
    const current = {
      storeId: String(item.storeId),
      title: item.title,
      slug: item.slug,
      description: item.description,
      story: item.story?.text ? { text: item.story.text } : undefined,
      category: item.category,
      medium: item.medium,
      style: item.style ?? "",
      subject: item.subject ?? "",
      themes: item.themes ?? [],
      colours: item.colours ?? [],
      yearCreated: item.yearCreated,
      artworkType: item.artworkType,
      editionType: item.editionType,
      editionNumber: item.editionNumber,
      editionTotal: item.editionTotal,
      price: item.price,
      discountPrice: item.discountPrice,
      width: item.width,
      height: item.height,
      depth: item.depth,
      measurementUnit: item.measurementUnit,
      weight: item.weight,
      weightUnit: item.weightUnit,
      orientation: item.orientation,
      isFramed: item.isFramed,
      hasGlass: item.hasGlass,
      isFragile: item.isFragile,
      quantity: item.quantity,
      images: item.images.map((image: any) => ({
        id: String(image._id),
        url: image.url,
        alt: image.alt ?? "",
        isPrimary: image.isPrimary ?? false,
      })),
      videoUrl: item.videoUrl,
      certificateAvailable: item.certificateAvailable,
      pickupCity: item.pickupCity,
      domesticShipping: item.domesticShipping,
      internationalShipping: item.internationalShipping,
      shipsFromCountry: item.shipsFromCountry,
      shipsFromCity: item.shipsFromCity,
      packagedWeight: item.packagedWeight,
      packageDimensions: item.packageDimensions,
      canFramedArtworkBeShippedInternationally: item.canFramedArtworkBeShippedInternationally,
      requiresWoodenCratePackaging: item.requiresWoodenCratePackaging,
      internationalShippingNotes: item.internationalShippingNotes,
      processingTime: item.processingTime,
      tags: item.tags ?? [],
      status: item.status,
      customOrders: item.customOrders,
    };
    const merged = artworkInput.parse({ ...current, ...req.body });
    const normalized = normalizeArtwork(merged);
    if (normalized.internationalShipping)
      await requirePermission(req.auth!.user._id, "international-tools");
    const wasActive = activeStatuses.has(item.status);
    const willBeActive = activeStatuses.has(normalized.status);
    if (!wasActive && willBeActive) await reserveListingSlot(req.auth!.user._id);
    if (wasActive && !willBeActive) await releaseListingSlot(req.auth!.user._id);
    Object.assign(item, normalized);
    await item.save();
    await audit(req, "artwork.updated", "Artwork", item._id, before, item.toObject());
    return ok(res, publicArtwork(item.toObject()), "Artwork updated");
  }),
);

artworksRouter.delete(
  "/:id",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const stores = await StoreModel.find({ ownerId: req.auth!.user._id }).select("_id").lean();
    const item = await ArtworkModel.findOne({
      _id: req.params.id,
      storeId: { $in: stores.map((store) => store._id) },
    });
    if (!item) throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");
    if (!["draft", "archived", "rejected"].includes(item.status))
      throw new ApiError(
        409,
        "ARTWORK_DELETE_NOT_ALLOWED",
        "Archive this artwork before deleting it",
      );
    await item.deleteOne();
    await audit(req, "artwork.deleted", "Artwork", item._id, item.toObject());
    return ok(res, { id: String(item._id) }, "Artwork deleted");
  }),
);
