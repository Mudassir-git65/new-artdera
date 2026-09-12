import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  AffiliateModel,
  ArtistProfileModel,
  AnalyticsEventModel,
  ArtworkModel,
  AuditLogModel,
  CollectionModel,
  ConversationModel,
  ContentPageModel,
  CorporateLeadModel,
  DisputeModel,
  ExhibitionModel,
  GalleryProfileModel,
  InvoiceModel,
  ListingQuotaModel,
  MessageModel,
  NewsletterSubscriptionModel,
  NotificationModel,
  OrderModel,
  PaymentModel,
  PaymentProofModel,
  PayoutModel,
  PromotionModel,
  ReviewModel,
  ShippingQuoteModel,
  ShippingRuleModel,
  ShipmentModel,
  StoreModel,
  SubscriptionModel,
  SupportTicketModel,
  SystemSettingModel,
  TaxonomyModel,
  UploadModel,
  UserModel,
  VerificationRequestModel,
  AuthSessionModel,
} from "../models";
import { ApiError, asyncRoute, limitQuery, ok, pageQuery } from "../lib/http";
import { requireRole } from "../middleware/auth";
import { publicArtwork, publicStore, serializeUser } from "../lib/serializers";
import { audit } from "../services/audit";
import { notify } from "../services/notifications";
import { releaseListingSlot } from "../services/plans";
import { getActivePlan } from "../services/plans";
import { PROMOTION_PRICES } from "../config/plans";
import { createCommissionForPaidOrder } from "../services/affiliates";

export const adminRouter = Router();
adminRouter.use(requireRole("admin"));

adminRouter.get(
  "/dashboard",
  asyncRoute(async (_req, res) => {
    const [
      totalUsers,
      artists,
      galleries,
      buyers,
      stores,
      artworks,
      publishedArtworks,
      pendingModeration,
      pendingVerification,
      openDisputes,
      orders,
      gmv,
      subscriptionRevenue,
      promotionRevenue,
      pendingPayouts,
      recentUsers,
      recentStores,
      recentArtworks,
      recentOrders,
      recentPromotions,
      auditLogs,
    ] = await Promise.all([
      UserModel.countDocuments({ status: { $ne: "deleted" } }),
      UserModel.countDocuments({ role: "artist", status: "active" }),
      UserModel.countDocuments({ role: "gallery", status: { $ne: "deleted" } }),
      UserModel.countDocuments({ role: "buyer", status: { $ne: "deleted" } }),
      StoreModel.countDocuments(),
      ArtworkModel.countDocuments(),
      ArtworkModel.countDocuments({ status: "published", moderationStatus: "approved" }),
      ArtworkModel.countDocuments({ moderationStatus: "pending" }),
      VerificationRequestModel.countDocuments({ status: { $in: ["pending", "under_review"] } }),
      DisputeModel.countDocuments({ status: { $in: ["open", "under_review"] } }),
      OrderModel.countDocuments(),
      OrderModel.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$buyerTotal" },
            commission: { $sum: "$platformCommission" },
            refunds: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, "$buyerTotal", 0] } },
          },
        },
      ]),
      PaymentModel.aggregate([
        { $match: { paymentType: "subscription", status: "successful" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      PaymentModel.aggregate([
        { $match: { paymentType: "promotion", status: "successful" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      PayoutModel.aggregate([
        { $match: { status: { $in: ["pending", "available", "processing"] } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$netAmount" } } },
      ]),
      UserModel.find({ status: { $ne: "deleted" } })
        .sort({ createdAt: -1 })
        .limit(100),
      StoreModel.find().sort({ createdAt: -1 }).limit(100).lean(),
      ArtworkModel.find().sort({ createdAt: -1 }).limit(100).lean(),
      OrderModel.find().sort({ createdAt: -1 }).limit(100).lean(),
      PromotionModel.find().sort({ createdAt: -1 }).limit(100).lean(),
      AuditLogModel.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .select("actorId actorRole action entityType entityId createdAt")
        .lean(),
    ]);
    return ok(res, {
      metrics: {
        totalUsers,
        artists,
        galleries,
        buyers,
        stores,
        artworks,
        publishedArtworks,
        pendingModeration,
        pendingVerification,
        openDisputes,
        orders,
        gmv: gmv[0]?.total ?? 0,
        commissionRevenue: gmv[0]?.commission ?? 0,
        refunds: gmv[0]?.refunds ?? 0,
        subscriptionRevenue: subscriptionRevenue[0]?.total ?? 0,
        promotionRevenue: promotionRevenue[0]?.total ?? 0,
        pendingPayouts: pendingPayouts[0]?.count ?? 0,
        pendingPayoutAmount: pendingPayouts[0]?.total ?? 0,
      },
      users: recentUsers.map(serializeUser),
      stores: recentStores.map(publicStore),
      artworks: recentArtworks.map(publicArtwork),
      orders: recentOrders.map(serializeAdminOrder),
      promotions: recentPromotions.map(serializeAdminPromotion),
      auditLogs: auditLogs.map((item) => ({
        id: String(item._id),
        actorId: item.actorId ? String(item.actorId) : undefined,
        actorRole: item.actorRole,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId ? String(item.entityId) : undefined,
        summary: `${item.action} · ${item.entityType}`,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  }),
);

adminRouter.patch(
  "/users/:id/status",
  asyncRoute(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["active", "suspended", "locked", "deleted"]) })
      .strict()
      .parse(req.body);
    const before = await UserModel.findById(req.params.id).lean();
    if (!before) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
    if (String(before._id) === String(req.auth!.user._id) && status !== "active")
      throw new ApiError(
        409,
        "SELF_SUSPENSION_NOT_ALLOWED",
        "You cannot suspend your own admin account",
      );
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { returnDocument: "after" },
    );
    await audit(
      req,
      "admin.user_status_changed",
      "User",
      user!._id,
      { status: before.status },
      { status },
    );
    await notify(
      user!._id,
      "account_status",
      "Account status updated",
      `Your ArtDera account is now ${status}.`,
    );
    return ok(res, serializeUser(user!), "User status updated");
  }),
);

adminRouter.patch(
  "/users/:id/password",
  asyncRoute(async (req, res) => {
    const input = z
      .object({ newPassword: z.string().min(8).max(128) })
      .strict()
      .parse(req.body);

    const user = await UserModel.findById(req.params.id).select("+passwordHash");
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found");

    // Hash the new password with bcrypt (cost 12 matching registration)
    user.passwordHash = await bcrypt.hash(input.newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    // Revoke all active sessions for this user so they must re-login
    await AuthSessionModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );

    await audit(req, "admin.user_password_changed", "User", user._id);
    await notify(
      user._id,
      "security_alert",
      "Password updated by admin",
      "Your password was recently updated by an administrator. If you did not request this, please contact support immediately.",
    );

    return ok(res, { success: true }, "User password updated successfully");
  }),
);

adminRouter.patch(
  "/artworks/:id/moderation",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        decision: z.enum(["approve", "reject"]),
        reason: z.string().trim().max(1000).optional(),
      })
      .strict()
      .refine((value) => value.decision !== "reject" || Boolean(value.reason), {
        message: "A rejection reason is required",
        path: ["reason"],
      })
      .parse(req.body);
    const artwork = await ArtworkModel.findById(req.params.id);
    if (!artwork) throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");
    const before = artwork.toObject();
    if (input.decision === "approve") {
      artwork.moderationStatus = "approved";
      artwork.status = "published";
      artwork.rejectionReason = undefined;
    } else {
      artwork.moderationStatus = "rejected";
      artwork.status = "rejected";
      artwork.rejectionReason = input.reason;
      const store = await StoreModel.findById(artwork.storeId).lean();
      if (store) await releaseListingSlot(store.ownerId);
    }
    await artwork.save();
    const store = await StoreModel.findById(artwork.storeId).lean();
    if (store)
      await notify(
        store.ownerId,
        input.decision === "approve" ? "artwork_approved" : "artwork_rejected",
        input.decision === "approve" ? "Artwork approved" : "Artwork needs changes",
        input.decision === "approve" ? `${artwork.title} is now live.` : input.reason!,
        "/artist/dashboard/artworks",
      );
    await audit(
      req,
      `admin.artwork_${input.decision}d`,
      "Artwork",
      artwork._id,
      before,
      artwork.toObject(),
    );
    return ok(res, publicArtwork(artwork.toObject()), `Artwork ${input.decision}d`);
  }),
);

adminRouter.patch(
  "/artworks/:id/image",
  asyncRoute(async (req, res) => {
    const input = z
      .object({ imageUrl: z.string().min(1) })
      .strict()
      .parse(req.body);
    const artwork = await ArtworkModel.findById(req.params.id);
    if (!artwork) throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");

    const before = artwork.toObject();
    if (artwork.images && artwork.images.length > 0) {
      artwork.images[0].url = input.imageUrl;
    } else {
      artwork.images = [{ url: input.imageUrl, width: 800, height: 1000 }] as any;
    }
    await artwork.save();

    await audit(
      req,
      "admin.artwork_image_updated",
      "Artwork",
      artwork._id,
      before,
      artwork.toObject(),
    );
    return ok(res, publicArtwork(artwork.toObject()), "Artwork image updated");
  }),
);

adminRouter.patch(
  "/verification/:id",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        decision: z.enum(["approve", "reject", "request_changes", "remove"]),
        reason: z.string().trim().max(1200).optional(),
        adminNotes: z.string().trim().max(3000).optional(),
      })
      .strict()
      .parse(req.body);
    const request = await VerificationRequestModel.findById(req.params.id).select("+adminNotes");
    if (!request)
      throw new ApiError(404, "VERIFICATION_NOT_FOUND", "Verification request not found");
    const status =
      input.decision === "approve"
        ? "approved"
        : input.decision === "request_changes"
          ? "changes_requested"
          : input.decision === "remove"
            ? "not_submitted"
            : "rejected";
    request.status = status;
    request.reviewedBy = req.auth!.user._id;
    request.reviewedAt = new Date();
    request.rejectionReason = input.reason;
    request.adminNotes = input.adminNotes;
    await request.save();
    const approved = status === "approved";
    await StoreModel.updateOne(
      { _id: request.storeId },
      { $set: { verificationStatus: approved ? "approved" : status } },
    );
    if (request.type === "gallery")
      await GalleryProfileModel.updateOne(
        { userId: request.userId },
        { $set: { verificationStatus: approved ? "approved" : status } },
      );
    else
      await ArtistProfileModel.updateOne(
        { userId: request.userId },
        {
          $set: { verificationStatus: approved ? "approved" : status, verificationBadge: approved },
        },
      );
    await notify(
      request.userId,
      approved ? "verification_approved" : "verification_updated",
      approved ? "Verification approved" : "Verification updated",
      approved
        ? "Your verified badge is now active."
        : (input.reason ?? "Your verification request was updated."),
      "/artist/dashboard/verification",
    );
    await audit(
      req,
      `admin.verification_${input.decision}`,
      "VerificationRequest",
      request._id,
      undefined,
      { status, reason: input.reason },
    );
    return ok(res, { id: String(request._id), status }, "Verification updated");
  }),
);

adminRouter.patch(
  "/promotions/:id",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        decision: z.enum(["approve", "reject", "cancel"]),
        reason: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(req.body);
    const promotion = await PromotionModel.findById(req.params.id);
    if (!promotion) throw new ApiError(404, "PROMOTION_NOT_FOUND", "Promotion not found");
    if (input.decision === "approve") {
      const paid = await PaymentModel.exists({ _id: promotion.paymentId, status: "successful" });
      if (!paid)
        throw new ApiError(409, "PAYMENT_NOT_SUCCESSFUL", "Promotion payment has not succeeded");
      promotion.status =
        promotion.startAt && promotion.startAt > new Date() ? "scheduled" : "active";
      promotion.approvedBy = req.auth!.user._id;
      promotion.approvedAt = new Date();
      if (promotion.status === "active" && promotion.artworkId)
        await ArtworkModel.updateOne(
          { _id: promotion.artworkId },
          { $set: { isSponsored: true, promotionId: promotion._id } },
        );
    } else {
      promotion.status = input.decision === "reject" ? "rejected" : "cancelled";
      promotion.rejectionReason = input.reason;
      if (promotion.artworkId)
        await ArtworkModel.updateOne(
          { _id: promotion.artworkId },
          { $set: { isSponsored: false }, $unset: { promotionId: 1 } },
        );
    }
    await promotion.save();
    await notify(
      promotion.userId,
      `promotion_${promotion.status}`,
      `Promotion ${promotion.status}`,
      input.reason ?? `Your promotion is ${promotion.status}.`,
      "/artist/dashboard/promotions",
    );
    await audit(req, `admin.promotion_${input.decision}d`, "Promotion", promotion._id);
    return ok(res, serializeAdminPromotion(promotion.toObject()), "Promotion updated");
  }),
);

adminRouter.patch(
  "/reviews/:id",
  asyncRoute(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["approved", "suspended", "rejected"]) })
      .strict()
      .parse(req.body);
    const review = await ReviewModel.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { returnDocument: "after" },
    ).lean();
    if (!review) throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found");
    const rating = await ReviewModel.aggregate([
      { $match: { storeId: review.storeId, status: "approved" } },
      { $group: { _id: "$storeId", rating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await StoreModel.updateOne(
      { _id: review.storeId },
      { $set: { rating: rating[0]?.rating ?? 0, reviewCount: rating[0]?.count ?? 0 } },
    );
    await audit(req, "admin.review_moderated", "Review", review._id, undefined, { status });
    return ok(res, { id: String(review._id), status }, "Review updated");
  }),
);

adminRouter.patch(
  "/payouts/:id",
  asyncRoute(async (req, res) => {
    const { status, providerReference } = z
      .object({
        status: z.enum(["on_hold", "available", "processing", "completed", "failed", "reversed"]),
        providerReference: z.string().trim().max(200).optional(),
      })
      .strict()
      .parse(req.body);
    const payout = await PayoutModel.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status,
          providerReference,
          ...(status === "completed" ? { processedAt: new Date() } : {}),
        },
      },
      { returnDocument: "after" },
    ).lean();
    if (!payout) throw new ApiError(404, "PAYOUT_NOT_FOUND", "Payout not found");
    await notify(
      payout.sellerId,
      status === "completed" ? "payout_completed" : "payout_updated",
      "Payout updated",
      `Your payout is now ${status}.`,
      "/artist/dashboard/payouts",
    );
    await audit(req, "admin.payout_updated", "Payout", payout._id, undefined, {
      status,
      providerReference,
    });
    return ok(res, { id: String(payout._id), status, providerReference }, "Payout updated");
  }),
);

adminRouter.patch(
  "/shipping-quotes/:id",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        status: z.enum(["quote_provided", "rejected"]),
        quotedShippingCost: z.number().nonnegative().optional(),
        quotedPackagingCost: z.number().nonnegative().optional(),
        estimatedDeliveryTime: z.string().trim().max(100).optional(),
        adminNotes: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(req.body);

    if (
      input.status === "quote_provided" &&
      (input.quotedShippingCost === undefined || input.quotedPackagingCost === undefined)
    ) {
      throw new ApiError(400, "INVALID_INPUT", "Must provide costs when quoting");
    }

    const quote = await ShippingQuoteModel.findById(req.params.id);
    if (!quote) throw new ApiError(404, "QUOTE_NOT_FOUND", "Shipping quote not found");

    quote.status = input.status;
    if (input.status === "quote_provided") {
      quote.quotedShippingCost = input.quotedShippingCost;
      quote.quotedPackagingCost = input.quotedPackagingCost;
      quote.estimatedDeliveryTime = input.estimatedDeliveryTime;
      quote.quoteProvidedAt = new Date();
    }
    quote.adminNotes = input.adminNotes;
    await quote.save();

    await notify(
      quote.buyerId,
      input.status === "quote_provided" ? "quote_ready" : "quote_rejected",
      input.status === "quote_provided"
        ? "Shipping quote ready"
        : "Shipping quote unable to be fulfilled",
      input.status === "quote_provided"
        ? `Your shipping quote for ${quote.country} is ready.`
        : `We are unable to fulfill your shipping quote request to ${quote.country}.`,
      "/account/quotes",
    );

    await audit(req, "admin.shipping_quote_updated", "ShippingQuote", quote._id, undefined, {
      status: input.status,
    });
    return ok(res, quote, "Shipping quote updated");
  }),
);

adminRouter.post(
  "/shipping-rules",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(120),
        baseCost: z.number().nonnegative(),
        perKgCost: z.number().nonnegative().default(0),
        fragileSurcharge: z.number().nonnegative().default(0),
        framingSurcharge: z.number().nonnegative().default(0),
        city: z.string().trim().max(100).optional(),
        province: z.string().trim().max(100).optional(),
        isActive: z.boolean().default(true),
      })
      .strict()
      .parse(req.body);
    const rule = await ShippingRuleModel.create(input);
    await audit(req, "admin.shipping_rule_created", "ShippingRule", rule._id);
    return ok(res, rule, "Shipping rule created", 201);
  }),
);

adminRouter.post(
  "/taxonomy",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        type: z.enum(["category", "medium", "style", "city", "province"]),
        name: z.string().trim().min(1).max(100),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        province: z.string().trim().max(100).optional(),
        isActive: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      })
      .strict()
      .parse(req.body);
    const item = await TaxonomyModel.create(input);
    await audit(req, "admin.taxonomy_created", "Taxonomy", item._id);
    return ok(res, item, "Taxonomy item created", 201);
  }),
);

adminRouter.post(
  "/collections",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(160),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        description: z.string().trim().max(2000).default(""),
        artworkIds: z.array(z.string()).max(200).default([]),
        coverImageUrl: z.string().max(1000).optional(),
        isPublished: z.boolean().default(false),
        sortOrder: z.number().int().default(0),
      })
      .strict()
      .parse(req.body);
    const item = await CollectionModel.create(input);
    await audit(req, "admin.collection_created", "Collection", item._id);
    return ok(res, item, "Collection created", 201);
  }),
);

adminRouter.patch(
  "/settings/:key",
  asyncRoute(async (req, res) => {
    const input = z
      .object({ value: z.unknown(), isPublic: z.boolean().default(false) })
      .strict()
      .parse(req.body);
    const setting = await SystemSettingModel.findOneAndUpdate(
      { key: req.params.key },
      { $set: { ...input, updatedBy: req.auth!.user._id } },
      { returnDocument: "after", upsert: true },
    ).lean();
    await audit(req, "admin.setting_updated", "SystemSetting", setting!._id, undefined, {
      key: req.params.key,
    });
    return ok(
      res,
      { key: setting!.key, value: setting!.value, isPublic: setting!.isPublic },
      "Setting updated",
    );
  }),
);

adminRouter.get(
  "/payment-proofs",
  asyncRoute(async (req, res) => {
    const status = z
      .enum(["pending_verification", "approved", "rejected", "information_requested"])
      .optional()
      .catch(undefined)
      .parse(req.query.status);
    const filter = status ? { status } : {};
    const proofs = await PaymentProofModel.find(filter).sort({ submittedAt: -1 }).limit(200).lean();
    const [orders, buyers, uploads, payments, promotions] = await Promise.all([
      OrderModel.find({
        _id: { $in: proofs.map((proof) => proof.orderId).filter(Boolean) },
      })
        .select("orderNumber")
        .lean(),
      UserModel.find({ _id: { $in: proofs.map((proof) => proof.buyerId) } })
        .select("fullName email")
        .lean(),
      UploadModel.find({ _id: { $in: proofs.map((proof) => proof.screenshotId) } })
        .select("url mimeType size")
        .lean(),
      PaymentModel.find({ _id: { $in: proofs.map((proof) => proof.paymentId) } })
        .select("paymentType metadata promotionId")
        .lean(),
      PromotionModel.find({
        _id: { $in: proofs.map((proof) => proof.promotionId).filter(Boolean) },
      })
        .select("placement promotionType")
        .lean(),
    ]);
    const orderById = new Map(orders.map((order) => [String(order._id), order]));
    const buyerById = new Map(buyers.map((buyer) => [String(buyer._id), buyer]));
    const uploadById = new Map(uploads.map((upload) => [String(upload._id), upload]));
    const paymentById = new Map(payments.map((payment) => [String(payment._id), payment]));
    const promotionById = new Map(
      promotions.map((promotion) => [String(promotion._id), promotion]),
    );
    return ok(
      res,
      proofs.map((proof) => {
        const order = orderById.get(String(proof.orderId));
        const buyer = buyerById.get(String(proof.buyerId));
        const screenshot = uploadById.get(String(proof.screenshotId));
        const payment = paymentById.get(String(proof.paymentId));
        const paymentType = proof.paymentType ?? payment?.paymentType ?? "order";
        const promotion = promotionById.get(String(proof.promotionId ?? payment?.promotionId));
        const referenceLabel =
          order?.orderNumber ??
          (paymentType === "subscription"
            ? `${String(payment?.metadata?.targetPlanId ?? "ArtDera").replaceAll("-", " ")} ${String(
                payment?.metadata?.billingCycle ?? "",
              )} subscription`
            : promotion?.placement || promotion?.promotionType || "ArtDera payment");
        return {
          id: String(proof._id),
          customerName: proof.customerName || buyer?.fullName,
          customerEmail: buyer?.email,
          orderId: order?.orderNumber,
          paymentType,
          referenceLabel,
          paymentId: String(proof.paymentId),
          method: proof.method,
          amount: proof.amount,
          mobileNumber: proof.mobileNumber,
          transactionId: proof.transactionId,
          screenshotUrl: screenshot?.url,
          screenshotMimeType: screenshot?.mimeType,
          screenshotSize: screenshot?.size,
          note: proof.note,
          status: proof.status,
          attempt: proof.attempt,
          submittedAt: proof.submittedAt?.toISOString?.() ?? proof.submittedAt,
          reviewReason: proof.reviewReason,
          reviewedAt: proof.reviewedAt?.toISOString?.() ?? proof.reviewedAt,
        };
      }),
    );
  }),
);

adminRouter.patch(
  "/payment-proofs/:id",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        action: z.enum(["approve", "reject", "request_information"]),
        reason: z.string().trim().max(1000).optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        if (value.action !== "approve" && (!value.reason || value.reason.length < 3))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["reason"],
            message: "A reason is required",
          });
      })
      .parse(req.body);
    const proof = await PaymentProofModel.findById(req.params.id);
    if (!proof) throw new ApiError(404, "PAYMENT_PROOF_NOT_FOUND", "Payment proof not found");
    if (proof.status !== "pending_verification" || !proof.isActive)
      throw new ApiError(
        409,
        "PAYMENT_PROOF_ALREADY_REVIEWED",
        "This payment proof has already been reviewed",
      );
    const payment = await PaymentModel.findById(proof.paymentId);
    if (!payment)
      throw new ApiError(409, "PAYMENT_RECORD_INCOMPLETE", "The related payment record is missing");
    const paymentType = proof.paymentType ?? payment.paymentType;
    const [order, subscription, promotion] = await Promise.all([
      payment.orderId ? OrderModel.findById(payment.orderId) : null,
      payment.subscriptionId ? SubscriptionModel.findById(payment.subscriptionId) : null,
      payment.promotionId ? PromotionModel.findById(payment.promotionId) : null,
    ]);
    if (
      (paymentType === "order" && !order) ||
      (paymentType === "subscription" && !subscription) ||
      (paymentType === "promotion" && !promotion)
    )
      throw new ApiError(
        409,
        "PAYMENT_RECORD_INCOMPLETE",
        "The related purchase record is missing",
      );
    if (payment.status === "successful")
      throw new ApiError(409, "PAYMENT_ALREADY_APPROVED", "This payment is already approved");
    const subscriptionTarget =
      paymentType === "subscription"
        ? await getActivePlan(
            String(payment.metadata?.targetPlanId ?? ""),
            String(payment.metadata?.billingCycle ?? ""),
          )
        : null;
    const now = new Date();
    const dbSession = await mongoose.startSession();
    let reviewedProof: any;
    let affiliateCommissionCreated = false;
    try {
      await dbSession.withTransaction(async () => {
        const nextProofStatus =
          input.action === "approve"
            ? "approved"
            : input.action === "request_information"
              ? "information_requested"
              : "rejected";
        reviewedProof = await PaymentProofModel.findOneAndUpdate(
          { _id: proof._id, status: "pending_verification", isActive: true },
          {
            $set: {
              status: nextProofStatus,
              reviewedBy: req.auth!.user._id,
              reviewedAt: now,
              reviewReason: input.reason,
              isActive: false,
            },
          },
          { returnDocument: "after", session: dbSession },
        );
        if (!reviewedProof)
          throw new ApiError(
            409,
            "PAYMENT_PROOF_ALREADY_REVIEWED",
            "This payment proof has already been reviewed",
          );
        if (input.action === "approve") {
          payment.status = "successful";
          payment.paidAt = now;
          payment.failureReason = undefined;
          if (paymentType === "order" && order) {
            order.paymentStatus = "paid";
            order.status = "payment_confirmed";
            for (const item of order.items) {
              const artwork = await ArtworkModel.findOneAndUpdate(
                {
                  _id: item.artworkId,
                  status: "reserved",
                  reservedBy: order.buyerId,
                  quantity: { $gte: item.quantity },
                },
                [
                  {
                    $set: {
                      quantity: { $subtract: ["$quantity", item.quantity] },
                      soldCount: { $add: [{ $ifNull: ["$soldCount", 0] }, item.quantity] },
                    },
                  },
                  {
                    $set: {
                      status: { $cond: [{ $lte: ["$quantity", 0] }, "sold", "published"] },
                    },
                  },
                  { $unset: ["reservedBy", "reservedUntil"] },
                ],
                { returnDocument: "after", session: dbSession, updatePipeline: true },
              );
              if (!artwork)
                throw new ApiError(
                  409,
                  "ARTWORK_RESERVATION_EXPIRED",
                  "The artwork reservation is no longer available. Review the order before approval.",
                );
            }
            await InvoiceModel.updateOne(
              { paymentId: payment._id },
              { $set: { status: "paid", paidAt: now } },
              { session: dbSession },
            );
            if (order.shippingQuoteId)
              await ShippingQuoteModel.updateOne(
                { _id: order.shippingQuoteId },
                { $set: { status: "paid" } },
                { session: dbSession },
              );
            affiliateCommissionCreated = await createCommissionForPaidOrder(
              order.toObject(),
              dbSession,
            );
          } else if (paymentType === "subscription" && subscription && subscriptionTarget) {
            const { plan, cycle, price } = subscriptionTarget;
            const currentPeriodEnd = new Date(now);
            if (cycle === "annual")
              currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
            else currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
            subscription.planId = plan.planId;
            subscription.billingCycle = cycle;
            subscription.status = "active";
            subscription.price = price;
            subscription.commissionRate = plan.commissionRate;
            subscription.listingLimit = plan.listingLimit;
            subscription.startedAt = now;
            subscription.currentPeriodStart = now;
            subscription.currentPeriodEnd = currentPeriodEnd;
            subscription.nextBillingAt = currentPeriodEnd;
            subscription.paymentProvider = "manual";
            subscription.featuresSnapshot = [...plan.permissions];
            subscription.pendingPlanId = undefined;
            subscription.pendingChangeAt = undefined;
            if (!(await InvoiceModel.exists({ paymentId: payment._id }).session(dbSession)))
              await InvoiceModel.create(
                [
                  {
                    invoiceNumber: `INV-${now.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
                    userId: payment.userId,
                    subscriptionId: subscription._id,
                    paymentId: payment._id,
                    items: [
                      {
                        description: `${plan.name} plan — ${cycle}`,
                        quantity: 1,
                        unitPrice: price,
                        total: price,
                      },
                    ],
                    subtotal: price,
                    discount: 0,
                    tax: 0,
                    total: price,
                    currency: "PKR",
                    status: "paid",
                    issuedAt: now,
                    paidAt: now,
                  },
                ],
                { session: dbSession },
              );
            await ListingQuotaModel.updateOne(
              { userId: payment.userId },
              { $setOnInsert: { activeListings: 0 } },
              { upsert: true, session: dbSession },
            );
          } else if (paymentType === "promotion" && promotion) {
            const pricing = PROMOTION_PRICES[promotion.promotionType];
            promotion.status = pricing.approval
              ? "pending_approval"
              : promotion.startAt && promotion.startAt > now
                ? "scheduled"
                : "active";
            if (promotion.status === "active" && promotion.artworkId)
              await ArtworkModel.updateOne(
                { _id: promotion.artworkId },
                { $set: { isSponsored: true, promotionId: promotion._id } },
                { session: dbSession },
              );
          }
        } else {
          const requestedInformation = input.action === "request_information";
          payment.status = requestedInformation ? "information_requested" : "rejected";
          payment.failureReason = input.reason;
          if (paymentType === "order" && order) {
            order.paymentStatus = requestedInformation ? "information_requested" : "rejected";
            order.status = "awaiting_payment";
            await ArtworkModel.updateMany(
              {
                _id: { $in: order.items.map((item: any) => item.artworkId) },
                status: "reserved",
                reservedBy: order.buyerId,
              },
              { $set: { reservedUntil: new Date(Date.now() + 7 * 24 * 60 * 60_000) } },
              { session: dbSession },
            );
          } else if (paymentType === "subscription" && subscription) {
            subscription.status = requestedInformation ? "payment_review" : "payment_failed";
          } else if (paymentType === "promotion" && promotion) {
            promotion.status = "pending_payment";
          }
        }
        await payment.save({ session: dbSession });
        if (order) await order.save({ session: dbSession });
        if (subscription) await subscription.save({ session: dbSession });
        if (promotion) await promotion.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }
    const referenceLabel =
      order?.orderNumber ??
      (paymentType === "subscription"
        ? `${subscriptionTarget?.plan.name ?? "ArtDera"} subscription`
        : promotion?.placement || "ArtDera promotion");
    const successUrl =
      paymentType === "order"
        ? "/account/orders"
        : paymentType === "subscription"
          ? "/artist/dashboard/subscription"
          : "/artist/dashboard/promotions";
    const resubmitUrl =
      paymentType === "order" ? `/checkout?paymentId=${payment._id}` : `/payment/${payment._id}`;
    if (input.action === "approve") {
      const notifications: Array<Promise<unknown>> = [
        notify(
          payment.userId,
          "payment_approved",
          "Payment confirmed",
          `Payment for ${referenceLabel} has been approved.`,
          successUrl,
        ),
      ];
      if (order) {
        notifications.push(
          notify(
            order.sellerId,
            "payment_approved",
            "Payment confirmed for your order",
            `${order.orderNumber} is paid and ready for confirmation.`,
            "/artist/dashboard/orders",
          ),
        );
        if (affiliateCommissionCreated && order.affiliateId) {
          const affiliate = await AffiliateModel.findById(order.affiliateId)
            .select("userId")
            .lean();
          if (affiliate)
            notifications.push(
              notify(
                affiliate.userId,
                "affiliate_sale_received",
                "Referral sale received",
                `Order ${order.orderNumber} generated a pending ambassador commission.`,
                "/account/ambassador",
              ),
            );
        }
      }
      await Promise.all(notifications);
    } else {
      const requestedInformation = input.action === "request_information";
      const title = requestedInformation
        ? "More payment information requested"
        : "Payment proof was not approved";
      const message = `${title} for ${referenceLabel}. ${input.reason}`;
      await notify(
        payment.userId,
        requestedInformation ? "payment_information_requested" : "payment_rejected",
        title,
        message,
        resubmitUrl,
      );
    }
    await audit(
      req,
      `admin.payment_proof_${input.action}`,
      "PaymentProof",
      proof._id,
      { status: "pending_verification" },
      { status: reviewedProof.status, reason: input.reason, paymentType },
    );
    return ok(
      res,
      {
        id: String(proof._id),
        status: reviewedProof.status,
        paymentStatus:
          payment.status === "successful"
            ? "Paid"
            : payment.status === "information_requested"
              ? "More Information Requested"
              : "Rejected",
        purchaseStatus: order?.status ?? subscription?.status ?? promotion?.status,
        orderStatus: order
          ? order.status === "payment_confirmed"
            ? "Payment Confirmed"
            : "Awaiting Payment"
          : undefined,
      },
      input.action === "approve"
        ? "Payment approved"
        : input.action === "reject"
          ? "Payment rejected"
          : "More information requested",
    );
  }),
);

adminRouter.get(
  "/resources/:resource",
  asyncRoute(async (req, res) => {
    const page = pageQuery(req.query.page);
    const limit = limitQuery(req.query.limit, 25, 100);
    const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const userRole = z
      .enum(["buyer", "artist", "gallery", "gallery_staff", "admin", "moderator", "support"])
      .optional()
      .catch(undefined)
      .parse(req.query.role);
    const userStatus = z
      .enum(["pending_verification", "active", "suspended", "locked", "deleted"])
      .optional()
      .catch(undefined)
      .parse(req.query.status);
    const resources: Record<string, { model: any; searchFields?: string[]; select?: string }> = {
      users: { model: UserModel, searchFields: ["fullName", "email"] },
      stores: { model: StoreModel, searchFields: ["name", "slug"] },
      artworks: { model: ArtworkModel, searchFields: ["title", "slug"] },
      verifications: { model: VerificationRequestModel },
      orders: { model: OrderModel, searchFields: ["orderNumber"] },
      payments: { model: PaymentModel, searchFields: ["providerReference"] },
      promotions: { model: PromotionModel },
      subscriptions: { model: SubscriptionModel },
      payouts: { model: PayoutModel },
      shipments: { model: ShipmentModel, searchFields: ["trackingNumber"] },
      reviews: { model: ReviewModel },
      disputes: { model: DisputeModel },
      categories: { model: TaxonomyModel },
      collections: { model: CollectionModel },
      exhibitions: { model: ExhibitionModel },
      leads: { model: CorporateLeadModel, searchFields: ["name", "company", "email"] },
      content: { model: ContentPageModel, searchFields: ["title", "slug"] },
      support: { model: SupportTicketModel, searchFields: ["ticketNumber", "subject"] },
      notifications: { model: NotificationModel, searchFields: ["title"] },
      newsletters: { model: NewsletterSubscriptionModel, searchFields: ["email"] },
      invoices: { model: InvoiceModel, searchFields: ["invoiceNumber"] },
      audit: {
        model: AuditLogModel,
        searchFields: ["action", "entityType"],
        select: "actorId actorRole action entityType entityId createdAt",
      },
      shippingRules: { model: ShippingRuleModel },
      shippingQuotes: {
        model: ShippingQuoteModel,
        searchFields: ["buyerName", "buyerEmail", "country"],
      },
      settings: { model: SystemSettingModel },
      conversations: { model: ConversationModel },
      messages: { model: MessageModel },
      analytics: { model: AnalyticsEventModel },
    };
    const resource = String(req.params.resource);
    const config = resources[resource];
    if (!config) throw new ApiError(404, "RESOURCE_NOT_FOUND", "Admin resource not found");
    const filterClauses: Record<string, unknown>[] = [];
    if (search && config.searchFields)
      filterClauses.push({
        $or: config.searchFields.map((field: string) => ({
          [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
        })),
      });
    if (resource === "users" && userRole) filterClauses.push({ role: userRole });
    if (resource === "users" && userStatus) filterClauses.push({ status: userStatus });
    const filter = filterClauses.length > 1 ? { $and: filterClauses } : (filterClauses[0] ?? {});
    let query = config.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    if (config.select) query = query.select(config.select);
    const [items, total] = await Promise.all([query, config.model.countDocuments(filter)]);
    let safeItems: any[];
    if (resource === "users") {
      safeItems = items.map(serializeUser);
    } else if (resource === "stores") {
      safeItems = items.map(publicStore);
    } else if (resource === "artworks") {
      safeItems = items.map(publicArtwork);
    } else if (resource === "verifications") {
      const userIds = items.map((item: any) => item.userId).filter(Boolean);
      const storeIds = items.map((item: any) => item.storeId).filter(Boolean);
      const docIds = items.flatMap((item: any) => item.documentReferences ?? []).filter(Boolean);

      const [users, stores, uploads] = await Promise.all([
        UserModel.find({ _id: { $in: userIds } })
          .select("fullName email mobile city role")
          .lean(),
        StoreModel.find({ _id: { $in: storeIds } })
          .select("name slug")
          .lean(),
        UploadModel.find({ _id: { $in: docIds } })
          .select("url publicId originalName mimeType size")
          .lean(),
      ]);

      const userMap = new Map(users.map((u) => [String(u._id), u]));
      const storeMap = new Map(stores.map((s) => [String(s._id), s]));
      const uploadMap = new Map(uploads.map((u) => [String(u._id), u]));

      safeItems = items.map((item: any) => {
        const u = userMap.get(String(item.userId));
        const s = storeMap.get(String(item.storeId));
        const docObjs = (item.documentReferences ?? []).map((id: any) => {
          const doc = uploadMap.get(String(id));
          return doc
            ? {
                id: String(doc._id),
                publicId: doc.publicId,
                url: doc.url,
                originalName: doc.originalName,
                mimeType: doc.mimeType,
                size: doc.size,
                downloadUrl: `/api/uploads/${doc.publicId}/download`,
              }
            : { id: String(id) };
        });

        return {
          id: String(item._id),
          userId: String(item.userId),
          storeId: item.storeId ? String(item.storeId) : undefined,
          type: item.type ?? "artist",
          status: item.status ?? "pending",
          submittedData: item.submittedData ?? {},
          documentReferences: item.documentReferences ?? [],
          documents: docObjs,
          user: u
            ? {
                id: String(u._id),
                fullName: u.fullName,
                email: u.email,
                mobile: u.mobile,
                city: u.city,
                role: u.role,
              }
            : undefined,
          store: s
            ? {
                id: String(s._id),
                name: s.name,
                slug: s.slug,
              }
            : undefined,
          createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
          updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
          rejectionReason: item.rejectionReason,
          adminNotes: item.adminNotes,
        };
      });
    } else {
      safeItems = items.map((item: any) => ({
        ...item,
        id: String(item._id),
        _id: undefined,
        passwordHash: undefined,
        emailNormalized: undefined,
        phoneNormalized: undefined,
        submittedData: undefined,
        documentReferences: undefined,
        adminNotes: undefined,
        before: undefined,
        after: undefined,
      }));
    }
    return ok(res, { items: safeItems, page, limit, total, pages: Math.ceil(total / limit) });
  }),
);

function serializeAdminOrder(value: Record<string, any>) {
  return {
    id: String(value._id),
    orderNumber: value.orderNumber,
    buyerId: String(value.buyerId),
    sellerId: String(value.sellerId),
    storeId: String(value.storeId),
    status: String(value.status)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    paymentStatus: value.paymentStatus,
    subtotal: value.artworkSubtotal,
    shipping: value.shippingCost,
    commission: value.platformCommission,
    total: value.buyerTotal,
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
  };
}

function serializeAdminPromotion(value: Record<string, any>) {
  return {
    id: String(value._id),
    userId: String(value.userId),
    storeId: String(value.storeId),
    artworkId: value.artworkId ? String(value.artworkId) : undefined,
    placementId: value.promotionType,
    status: String(value.status)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    startDate: value.startAt?.toISOString?.() ?? value.startAt,
    endDate: value.endAt?.toISOString?.() ?? value.endAt,
    price: value.price,
    impressions: value.impressions,
    clicks: value.clicks,
    saves: value.saves,
    messages: value.messages,
  };
}
