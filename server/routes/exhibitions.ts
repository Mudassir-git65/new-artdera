import mongoose from "mongoose";
import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import {
  ArtworkModel,
  ExhibitionModel,
  ExhibitionRegistrationModel,
  ExhibitionLaunchLeadModel,
  NewsletterSubscriptionModel,
  ListingQuotaModel,
  OrderModel,
  StoreModel,
  SubscriptionModel,
  SystemSettingModel,
} from "../models";
import { ApiError, asyncRoute, ok } from "../lib/http";
import { normalizeEmail, sanitizeText } from "../lib/security";
import { objectId, requireRole } from "../middleware/auth";
import { audit } from "../services/audit";
import { publicStoreFilter } from "../services/catalog";
import {
  exhibitionArtworkFilter,
  exhibitionDetail,
  readExhibition,
  readExhibitionLanding,
  serializeOnlineExhibition,
  visibleExhibitionFilter,
} from "../services/exhibitions";
import { exhibitionPhase } from "../../src/marketplace/exhibition-types";
import {
  EXHIBITION_LAUNCH_SETTING,
  EXHIBITION_LAUNCH_SLUG,
} from "../../src/marketplace/exhibition-launch";
import { readExhibitionLaunch, readLaunchSettings } from "../services/exhibition-launch";

export const exhibitionsRouter = Router();
export const adminExhibitionsRouter = Router();
adminExhibitionsRouter.use(requireRole("admin"));

const id = z.string().regex(/^[a-f0-9]{24}$/i, "Choose a valid marketplace record");
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => sanitizeText(value, max));
const asset = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (value) =>
      !value ||
      /^https:\/\//i.test(value) ||
      /^\/(?:images\/|api\/uploads\/|uploads\/)/.test(value),
    "Use an HTTPS image URL or an ArtDera upload",
  )
  .default("");
const secureUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (value) =>
      !value ||
      (() => {
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "Use a complete HTTPS URL",
  )
  .default("");
const timezone = z
  .string()
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA time zone")
  .default("Asia/Karachi");
const date = z.string().datetime({ offset: true });
const videoAsset = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (value) =>
      !value ||
      /^https:\/\//i.test(value) ||
      /^\/(?:hero\.mp4$|videos\/|api\/uploads\/|uploads\/)/.test(value),
    "Use an HTTPS video URL or an ArtDera video upload",
  );
const launchSettingsInput = z
  .object({
    exhibitionSlug: z
      .string()
      .trim()
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    heroVideoUrl: videoAsset,
    trailerVideoUrl: videoAsset,
    trailerPosterUrl: asset,
    advisorWhatsapp: z
      .string()
      .trim()
      .regex(/^(?:[1-9]\d{7,14})?$/, "Use 8–15 digits including country code, without +"),
  })
  .strict();

exhibitionsRouter.post(
  "/launch/registrations",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 12,
    keyGenerator: (req) => (req.ip ? ipKeyGenerator(req.ip) : "unknown-client"),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Please wait a few minutes before submitting again.",
      },
    },
  }),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        kind: z.enum(["early-access", "notify", "preview", "enquiry"]),
        name: text(120).default(""),
        email: z.string().trim().email().max(254),
        country: text(100).default(""),
        message: text(2000).default(""),
        consent: z.literal(true),
        artworkId: id.optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        if (["preview", "enquiry"].includes(value.kind) && value.name.length < 2)
          ctx.addIssue({ code: "custom", message: "Please enter your full name", path: ["name"] });
        if (value.kind === "enquiry" && !value.artworkId)
          ctx.addIssue({
            code: "custom",
            message: "Choose an artwork to enquire about",
            path: ["artworkId"],
          });
      })
      .parse(req.body);
    if (input.kind === "preview" || input.kind === "enquiry") {
      const launch = await readExhibitionLaunch();
      if (input.kind === "preview" && !launch.detail.exhibition.previewEnabled)
        throw new ApiError(409, "PREVIEW_CLOSED", "Private preview requests are currently closed.");
      if (
        input.kind === "enquiry" &&
        !launch.detail.artworks.some((work) => work.id === input.artworkId)
      )
        throw new ApiError(
          422,
          "INVALID_ARTWORK",
          "This artwork is no longer part of the preview.",
        );
    }
    const emailNormalized = normalizeEmail(input.email);
    await ExhibitionLaunchLeadModel.findOneAndUpdate(
      {
        campaign: EXHIBITION_LAUNCH_SLUG,
        kind: input.kind,
        emailNormalized,
        artworkId: input.kind === "enquiry" ? input.artworkId : null,
      },
      {
        $set: {
          name: input.name,
          country: input.country,
          message: input.message,
          consentAt: new Date(),
        },
      },
      { upsert: true, runValidators: true },
    );
    if (["early-access", "notify"].includes(input.kind))
      await NewsletterSubscriptionModel.updateOne(
        { emailNormalized },
        {
          $set: {
            email: emailNormalized,
            emailNormalized,
            source: `exhibition-2026-${input.kind}`,
            status: "subscribed",
            subscribedAt: new Date(),
          },
          $unset: { unsubscribedAt: 1 },
        },
        { upsert: true, runValidators: true },
      );
    return ok(res, { registered: true }, "Your exhibition request has been saved", 201);
  }),
);

adminExhibitionsRouter.get(
  "/launch-settings",
  asyncRoute(async (_req, res) => ok(res, await readLaunchSettings())),
);
adminExhibitionsRouter.patch(
  "/launch-settings",
  asyncRoute(async (req, res) => {
    const input = launchSettingsInput.parse(req.body);
    const setting = await SystemSettingModel.findOneAndUpdate(
      { key: EXHIBITION_LAUNCH_SETTING },
      { $set: { value: input, isPublic: false, updatedBy: req.auth!.user._id } },
      { upsert: true, runValidators: true, returnDocument: "after" },
    );
    await audit(
      req,
      "admin.exhibition_launch_settings_updated",
      "SystemSetting",
      setting!._id,
      undefined,
      input,
    );
    return ok(res, input, "Exhibition launch settings saved");
  }),
);
adminExhibitionsRouter.get(
  "/launch-registrations",
  asyncRoute(async (_req, res) => {
    const filter = { campaign: EXHIBITION_LAUNCH_SLUG };
    const [items, total] = await Promise.all([
      ExhibitionLaunchLeadModel.find(filter)
        .populate("artworkId", "title")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
      ExhibitionLaunchLeadModel.countDocuments(filter),
    ]);
    return ok(res, {
      total,
      items: items.map((item: any) => ({
        id: String(item._id),
        kind: item.kind,
        name: item.name,
        email: item.emailNormalized,
        country: item.country,
        message: item.message,
        artworkTitle: item.artworkId?.title ?? "",
        createdAt: item.createdAt.toISOString(),
      })),
    });
  }),
);
const exhibitionInput = z
  .object({
    name: text(180).pipe(z.string().min(2)),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    theme: text(300).default(""),
    timezone,
    edition: text(80).default(""),
    description: text(5000).default(""),
    coverImageUrl: asset,
    storyImageUrl: asset,
    curatorName: text(180).default(""),
    curatorNote: text(10000).default(""),
    startAt: date,
    endAt: date,
    status: z.enum(["draft", "scheduled", "active", "completed", "cancelled"]).default("draft"),
    isPublished: z.boolean().default(false),
    advisorWhatsapp: z
      .string()
      .trim()
      .regex(/^(?:[1-9]\d{7,14})?$/, "Enter 8–15 digits including country code, without +")
      .default(""),
    previewEnabled: z.boolean().default(true),
    previewNote: text(1000).default(""),
    artistIds: z.array(id).max(200).default([]),
    artworkIds: z.array(id).max(500).default([]),
    rooms: z
      .array(
        z
          .object({
            key: z
              .string()
              .max(60)
              .regex(/^[a-z0-9-]+$/),
            name: text(100).pipe(z.string().min(1)),
            description: text(500).default(""),
            artworkIds: z.array(id).max(500),
          })
          .strict(),
      )
      .max(12)
      .default([]),
    events: z
      .array(
        z
          .object({
            title: text(180).pipe(z.string().min(2)),
            description: text(1500).default(""),
            startAt: date,
            endAt: z.union([date, z.literal("")]).optional(),
            timezone,
            url: secureUrl,
          })
          .strict(),
      )
      .max(20)
      .default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.endAt) <= new Date(value.startAt))
      ctx.addIssue({
        code: "custom",
        message: "Closing date must be after opening date",
        path: ["endAt"],
      });
    for (const key of ["artistIds", "artworkIds"] as const)
      if (new Set(value[key]).size !== value[key].length)
        ctx.addIssue({ code: "custom", message: "Selections must be unique", path: [key] });
    if (new Set(value.rooms.map((room) => room.key)).size !== value.rooms.length)
      ctx.addIssue({ code: "custom", message: "Room keys must be unique", path: ["rooms"] });
    if (value.rooms.some((room) => room.artworkIds.some((id) => !value.artworkIds.includes(id))))
      ctx.addIssue({
        code: "custom",
        message: "Room artworks must be selected in this exhibition",
        path: ["rooms"],
      });
    if (
      value.events.some((event) => event.endAt && new Date(event.endAt) <= new Date(event.startAt))
    )
      ctx.addIssue({
        code: "custom",
        message: "Event end must be after its start",
        path: ["events"],
      });
    if (value.isPublished && !value.coverImageUrl && !value.artworkIds.length)
      ctx.addIssue({
        code: "custom",
        message: "Add a cover image or select artwork before publishing",
        path: ["coverImageUrl"],
      });
    if (value.isPublished && ["draft", "cancelled"].includes(value.status))
      ctx.addIssue({
        code: "custom",
        message: "Choose Scheduled, Active or Completed before publishing",
        path: ["status"],
      });
  });

exhibitionsRouter.get(
  "/",
  asyncRoute(async (_req, res) => ok(res, await readExhibitionLanding())),
);
exhibitionsRouter.get(
  "/:slug",
  asyncRoute(async (req, res) => {
    const data = await readExhibition(z.string().max(160).parse(req.params.slug));
    if (!data) throw new ApiError(404, "EXHIBITION_NOT_FOUND", "Exhibition not found");
    return ok(res, data);
  }),
);

exhibitionsRouter.post(
  "/:slug/registrations",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 12,
    keyGenerator: (req) => (req.ip ? ipKeyGenerator(req.ip) : "unknown-client"),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Please wait a few minutes before submitting again.",
      },
    },
  }),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        kind: z.enum(["preview", "enquiry"]),
        name: text(120).pipe(z.string().min(2)),
        email: z.string().trim().email().max(254),
        country: text(100).default(""),
        message: text(2000).default(""),
        consent: z.literal(true),
        artworkId: id.optional(),
      })
      .strict()
      .parse(req.body);
    const item = await ExhibitionModel.findOne({
      ...visibleExhibitionFilter,
      slug: req.params.slug,
    }).lean();
    if (!item) throw new ApiError(404, "EXHIBITION_NOT_FOUND", "Exhibition not found");
    if (
      input.kind === "preview" &&
      (item.previewEnabled === false ||
        exhibitionPhase(serializeOnlineExhibition(item)) === "closed")
    )
      throw new ApiError(
        409,
        "PREVIEW_CLOSED",
        "Private preview registration is closed for this exhibition.",
      );
    if (input.kind === "enquiry") {
      if (
        !input.artworkId ||
        !item.artworkIds.some((value: unknown) => String(value) === input.artworkId)
      )
        throw new ApiError(422, "INVALID_ARTWORK", "Choose an artwork in this exhibition");
      const work = await ArtworkModel.findOne({
        ...exhibitionArtworkFilter,
        _id: input.artworkId,
      }).lean();
      if (!work || !(await StoreModel.exists({ ...publicStoreFilter, _id: work.storeId })))
        throw new ApiError(404, "ARTWORK_NOT_FOUND", "This artwork is no longer in the exhibition");
    }
    const emailNormalized = normalizeEmail(input.email);
    await ExhibitionRegistrationModel.findOneAndUpdate(
      {
        exhibitionId: item._id,
        kind: input.kind,
        emailNormalized,
        artworkId: input.kind === "enquiry" ? input.artworkId : null,
      },
      {
        $set: {
          name: input.name,
          country: input.country,
          message: input.message,
          consentAt: new Date(),
        },
      },
      { upsert: true, runValidators: true },
    );
    return ok(
      res,
      { registered: true },
      input.kind === "preview"
        ? "Your private preview request has been received"
        : "Your artwork enquiry has been received",
      201,
    );
  }),
);

adminExhibitionsRouter.get(
  "/",
  asyncRoute(async (_req, res) => {
    const items = await ExhibitionModel.find({ type: { $in: ["online", "hybrid"] } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok(res, items.map(serializeOnlineExhibition));
  }),
);
adminExhibitionsRouter.get(
  "/candidates",
  asyncRoute(async (req, res) => {
    const query = z
      .string()
      .max(120)
      .parse(req.query.q ?? "");
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const stores = await StoreModel.find(publicStoreFilter).select("_id ownerId").lean();
    const artworks = await ArtworkModel.find({
      ...exhibitionArtworkFilter,
      storeId: { $in: stores.map((store) => store._id) },
      ...(query
        ? { $or: [{ title: pattern }, { creatorName: pattern }, { medium: pattern }] }
        : {}),
    })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();
    const data = await exhibitionDetail({
      artworkIds: artworks.map((work) => work._id),
      artistIds: stores.map((store) => store.ownerId),
    });
    return ok(res, { artworks: data.artworks, artists: data.artists });
  }),
);
adminExhibitionsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const item = await ExhibitionModel.findById(objectId(String(req.params.id))).lean();
    if (!item) throw new ApiError(404, "EXHIBITION_NOT_FOUND", "Exhibition not found");
    return ok(res, await exhibitionDetail(item));
  }),
);

async function validateSelections(input: z.infer<typeof exhibitionInput>) {
  const stores = await StoreModel.find(publicStoreFilter).select("_id ownerId").lean();
  const count = await ArtworkModel.countDocuments({
    ...exhibitionArtworkFilter,
    _id: { $in: input.artworkIds },
    storeId: { $in: stores.map((store) => store._id) },
  });
  if (count !== input.artworkIds.length)
    throw new ApiError(
      422,
      "INVALID_ARTWORK_SELECTION",
      "Selected artworks must be approved and belong to published stores. Remove unavailable selections.",
    );
  if (input.artistIds.some((id) => !stores.some((store) => String(store.ownerId) === id)))
    throw new ApiError(
      422,
      "INVALID_ARTIST_SELECTION",
      "Selected artists must have published profiles.",
    );
}
adminExhibitionsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const input = exhibitionInput.parse(req.body);
    await validateSelections(input);
    const item = await ExhibitionModel.create({ ...input, type: "online" });
    await audit(req, "admin.exhibition_created", "Exhibition", item._id);
    return ok(res, serializeOnlineExhibition(item.toObject()), "Exhibition created", 201);
  }),
);
adminExhibitionsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const item = await ExhibitionModel.findById(objectId(String(req.params.id)));
    if (!item) throw new ApiError(404, "EXHIBITION_NOT_FOUND", "Exhibition not found");
    const { id: _id, ...previous } = serializeOnlineExhibition(item.toObject());
    const input = exhibitionInput.parse({ ...previous, ...req.body });
    await validateSelections(input);
    const before = item.toObject();
    item.set(input);
    await item.save();
    await audit(req, "admin.exhibition_updated", "Exhibition", item._id, before, item.toObject());
    return ok(res, serializeOnlineExhibition(item.toObject()), "Exhibition updated");
  }),
);
adminExhibitionsRouter.get(
  "/:id/registrations",
  asyncRoute(async (req, res) => {
    const exhibitionId = objectId(String(req.params.id));
    const [items, total] = await Promise.all([
      ExhibitionRegistrationModel.find({ exhibitionId })
        .populate("artworkId", "title")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
      ExhibitionRegistrationModel.countDocuments({ exhibitionId }),
    ]);
    return ok(res, {
      total,
      items: items.map((item: any) => ({
        id: String(item._id),
        kind: item.kind,
        name: item.name,
        email: item.emailNormalized,
        country: item.country ?? "",
        message: item.message ?? "",
        artworkTitle: item.artworkId?.title ?? "",
        createdAt: item.createdAt.toISOString(),
      })),
    });
  }),
);

adminExhibitionsRouter.patch(
  "/:id/artworks/:artworkId/availability",
  asyncRoute(async (req, res) => {
    const input = z
      .object({ availability: z.enum(["Available", "Reserved", "Sold"]) })
      .strict()
      .parse(req.body);
    const exhibitionId = objectId(String(req.params.id));
    const artworkId = objectId(String(req.params.artworkId));
    if (!(await ExhibitionModel.exists({ _id: exhibitionId, artworkIds: artworkId })))
      throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork is not part of this exhibition");
    // Use the marketplace state itself, and never overwrite checkout/payment reservations.
    await mongoose.connection.transaction(async (session) => {
      const work = await ArtworkModel.findOne({
        _id: artworkId,
        ...exhibitionArtworkFilter,
      }).session(session);
      if (!work) throw new ApiError(404, "ARTWORK_NOT_FOUND", "Approved artwork not found");
      const ordered = await OrderModel.exists({
        "items.artworkId": artworkId,
        status: { $nin: ["cancelled", "refunded", "returned"] },
      }).session(session);
      if (work.reservedBy || ordered)
        throw new ApiError(
          409,
          "ARTWORK_IN_ORDER",
          "This artwork has a marketplace reservation or order. Manage its availability through that order.",
        );
      const status =
        input.availability === "Available" ? "published" : input.availability.toLowerCase();
      const store = await StoreModel.findById(work.storeId).session(session);
      if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Artwork store not found");
      if (work.status === "sold" && status !== "sold") {
        const subscription = await SubscriptionModel.findOne({
          userId: store.ownerId,
          status: "active",
          $or: [{ planId: "free" }, { currentPeriodEnd: { $gt: new Date() } }],
        })
          .sort({ createdAt: -1 })
          .session(session);
        if (!subscription)
          throw new ApiError(
            403,
            "ACTIVE_SUBSCRIPTION_REQUIRED",
            "The artist needs an active subscription before this artwork can be made available again.",
          );
        if (subscription.listingLimit !== null && subscription.listingLimit !== undefined) {
          const ownerStores = await StoreModel.find({ ownerId: store.ownerId })
            .select("_id")
            .session(session);
          const active = await ArtworkModel.countDocuments({
            storeId: { $in: ownerStores.map((item) => item._id) },
            status: { $in: ["pending_review", "published", "reserved"] },
          }).session(session);
          if (active >= subscription.listingLimit)
            throw new ApiError(
              409,
              "LISTING_LIMIT_REACHED",
              "The artist’s active listing limit has been reached. Archive a work before making this one available again.",
            );
          await ListingQuotaModel.findOneAndUpdate(
            { userId: store.ownerId },
            { $set: { activeListings: active + 1 } },
            { session, upsert: true },
          );
        }
      } else if (work.status !== "sold" && status === "sold") {
        await ListingQuotaModel.updateOne(
          { userId: store.ownerId, activeListings: { $gt: 0 } },
          { $inc: { activeListings: -1 } },
          { session },
        );
      }
      const changed = await ArtworkModel.updateOne(
        { _id: artworkId, status: work.status, reservedBy: { $exists: false } },
        {
          $set: {
            status,
            quantity: input.availability === "Sold" ? 0 : Math.max(work.quantity, 1),
          },
          $unset: { reservedUntil: 1 },
        },
        { session, runValidators: true },
      );
      if (!changed.matchedCount)
        throw new ApiError(
          409,
          "AVAILABILITY_CHANGED",
          "Availability changed. Refresh and try again.",
        );
    });
    await audit(req, "admin.exhibition_artwork_availability", "Artwork", artworkId, undefined, {
      availability: input.availability,
      exhibitionId: String(exhibitionId),
    });
    return ok(res, { updated: true }, "Marketplace availability updated");
  }),
);
