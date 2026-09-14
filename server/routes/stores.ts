import { Router } from "express";
import { z } from "zod";
import {
  ArtistProfileModel,
  ArtworkModel,
  GalleryProfileModel,
  OnboardingDraftModel,
  StoreModel,
  SubscriptionModel,
  VerificationRequestModel,
} from "../models";
import { ApiError, asyncRoute, ok } from "../lib/http";
import { requireAuth, requireRole, requireVerified } from "../middleware/auth";
import { publicArtwork, publicStore } from "../lib/serializers";
import { audit } from "../services/audit";
import { notify } from "../services/notifications";
import { sanitizeText } from "../lib/security";
import { requirePermission, reserveListingSlot } from "../services/plans";
import { trackStoreView } from "../services/view-tracker";

export const storesRouter = Router();
const reservedSlugs = new Set([
  "admin",
  "api",
  "artdera",
  "auth",
  "dashboard",
  "discover",
  "help",
  "new-store",
  "sell",
  "store",
  "stores",
  "support",
]);
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const storeInput = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: slugSchema,
    tagline: z.string().trim().max(180).default(""),
    shortDescription: z.string().trim().max(400).default(""),
    fullDescription: z.string().trim().max(5000).default(""),
    bio: z.string().trim().max(400).optional(),
    story: z.string().trim().max(5000).optional(),
    logoUrl: z.string().max(1000).optional(),
    coverImageUrl: z.string().max(1000).optional(),
    profileImage: z.string().max(1000).optional(),
    coverImage: z.string().max(1000).optional(),
    city: z.string().trim().max(100).optional(),
    province: z.string().trim().max(100).optional(),
    country: z.string().trim().max(80).default("Pakistan"),
    categories: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    styles: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    mediums: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    themes: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    domesticShipping: z.boolean().default(true),
    internationalShipping: z.boolean().default(false),
    processingTime: z.string().trim().max(80).default("3-5 working days"),
    publicContactPreference: z.enum(["messages", "eligible_orders"]).default("messages"),
    customCommissionAvailable: z.boolean().default(false),
    status: z.enum(["draft", "pending_review", "active"]).default("draft"),
  })
  .strict();

storesRouter.get(
  "/mine",
  requireAuth,
  asyncRoute(async (req, res) => {
    const stores = await StoreModel.find({ ownerId: req.auth!.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, stores.map(publicStore));
  }),
);

storesRouter.get(
  "/slug-available/:slug",
  asyncRoute(async (req, res) => {
    const slug = slugSchema.parse(req.params.slug);
    const existing = await StoreModel.findOne({ slug }).select("ownerId").lean();
    const ownedByCurrentUser =
      Boolean(req.auth) && existing && String(existing.ownerId) === String(req.auth!.user._id);
    const available = !reservedSlugs.has(slug) && (!existing || ownedByCurrentUser);
    return ok(res, { slug, available });
  }),
);

storesRouter.get(
  "/:slug",
  asyncRoute(async (req, res) => {
    const slug = slugSchema.parse(req.params.slug);
    const store = await StoreModel.findOne({ slug, isPublished: true, status: "active" }).lean();
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found");
    const artworks = await ArtworkModel.find({
      storeId: store._id,
      status: "published",
      moderationStatus: "approved",
    })
      .sort({ isSponsored: -1, createdAt: -1 })
      .limit(100)
      .lean();
    void trackStoreView(store._id, req);
    return ok(res, { store: publicStore(store), artworks: artworks.map(publicArtwork) });
  }),
);

storesRouter.post(
  "/",
  requireVerified,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const input = storeInput.parse(req.body);
    if (reservedSlugs.has(input.slug))
      throw new ApiError(409, "SLUG_RESERVED", "That store URL is reserved");
    if (await StoreModel.exists({ slug: input.slug }))
      throw new ApiError(409, "SLUG_TAKEN", "That store URL is already in use");
    const subscription = await SubscriptionModel.findOne({
      userId: req.auth!.user._id,
      status: "active",
    });
    if (!subscription)
      throw new ApiError(
        403,
        "ACTIVE_SUBSCRIPTION_REQUIRED",
        "Activate your subscription before creating a store",
      );
    if (input.internationalShipping)
      await requirePermission(req.auth!.user._id, "international-tools");
    const store = await StoreModel.create({
      ownerId: req.auth!.user._id,
      ownerType: req.auth!.user.role,
      name: sanitizeText(input.name, 160),
      slug: input.slug,
      tagline: sanitizeText(input.tagline, 180),
      shortDescription: sanitizeText(input.shortDescription ?? input.bio ?? "", 400),
      fullDescription: sanitizeText(input.fullDescription ?? input.story ?? "", 5000),
      logoUrl: input.logoUrl ?? input.profileImage,
      coverImageUrl: input.coverImageUrl ?? input.coverImage,
      city: input.city ?? req.auth!.user.city,
      province: input.province ?? req.auth!.user.province,
      country: input.country,
      categories: input.categories,
      styles: input.styles,
      mediums: input.mediums,
      themes: input.themes,
      status: input.status,
      isPublished: input.status === "active",
      domesticShipping: input.domesticShipping,
      internationalShipping: input.internationalShipping,
      processingTime: input.processingTime,
      publicContactPreference: input.publicContactPreference,
      customCommissionAvailable: input.customCommissionAvailable,
    });
    subscription.storeId = store._id;
    await subscription.save();
    await notify(
      req.auth!.user._id,
      "store_created",
      "Store created",
      `${store.name} is ready for setup.`,
      `/store/${store.slug}`,
    );
    await audit(req, "store.created", "Store", store._id, undefined, store.toObject());
    return ok(res, publicStore(store.toObject()), "Store created", 201);
  }),
);

storesRouter.patch(
  "/:id",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const input = storeInput.partial().parse(req.body);
    if (input.slug && reservedSlugs.has(input.slug))
      throw new ApiError(409, "SLUG_RESERVED", "That store URL is reserved");
    if (input.slug && (await StoreModel.exists({ slug: input.slug, _id: { $ne: req.params.id } })))
      throw new ApiError(409, "SLUG_TAKEN", "That store URL is already in use");
    const before = await StoreModel.findOne({
      _id: req.params.id,
      ownerId: req.auth!.user._id,
    }).lean();
    if (!before) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found");
    if (input.internationalShipping)
      await requirePermission(req.auth!.user._id, "international-tools");
    const patch: Record<string, unknown> = { ...input };
    if (input.bio !== undefined) patch.shortDescription = input.bio;
    if (input.story !== undefined) patch.fullDescription = input.story;
    if (input.profileImage !== undefined) patch.logoUrl = input.profileImage;
    if (input.coverImage !== undefined) patch.coverImageUrl = input.coverImage;
    delete patch.bio;
    delete patch.story;
    delete patch.profileImage;
    delete patch.coverImage;
    if (input.status) patch.isPublished = input.status === "active";
    const store = await StoreModel.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.auth!.user._id },
      { $set: patch },
      { returnDocument: "after", runValidators: true },
    ).lean();
    await audit(req, "store.updated", "Store", before._id, before, store);
    return ok(res, publicStore(store!), "Store updated");
  }),
);

storesRouter.get(
  "/onboarding/draft/current",
  requireAuth,
  asyncRoute(async (req, res) => {
    const draft = await OnboardingDraftModel.findOne({ userId: req.auth!.user._id }).lean();
    return ok(
      res,
      draft
        ? { step: draft.step, data: draft.data, completedAt: draft.completedAt }
        : { step: 0, data: {} },
    );
  }),
);

storesRouter.patch(
  "/onboarding/draft/current",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({ step: z.number().int().min(0).max(7), data: z.record(z.unknown()) })
      .strict()
      .parse(req.body);
    const draft = await OnboardingDraftModel.findOneAndUpdate(
      { userId: req.auth!.user._id },
      { $set: { step: input.step, data: input.data } },
      { returnDocument: "after", upsert: true, runValidators: true },
    ).lean();
    const Profile = req.auth!.user.role === "gallery" ? GalleryProfileModel : ArtistProfileModel;
    await Profile.updateOne(
      { userId: req.auth!.user._id },
      { $set: { onboardingStep: input.step } },
    );
    return ok(res, { step: draft!.step, data: draft!.data }, "Onboarding draft saved");
  }),
);

storesRouter.post(
  "/onboarding/complete",
  requireVerified,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({ data: z.record(z.unknown()) })
      .strict()
      .parse(req.body);
    const data = input.data as Record<string, any>;
    const required = ["displayName", "storeName", "slug", "shortBio", "city"];
    if (required.some((field) => typeof data[field] !== "string" || !data[field].trim()))
      throw new ApiError(
        422,
        "ONBOARDING_INCOMPLETE",
        "Complete all required store details before publishing",
      );
    const slug = slugSchema.parse(data.slug);
    if (reservedSlugs.has(slug))
      throw new ApiError(409, "SLUG_RESERVED", "That store URL is reserved");
    const existing = await StoreModel.findOne({ ownerId: req.auth!.user._id });
    if (
      await StoreModel.exists({
        slug,
        ...(existing ? { _id: { $ne: existing._id } } : {}),
      })
    )
      throw new ApiError(409, "SLUG_TAKEN", "That store URL is already in use");
    const subscription = await SubscriptionModel.findOne({
      userId: req.auth!.user._id,
      status: "active",
    });
    if (!subscription)
      throw new ApiError(
        403,
        "ACTIVE_SUBSCRIPTION_REQUIRED",
        "Activate your subscription before publishing a store",
      );
    const internationalToolsAvailable = Array.isArray(subscription.featuresSnapshot)
      ? subscription.featuresSnapshot.includes("international-tools")
      : false;
    const internationalShipping =
      internationalToolsAvailable && Boolean(data.internationalInterest);
    const ignoredFeatures =
      data.internationalInterest && !internationalToolsAvailable ? ["international-tools"] : [];
    const list = (value: unknown) =>
      typeof value === "string"
        ? value
            .split(",")
            .map((item) => sanitizeText(item, 80))
            .filter(Boolean)
            .slice(0, 30)
        : [];
    const store = await StoreModel.findOneAndUpdate(
      { ownerId: req.auth!.user._id },
      {
        $set: {
          ownerType: req.auth!.user.role,
          name: sanitizeText(data.storeName, 160),
          slug,
          tagline: sanitizeText(data.tagline ?? "", 180),
          shortDescription: sanitizeText(data.shortBio, 400),
          fullDescription: sanitizeText(data.story ?? data.about ?? "", 5000),
          logoUrl: data.profileImage,
          coverImageUrl: data.coverImage,
          city: sanitizeText(data.city, 100),
          province: sanitizeText(data.province ?? "", 100),
          country: sanitizeText(data.country ?? "Pakistan", 80),
          categories: list(data.categories),
          styles: list(data.styles),
          mediums: list(data.mediums),
          themes: list(data.themes),
          status: "active",
          isPublished: true,
          domesticShipping: Boolean(data.domesticShipping),
          internationalShipping,
          processingTime: sanitizeText(data.processingTime ?? "3-5 working days", 80),
          publicContactPreference: "messages",
          customCommissionAvailable: Boolean(data.commissions),
        },
        $setOnInsert: { ownerId: req.auth!.user._id },
      },
      { returnDocument: "after", upsert: true, runValidators: true },
    );
    subscription.storeId = store._id;
    await subscription.save();
    const Profile = req.auth!.user.role === "gallery" ? GalleryProfileModel : ArtistProfileModel;
    await Profile.updateOne(
      { userId: req.auth!.user._id },
      {
        $set: {
          onboardingCompleted: true,
          onboardingStep: 7,
          ...(req.auth!.user.role === "artist"
            ? {
                displayName: sanitizeText(data.displayName, 120),
                professionalTitle: sanitizeText(data.professionalTitle ?? "", 120),
                shortBio: sanitizeText(data.shortBio, 300),
                fullBio: sanitizeText(data.story ?? "", 5000),
                profileImageUrl: data.profileImage,
                coverImageUrl: data.coverImage,
                city: sanitizeText(data.city, 100),
                province: sanitizeText(data.province ?? "", 100),
                country: sanitizeText(data.country ?? "Pakistan", 80),
                languages: list(data.languages),
                categories: list(data.categories),
                styles: list(data.styles),
                mediums: list(data.mediums),
                themes: list(data.themes),
                portfolioUrl: data.portfolio,
                socialLinks: { instagram: data.instagram },
                customCommissionsAvailable: Boolean(data.commissions),
              }
            : {}),
        },
      },
    );
    let artwork;
    if (data.addArtwork && data.artworkTitle) {
      const publishNow = !data.artworkDraft;
      if (publishNow) await reserveListingSlot(req.auth!.user._id);
      artwork = await ArtworkModel.create({
        storeId: store._id,
        artistId: req.auth!.user.role === "artist" ? req.auth!.user._id : undefined,
        title: sanitizeText(data.artworkTitle, 180),
        slug: `${
          String(data.artworkTitle)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
            .slice(0, 80) || "artwork"
        }-${Date.now().toString(36)}`,
        description: sanitizeText(data.artworkDescription ?? "", 8000),
        category: sanitizeText(data.artworkCategory ?? "Original Works", 80),
        medium: sanitizeText(data.artworkMedium ?? "Mixed media", 80),
        style: sanitizeText(data.artworkStyle ?? "Contemporary", 80),
        subject: sanitizeText(data.artworkSubject ?? "", 100),
        yearCreated: Number(data.artworkYear) || new Date().getFullYear(),
        artworkType:
          data.artworkKind === "Print"
            ? "print"
            : data.artworkKind === "Limited Edition"
              ? "limited_edition"
              : "original",
        price: Number(data.artworkPrice),
        discountPrice: data.artworkDiscount ? Number(data.artworkDiscount) : undefined,
        width: Number(data.width) || undefined,
        height: Number(data.height) || undefined,
        depth: Number(data.depth) || undefined,
        measurementUnit: data.unit === "in" ? "in" : "cm",
        weight: Number(data.weight) || undefined,
        orientation: String(data.orientation ?? "Portrait").toLowerCase(),
        isFramed: Boolean(data.framed),
        quantity: Number(data.quantity) || 1,
        images: data.artworkImage
          ? [{ url: data.artworkImage, alt: sanitizeText(data.artworkTitle, 180), isPrimary: true }]
          : [],
        certificateAvailable: Boolean(data.certificate),
        pickupCity: sanitizeText(data.pickupCity ?? data.city, 100),
        domesticShipping: Boolean(data.domesticShipping),
        internationalShipping,
        processingTime: sanitizeText(data.processingTime ?? "3-5 working days", 80),
        tags: list(data.tags),
        customOrders: Boolean(data.customOrders),
        status: publishNow ? "pending_review" : "draft",
        moderationStatus: publishNow ? "pending" : "not_submitted",
      });
      if (publishNow)
        await notify(
          req.auth!.user._id,
          "artwork_submitted",
          "Artwork submitted",
          `${artwork.title} is awaiting moderation.`,
          "/artist/dashboard/artworks",
        );
    }
    if (data.verificationSubmitted) {
      const identityDocumentId =
        typeof data.identityDocumentId === "string" &&
        /^[a-f\d]{24}$/i.test(data.identityDocumentId)
          ? data.identityDocumentId
          : undefined;
      await VerificationRequestModel.updateOne(
        { userId: req.auth!.user._id, type: req.auth!.user.role },
        {
          $set: {
            storeId: store._id,
            submittedData: {
              fullName: sanitizeText(data.legalName ?? data.displayName ?? "", 120),
              cnicNumber: sanitizeText(data.cnicNumber ?? data.idNumber ?? "", 50),
              idNumber: sanitizeText(data.cnicNumber ?? data.idNumber ?? "", 50),
              idType: sanitizeText(data.idType ?? "CNIC", 50),
              phoneNumber: sanitizeText(data.verificationPhone ?? "", 30),
              portfolioUrl: String(data.portfolio ?? "")
                .trim()
                .slice(0, 500),
              galleryRegistrationNumber: sanitizeText(data.galleryRegistrationNumber ?? "", 120),
              identityDocumentName: sanitizeText(data.identityDocumentName ?? "", 180),
              ownershipDeclared: Boolean(data.ownershipDeclared),
            },
            documentReferences: identityDocumentId ? [identityDocumentId] : [],
            status: "pending",
          },
        },
        { upsert: true },
      );
    }
    await OnboardingDraftModel.updateOne(
      { userId: req.auth!.user._id },
      { $set: { step: 7, data, completedAt: new Date() } },
      { upsert: true },
    );
    await notify(
      req.auth!.user._id,
      "store_created",
      "Store published",
      `${store.name} is now live.`,
      `/store/${store.slug}`,
    );
    await audit(req, "onboarding.completed", "Store", store._id, undefined, {
      storeId: store._id,
      artworkId: artwork?._id,
    });
    return ok(
      res,
      {
        store: publicStore(store.toObject()),
        artwork: artwork ? publicArtwork(artwork.toObject()) : null,
        ignoredFeatures,
      },
      "Onboarding completed",
      201,
    );
  }),
);
