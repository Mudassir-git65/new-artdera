import { Router, type Request } from "express";
import { z } from "zod";
import {
  CustomerRecordModel,
  ExhibitionModel,
  GalleryArtistModel,
  GalleryProfileModel,
  GalleryStaffInviteModel,
  GalleryStaffModel,
  OrderModel,
  StoreModel,
  SubscriptionModel,
  SubscriptionPlanModel,
  UserModel,
} from "../models";
import { ApiError, asyncRoute, ok } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { hashToken, normalizeEmail, randomToken, sanitizeText } from "../lib/security";
import { audit } from "../services/audit";
import { notify } from "../services/notifications";

export const galleryRouter = Router();
galleryRouter.use(requireAuth);

async function galleryContext(req: Request, permission?: string) {
  const permissionMap: Record<string, string> = {
    manage_artists: "managed-artists",
    customers: "gallery-crm",
  };
  if (req.auth!.user.role === "gallery") {
    const gallery = await GalleryProfileModel.findOne({ userId: req.auth!.user._id });
    if (!gallery) throw new ApiError(404, "GALLERY_NOT_FOUND", "Gallery profile not found");
    const subscription = await SubscriptionModel.findOne({
      userId: gallery.userId,
      status: "active",
      planId: "gallery",
    }).lean();
    if (!subscription)
      throw new ApiError(403, "GALLERY_PLAN_REQUIRED", "An active Gallery plan is required");
    const required = permission ? (permissionMap[permission] ?? permission) : undefined;
    if (required && !subscription.featuresSnapshot.includes(required))
      throw new ApiError(
        403,
        "PLAN_FEATURE_LOCKED",
        "Your current plan does not include this feature",
      );
    return { gallery, owner: true };
  }
  if (req.auth!.user.role === "gallery_staff") {
    const staff = await GalleryStaffModel.findOne({ userId: req.auth!.user._id, status: "active" });
    if (!staff || (permission && !staff.permissions.includes(permission)))
      throw new ApiError(
        403,
        "GALLERY_PERMISSION_REQUIRED",
        "Your gallery role does not include this permission",
      );
    const gallery = await GalleryProfileModel.findById(staff.galleryId);
    if (!gallery) throw new ApiError(404, "GALLERY_NOT_FOUND", "Gallery profile not found");
    const subscription = await SubscriptionModel.findOne({
      userId: gallery.userId,
      status: "active",
      planId: "gallery",
    }).lean();
    const required = permission ? (permissionMap[permission] ?? permission) : undefined;
    if (!subscription || (required && !subscription.featuresSnapshot.includes(required)))
      throw new ApiError(
        403,
        "PLAN_FEATURE_LOCKED",
        "The gallery plan does not include this feature",
      );
    return { gallery, owner: false, staff };
  }
  throw new ApiError(403, "GALLERY_ACCESS_REQUIRED", "Gallery access is required");
}

galleryRouter.get(
  "/profile",
  asyncRoute(async (req, res) => {
    const { gallery } = await galleryContext(req);
    const store = await StoreModel.findOne({ ownerId: gallery.userId }).lean();
    return ok(res, {
      id: String(gallery._id),
      userId: String(gallery.userId),
      galleryName: gallery.galleryName,
      description: gallery.description,
      logoUrl: gallery.logoUrl,
      coverImageUrl: gallery.coverImageUrl,
      city: gallery.city,
      province: gallery.province,
      country: gallery.country,
      website: gallery.website,
      socialLinks: gallery.socialLinks,
      verificationStatus: gallery.verificationStatus,
      onboardingCompleted: gallery.onboardingCompleted,
      storeId: store ? String(store._id) : undefined,
    });
  }),
);

galleryRouter.patch(
  "/profile",
  asyncRoute(async (req, res) => {
    const { gallery, owner } = await galleryContext(req, "manage_gallery_profile");
    if (!owner)
      throw new ApiError(
        403,
        "GALLERY_OWNER_REQUIRED",
        "Only the gallery owner can update legal profile details",
      );
    const input = z
      .object({
        galleryName: z.string().trim().min(2).max(160).optional(),
        legalName: z.string().trim().max(180).optional(),
        description: z.string().trim().max(5000).optional(),
        logoUrl: z.string().max(1000).optional(),
        coverImageUrl: z.string().max(1000).optional(),
        registrationNumber: z.string().trim().max(120).optional(),
        taxNumber: z.string().trim().max(120).optional(),
        city: z.string().trim().max(100).optional(),
        province: z.string().trim().max(100).optional(),
        country: z.string().trim().max(80).optional(),
        website: z.string().url().max(500).optional(),
      })
      .strict()
      .parse(req.body);
    Object.assign(gallery, input);
    await gallery.save();
    await audit(req, "gallery.profile_updated", "GalleryProfile", gallery._id);
    return ok(
      res,
      {
        id: String(gallery._id),
        galleryName: gallery.galleryName,
        description: gallery.description,
        city: gallery.city,
        province: gallery.province,
        country: gallery.country,
        website: gallery.website,
      },
      "Gallery profile updated",
    );
  }),
);

galleryRouter.get(
  "/staff",
  asyncRoute(async (req, res) => {
    const { gallery } = await galleryContext(req, "staff");
    const [staff, invites] = await Promise.all([
      GalleryStaffModel.find({ galleryId: gallery._id })
        .populate("userId", "fullName email")
        .lean(),
      GalleryStaffInviteModel.find({ galleryId: gallery._id, status: "pending" }).lean(),
    ]);
    return ok(res, [
      ...staff.map((item: any) => ({
        id: String(item._id),
        galleryId: String(item.galleryId),
        userId: String(item.userId?._id),
        name: item.userId?.fullName,
        email: item.userId?.email,
        role: item.role,
        permissions: item.permissions,
        status:
          item.status === "active" ? "Active" : item.status === "invited" ? "Invited" : "Suspended",
      })),
      ...invites.map((item) => ({
        id: String(item._id),
        galleryId: String(item.galleryId),
        email: item.emailNormalized,
        role: item.role,
        permissions: item.permissions,
        status: "Invited",
      })),
    ]);
  }),
);

galleryRouter.post(
  "/staff/invite",
  asyncRoute(async (req, res) => {
    const { gallery, owner } = await galleryContext(req, "staff");
    if (!owner)
      throw new ApiError(403, "GALLERY_OWNER_REQUIRED", "Only the owner can invite staff");
    const input = z
      .object({
        email: z.string().email(),
        role: z.string().trim().min(2).max(80),
        permissions: z.array(z.string().trim().min(1).max(80)).max(100),
      })
      .strict()
      .parse(req.body);
    const subscription = await SubscriptionModel.findOne({
      userId: gallery.userId,
      status: "active",
      planId: "gallery",
    }).lean();
    if (!subscription)
      throw new ApiError(403, "GALLERY_PLAN_REQUIRED", "An active Gallery plan is required");
    const [staffCount, inviteCount] = await Promise.all([
      GalleryStaffModel.countDocuments({
        galleryId: gallery._id,
        status: { $in: ["active", "invited"] },
      }),
      GalleryStaffInviteModel.countDocuments({
        galleryId: gallery._id,
        status: "pending",
        expiresAt: { $gt: new Date() },
      }),
    ]);
    const plan = await SubscriptionPlanModel.findOne({ planId: "gallery", isActive: true }).lean();
    const maximum = plan?.staffAccountMaximum ?? 10;
    if (staffCount + inviteCount >= maximum)
      throw new ApiError(
        409,
        "STAFF_LIMIT_REACHED",
        `Your Gallery plan allows up to ${maximum} staff accounts`,
      );
    const invalidPermission = input.permissions.find(
      (permission) =>
        !subscription.featuresSnapshot.includes(permission) &&
        ![
          "manage_inventory",
          "manage_orders",
          "manage_artists",
          "manage_exhibitions",
          "manage_customers",
          "view_reports",
          "staff",
        ].includes(permission),
    );
    if (invalidPermission)
      throw new ApiError(
        422,
        "INVALID_STAFF_PERMISSION",
        "A staff member cannot receive permissions beyond the gallery owner",
      );
    const emailNormalized = normalizeEmail(input.email);
    const token = randomToken();
    const invite = await GalleryStaffInviteModel.create({
      galleryId: gallery._id,
      emailNormalized,
      role: input.role,
      permissions: input.permissions,
      tokenHash: hashToken(token),
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    });
    const existing = await UserModel.findOne({ emailNormalized });
    if (existing)
      await notify(
        existing._id,
        "gallery_staff_invite",
        "Gallery invitation",
        `${gallery.galleryName} invited you to join its team.`,
        "/account",
      );
    await audit(req, "gallery.staff_invited", "GalleryStaffInvite", invite._id, undefined, {
      emailNormalized,
      role: input.role,
      permissions: input.permissions,
    });
    return ok(
      res,
      {
        id: String(invite._id),
        email: emailNormalized,
        role: invite.role,
        permissions: invite.permissions,
        status: "Invited",
        expiresAt: invite.expiresAt.toISOString(),
      },
      "Staff invitation created",
      201,
    );
  }),
);

galleryRouter.patch(
  "/staff/:id",
  asyncRoute(async (req, res) => {
    const { gallery, owner } = await galleryContext(req, "staff");
    if (!owner)
      throw new ApiError(
        403,
        "GALLERY_OWNER_REQUIRED",
        "Only the owner can change staff permissions",
      );
    const input = z
      .object({
        role: z.string().trim().min(2).max(80).optional(),
        permissions: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
        status: z.enum(["active", "suspended", "revoked"]).optional(),
      })
      .strict()
      .parse(req.body);
    const staff = await GalleryStaffModel.findOneAndUpdate(
      { _id: req.params.id, galleryId: gallery._id },
      { $set: input },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!staff) throw new ApiError(404, "STAFF_NOT_FOUND", "Staff member not found");
    await audit(req, "gallery.staff_updated", "GalleryStaff", staff._id, undefined, input);
    return ok(
      res,
      {
        id: String(staff._id),
        role: staff.role,
        permissions: staff.permissions,
        status: staff.status,
      },
      "Staff updated",
    );
  }),
);

galleryRouter.get(
  "/artists",
  asyncRoute(async (req, res) => {
    const { gallery } = await galleryContext(req, "manage_artists");
    const relations = await GalleryArtistModel.find({
      galleryId: gallery._id,
      status: { $ne: "removed" },
    })
      .populate("artistId", "fullName email city avatarUrl")
      .lean();
    return ok(
      res,
      relations.map((item: any) => ({
        id: String(item._id),
        artistId: String(item.artistId?._id),
        name: item.artistId?.fullName,
        email: item.artistId?.email,
        city: item.artistId?.city,
        avatar: item.artistId?.avatarUrl,
        status: item.status,
        invitedAt: item.invitedAt?.toISOString?.(),
      })),
    );
  }),
);

galleryRouter.post(
  "/artists",
  asyncRoute(async (req, res) => {
    const { gallery } = await galleryContext(req, "manage_artists");
    const { email } = z.object({ email: z.string().email() }).strict().parse(req.body);
    const artist = await UserModel.findOne({
      emailNormalized: normalizeEmail(email),
      role: "artist",
      status: "active",
    });
    if (!artist)
      throw new ApiError(
        404,
        "ARTIST_NOT_FOUND",
        "No active artist account was found for that email",
      );
    const relation = await GalleryArtistModel.findOneAndUpdate(
      { galleryId: gallery._id, artistId: artist._id },
      { $set: { status: "invited", invitedAt: new Date() } },
      { returnDocument: "after", upsert: true },
    );
    await notify(
      artist._id,
      "gallery_artist_invite",
      "Gallery invitation",
      `${gallery.galleryName} invited you to its managed artist roster.`,
      "/account",
    );
    return ok(
      res,
      {
        id: String(relation._id),
        artistId: String(artist._id),
        name: artist.fullName,
        status: relation.status,
      },
      "Artist invited",
      201,
    );
  }),
);

galleryRouter.get(
  "/exhibitions",
  asyncRoute(async (req, res) => {
    const { gallery } = await galleryContext(req, "exhibitions");
    const exhibitions = await ExhibitionModel.find({ galleryId: gallery._id })
      .sort({ startAt: -1 })
      .lean();
    return ok(res, exhibitions.map(serializeExhibition));
  }),
);

galleryRouter.post(
  "/exhibitions",
  asyncRoute(async (req, res) => {
    const { gallery } = await galleryContext(req, "exhibitions");
    const input = z
      .object({
        name: z.string().trim().min(2).max(180),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        coverImageUrl: z.string().max(1000).optional(),
        description: z.string().trim().max(5000).default(""),
        venue: z.string().trim().max(300).default(""),
        startAt: z.coerce.date(),
        endAt: z.coerce.date(),
        artistIds: z.array(z.string()).max(200).default([]),
        artworkIds: z.array(z.string()).max(500).default([]),
        type: z.enum(["online", "physical", "hybrid"]),
        status: z.enum(["draft", "scheduled", "active"]).default("draft"),
        isPublished: z.boolean().default(false),
      })
      .strict()
      .refine((value) => value.endAt > value.startAt, {
        message: "End date must be after start date",
        path: ["endAt"],
      })
      .parse(req.body);
    const exhibition = await ExhibitionModel.create({
      ...input,
      galleryId: gallery._id,
      name: sanitizeText(input.name, 180),
      description: sanitizeText(input.description, 5000),
      venue: sanitizeText(input.venue, 300),
    });
    await audit(req, "gallery.exhibition_created", "Exhibition", exhibition._id);
    return ok(res, serializeExhibition(exhibition.toObject()), "Exhibition created", 201);
  }),
);

galleryRouter.patch(
  "/exhibitions/:id",
  asyncRoute(async (req, res) => {
    const { gallery } = await galleryContext(req, "exhibitions");
    const input = z
      .object({
        name: z.string().trim().min(2).max(180).optional(),
        description: z.string().trim().max(5000).optional(),
        venue: z.string().trim().max(300).optional(),
        startAt: z.coerce.date().optional(),
        endAt: z.coerce.date().optional(),
        artistIds: z.array(z.string()).max(200).optional(),
        artworkIds: z.array(z.string()).max(500).optional(),
        type: z.enum(["online", "physical", "hybrid"]).optional(),
        status: z.enum(["draft", "scheduled", "active", "completed", "cancelled"]).optional(),
        isPublished: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    const exhibition = await ExhibitionModel.findOneAndUpdate(
      { _id: req.params.id, galleryId: gallery._id },
      { $set: input },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!exhibition) throw new ApiError(404, "EXHIBITION_NOT_FOUND", "Exhibition not found");
    return ok(res, serializeExhibition(exhibition), "Exhibition updated");
  }),
);

galleryRouter.get(
  "/customers",
  asyncRoute(async (req, res) => {
    const { gallery } = await galleryContext(req, "customers");
    const ownerId = gallery.userId;
    const [orders, records] = await Promise.all([
      OrderModel.aggregate([
        { $match: { sellerId: ownerId, status: "completed" } },
        {
          $group: {
            _id: "$buyerId",
            completedOrders: { $sum: 1 },
            totalSpending: { $sum: "$buyerTotal" },
            lastPurchase: { $max: "$completedAt" },
            city: { $last: "$shippingAddress.city" },
          },
        },
      ]),
      CustomerRecordModel.find({ sellerId: ownerId }).lean(),
    ]);
    const users = await UserModel.find({ _id: { $in: orders.map((order) => order._id) } })
      .select("fullName city country")
      .lean();
    const userById = new Map(users.map((user) => [String(user._id), user]));
    const recordByBuyer = new Map(records.map((record) => [String(record.buyerId), record]));
    return ok(
      res,
      orders.map((order) => {
        const user = userById.get(String(order._id));
        const record = recordByBuyer.get(String(order._id));
        return {
          id: record ? String(record._id) : `buyer-${order._id}`,
          sellerId: String(ownerId),
          buyerId: String(order._id),
          buyerName: user?.fullName ?? "Collector",
          completedOrders: order.completedOrders,
          totalSpending: order.totalSpending,
          lastPurchase: order.lastPurchase,
          favouriteCategory: "",
          notes: record?.notes ?? "",
          tags: record?.tags ?? [],
          followUpAt: record?.followUpAt,
          city: order.city ?? user?.city,
          country: user?.country ?? "Pakistan",
          marketingConsent: record?.marketingConsent ?? false,
          contactVisible: true,
        };
      }),
    );
  }),
);

function serializeExhibition(value: Record<string, any>) {
  return {
    id: String(value._id),
    galleryId: String(value.galleryId),
    name: value.name,
    slug: value.slug,
    description: value.description,
    venue: value.venue,
    startDate: value.startAt?.toISOString?.() ?? value.startAt,
    endDate: value.endAt?.toISOString?.() ?? value.endAt,
    artistIds: (value.artistIds ?? []).map(String),
    artworkIds: (value.artworkIds ?? []).map(String),
    coverImage: value.coverImageUrl,
    format: value.type === "online" ? "Online" : value.type === "physical" ? "Physical" : "Hybrid",
    published: value.isPublished,
    status: value.status,
  };
}
