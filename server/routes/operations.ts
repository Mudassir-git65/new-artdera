import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  AnalyticsEventModel,
  ArtworkModel,
  NotificationModel,
  NewsletterSubscriptionModel,
  NotificationPreferenceModel,
  OrderModel,
  PaymentModel,
  PromotionModel,
  StoreModel,
  SubscriptionModel,
  SupportTicketModel,
  VerificationRequestModel,
  UserDraftModel,
} from "../models";
import { ApiError, asyncRoute, ok } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { PROMOTION_PRICES } from "../config/plans";
import { paymentProvider } from "../services/payments";
import { getEnv } from "../config/env";
import {
  MANUAL_PAYMENT_INSTRUCTION,
  manualPaymentAccount,
  type ManualPaymentMethod,
} from "../services/manual-payments";
import { audit } from "../services/audit";
import { notify } from "../services/notifications";
import { normalizeEmail, sanitizeText } from "../lib/security";
import { requirePermission } from "../services/plans";

export const operationsRouter = Router();

operationsRouter.post(
  "/newsletter",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        email: z.string().email().max(254),
        source: z.string().trim().max(80).default("website"),
      })
      .strict()
      .parse(req.body);
    const emailNormalized = normalizeEmail(input.email);
    await NewsletterSubscriptionModel.updateOne(
      { emailNormalized },
      {
        $set: {
          email: emailNormalized,
          emailNormalized,
          source: input.source,
          status: "subscribed",
          subscribedAt: new Date(),
          userId: req.auth?.user._id,
        },
        $unset: { unsubscribedAt: 1 },
      },
      { upsert: true, runValidators: true },
    );
    return ok(res, { subscribed: true }, "Newsletter preference saved", 201);
  }),
);

operationsRouter.get(
  "/drafts/:key",
  requireAuth,
  asyncRoute(async (req, res) => {
    const key = z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .parse(req.params.key);
    const draft = await UserDraftModel.findOne({ userId: req.auth!.user._id, key }).lean();
    return ok(res, draft?.data ?? null);
  }),
);

operationsRouter.patch(
  "/drafts/:key",
  requireAuth,
  asyncRoute(async (req, res) => {
    const key = z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .parse(req.params.key);
    const { data } = z.object({ data: z.unknown() }).strict().parse(req.body);
    const draft = await UserDraftModel.findOneAndUpdate(
      { userId: req.auth!.user._id, key },
      { $set: { data, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000) } },
      { returnDocument: "after", upsert: true },
    ).lean();
    return ok(res, draft!.data, "Draft saved");
  }),
);

operationsRouter.delete(
  "/drafts/:key",
  requireAuth,
  asyncRoute(async (req, res) => {
    const key = z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .parse(req.params.key);
    await UserDraftModel.deleteOne({ userId: req.auth!.user._id, key });
    return ok(res, { key }, "Draft cleared");
  }),
);

operationsRouter.get(
  "/promotions",
  requireAuth,
  asyncRoute(async (req, res) => {
    const filter = req.auth!.user.role === "admin" ? {} : { userId: req.auth!.user._id };
    const promotions = await PromotionModel.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, promotions.map(serializePromotion));
  }),
);

operationsRouter.post(
  "/promotions",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        artworkId: z.string().optional(),
        promotionType: z.enum([
          "boost_3",
          "boost_7",
          "category_top",
          "featured_artist",
          "homepage",
          "social",
          "newsletter",
        ]),
        requestedPrice: z.number().nonnegative().optional(),
        placement: z.string().trim().min(1).max(120).optional(),
        startAt: z.coerce.date().optional(),
        method: z.enum(["easypaisa", "jazzcash"]).default("jazzcash"),
      })
      .strict()
      .parse(req.body);
    const store = await StoreModel.findOne({ ownerId: req.auth!.user._id, isPublished: true });
    if (!store)
      throw new ApiError(404, "STORE_NOT_FOUND", "Publish your store before promoting it");
    if (
      input.artworkId &&
      !(await ArtworkModel.exists({
        _id: input.artworkId,
        storeId: store._id,
        status: "published",
      }))
    )
      throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");
    const pricing = PROMOTION_PRICES[input.promotionType];
    const price = pricing.minimum === pricing.maximum ? pricing.minimum : input.requestedPrice;
    if (price === undefined || price < pricing.minimum || price > pricing.maximum)
      throw new ApiError(
        422,
        "INVALID_PROMOTION_PRICE",
        `Choose an amount from PKR ${pricing.minimum.toLocaleString("en-PK")} to PKR ${pricing.maximum.toLocaleString("en-PK")}`,
      );
    const startAt = input.startAt ?? new Date();
    const endAt = new Date(startAt.getTime() + pricing.durationDays * 24 * 60 * 60_000);
    const promotion = await PromotionModel.create({
      userId: req.auth!.user._id,
      storeId: store._id,
      artworkId: input.artworkId,
      promotionType: input.promotionType,
      placement: input.placement ?? input.promotionType,
      price,
      currency: "PKR",
      startAt,
      endAt,
      status: "pending_payment",
    });
    const intent = {
      reference: `manual_promotion_${randomUUID()}`,
      amount: price,
      currency: "PKR" as const,
      status: "pending" as const,
    };
    const payment = await PaymentModel.create({
      userId: req.auth!.user._id,
      promotionId: promotion._id,
      paymentType: "promotion",
      provider: "manual",
      providerReference: intent.reference,
      amount: price,
      currency: "PKR",
      status: "pending",
      metadata: { method: input.method },
    });
    promotion.paymentId = payment._id;
    await promotion.save();
    await audit(req, "promotion.created", "Promotion", promotion._id, undefined, {
      type: promotion.promotionType,
      price,
    });
    return ok(
      res,
      {
        promotion: serializePromotion(promotion.toObject()),
        payment: {
          id: String(payment._id),
          amount: payment.amount,
          reference: payment.providerReference,
          status: "Pending Review",
          paymentInstructions: {
            ...manualPaymentAccount(input.method as ManualPaymentMethod),
            amount: price,
            paymentId: String(payment._id),
            referenceLabel: `${promotion.placement} promotion`,
            instruction: MANUAL_PAYMENT_INSTRUCTION,
          },
        },
      },
      "Promotion payment created",
      201,
    );
  }),
);

operationsRouter.post(
  "/promotions/:id/confirm-demo",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    if (!getEnv().DEMO_PAYMENT_MODE)
      throw new ApiError(404, "NOT_FOUND", "The requested resource was not found");
    const { outcome } = z
      .object({ outcome: z.enum(["success", "failure"]).default("success") })
      .strict()
      .parse(req.body);
    const promotion = await PromotionModel.findOne({
      _id: req.params.id,
      userId: req.auth!.user._id,
    });
    if (!promotion) throw new ApiError(404, "PROMOTION_NOT_FOUND", "Promotion not found");
    const payment = await PaymentModel.findOne({
      _id: promotion.paymentId,
      userId: req.auth!.user._id,
    });
    if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    const verified = await paymentProvider().verifyPayment(payment.providerReference, outcome);
    if (!verified.successful) {
      payment.status = "failed";
      payment.failureReason = verified.failureReason;
      await payment.save();
      return ok(res, serializePromotion(promotion.toObject()), "Promotion payment failed");
    }
    payment.status = "successful";
    payment.paidAt = verified.paidAt ?? new Date();
    const pricing = PROMOTION_PRICES[promotion.promotionType];
    promotion.status = pricing.approval
      ? "pending_approval"
      : promotion.startAt && promotion.startAt > new Date()
        ? "scheduled"
        : "active";
    await Promise.all([payment.save(), promotion.save()]);
    if (promotion.status === "active" && promotion.artworkId)
      await ArtworkModel.updateOne(
        { _id: promotion.artworkId },
        { $set: { isSponsored: true, promotionId: promotion._id } },
      );
    await notify(
      req.auth!.user._id,
      "promotion_submitted",
      "Promotion submitted",
      pricing.approval
        ? "Your promotion is awaiting editorial approval."
        : "Your promotion is active.",
      "/artist/dashboard/promotions",
    );
    return ok(res, serializePromotion(promotion.toObject()), "Promotion payment successful");
  }),
);

operationsRouter.get(
  "/notifications",
  requireAuth,
  asyncRoute(async (req, res) => {
    const notifications = await NotificationModel.find({ userId: req.auth!.user._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return ok(
      res,
      notifications.map((item) => ({
        id: String(item._id),
        userId: String(item.userId),
        type: item.type,
        title: item.title,
        body: item.message,
        read: item.isRead,
        createdAt: item.createdAt.toISOString(),
        href: item.link,
        metadata: item.metadata,
      })),
    );
  }),
);

operationsRouter.patch(
  "/notifications/:id/read",
  requireAuth,
  asyncRoute(async (req, res) => {
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.auth!.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!notification) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
    return ok(res, { id: String(notification._id), read: true });
  }),
);

operationsRouter.post(
  "/notifications/read-all",
  requireAuth,
  asyncRoute(async (req, res) => {
    await NotificationModel.updateMany(
      { userId: req.auth!.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return ok(res, { read: true }, "All notifications marked read");
  }),
);

operationsRouter.delete(
  "/notifications/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await NotificationModel.deleteOne({
      _id: req.params.id,
      userId: req.auth!.user._id,
    });
    if (!result.deletedCount)
      throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
    return ok(res, { id: req.params.id }, "Notification deleted");
  }),
);

operationsRouter.get(
  "/notification-preferences",
  requireAuth,
  asyncRoute(async (req, res) => {
    const preferences = await NotificationPreferenceModel.findOne({
      userId: req.auth!.user._id,
    }).lean();
    return ok(res, serializeNotificationPreferences(preferences));
  }),
);

operationsRouter.patch(
  "/notification-preferences",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        email: z.boolean().optional(),
        inApp: z.boolean().optional(),
        marketing: z.boolean().optional(),
        orderUpdates: z.boolean().optional(),
        messageUpdates: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    const preferences = await NotificationPreferenceModel.findOneAndUpdate(
      { userId: req.auth!.user._id },
      { $set: input, $setOnInsert: { userId: req.auth!.user._id } },
      { returnDocument: "after", upsert: true },
    ).lean();
    return ok(
      res,
      serializeNotificationPreferences(preferences),
      "Notification preferences updated",
    );
  }),
);

operationsRouter.get(
  "/support",
  requireAuth,
  asyncRoute(async (req, res) => {
    const filter =
      req.auth!.user.role === "admin" || req.auth!.user.role === "support"
        ? {}
        : { userId: req.auth!.user._id };
    const tickets = await SupportTicketModel.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return ok(res, tickets.map(serializeTicket));
  }),
);

operationsRouter.post(
  "/support",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        category: z.string().trim().min(2).max(100),
        subject: z.string().trim().min(3).max(180),
        description: z.string().trim().min(10).max(5000),
        priority: z.enum(["low", "normal", "high"]).default("normal"),
      })
      .strict()
      .parse(req.body);
    const ticket = await SupportTicketModel.create({
      ticketNumber: `SUP-${Date.now().toString(36).toUpperCase()}`,
      userId: req.auth!.user._id,
      category: sanitizeText(input.category, 100),
      subject: sanitizeText(input.subject, 180),
      description: sanitizeText(input.description, 5000),
      priority: input.priority,
      status: "open",
    });
    return ok(res, serializeTicket(ticket.toObject()), "Support ticket created", 201);
  }),
);

operationsRouter.post(
  "/support/:id/messages",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { message } = z
      .object({ message: z.string().trim().min(1).max(3000) })
      .strict()
      .parse(req.body);
    const filter: Record<string, unknown> = { _id: req.params.id };
    if (!["admin", "support"].includes(req.auth!.user.role)) filter.userId = req.auth!.user._id;
    const ticket = await SupportTicketModel.findOneAndUpdate(
      filter,
      {
        $push: {
          messages: {
            senderId: req.auth!.user._id,
            message: sanitizeText(message, 3000),
            createdAt: new Date(),
          },
        },
        $set: { status: ["admin", "support"].includes(req.auth!.user.role) ? "waiting" : "open" },
      },
      { returnDocument: "after" },
    ).lean();
    if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "Support ticket not found");
    if (["admin", "support"].includes(req.auth!.user.role))
      await notify(
        ticket.userId,
        "support_response",
        "Support replied",
        `There is a new response on ${ticket.ticketNumber}.`,
        `/account/support`,
      );
    return ok(res, serializeTicket(ticket), "Reply added");
  }),
);

operationsRouter.get(
  "/verification",
  requireAuth,
  asyncRoute(async (req, res) => {
    const filter = req.auth!.user.role === "admin" ? {} : { userId: req.auth!.user._id };
    const requests = await VerificationRequestModel.find(filter)
      .select("+submittedData +documentReferences")
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, requests.map(serializeVerification));
  }),
);

operationsRouter.post(
  "/verification",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        storeId: z.string(),
        type: z.enum(["artist", "gallery"]),
        submittedData: z.record(z.unknown()).default({}),
        documentReferences: z.array(z.string()).max(20).default([]),
      })
      .strict()
      .parse(req.body);
    if (input.type !== req.auth!.user.role)
      throw new ApiError(403, "FORBIDDEN", "Verification type does not match your account");
    if (!(await StoreModel.exists({ _id: input.storeId, ownerId: req.auth!.user._id })))
      throw new ApiError(404, "STORE_NOT_FOUND", "Store not found");
    const request = await VerificationRequestModel.findOneAndUpdate(
      { userId: req.auth!.user._id, type: input.type },
      {
        $set: {
          storeId: input.storeId,
          submittedData: input.submittedData,
          documentReferences: input.documentReferences,
          status: "pending",
        },
        $unset: { rejectionReason: 1, reviewedAt: 1, reviewedBy: 1 },
      },
      { returnDocument: "after", upsert: true },
    ).lean();
    await notify(
      req.auth!.user._id,
      "verification_submitted",
      "Verification submitted",
      "Your verification request is awaiting review.",
      "/artist/dashboard/verification",
    );
    return ok(res, serializeVerification(request!), "Verification submitted", 201);
  }),
);

operationsRouter.get(
  "/analytics",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const range = z.enum(["today", "7d", "30d", "3m", "1y"]).catch("30d").parse(req.query.range);
    const days =
      range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : range === "3m" ? 90 : 365;
    const from = new Date(Date.now() - days * 24 * 60 * 60_000);
    const stores = await StoreModel.find({ ownerId: req.auth!.user._id })
      .select("_id totalViews")
      .lean();
    const storeIds = stores.map((store) => store._id);
    const [events, orders, artworkStats] = await Promise.all([
      AnalyticsEventModel.aggregate([
        { $match: { storeId: { $in: storeIds }, createdAt: { $gte: from } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              type: "$type",
            },
            count: { $sum: 1 },
            value: { $sum: "$value" },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),
      OrderModel.find({ sellerId: req.auth!.user._id, createdAt: { $gte: from } }).lean(),
      ArtworkModel.aggregate([
        { $match: { storeId: { $in: storeIds } } },
        {
          $group: {
            _id: null,
            views: { $sum: "$views" },
            saves: { $sum: "$wishlistCount" },
            messages: { $sum: "$messageCount" },
          },
        },
      ]),
    ]);
    const metrics = {
      storeViews: stores.reduce((sum, store) => sum + store.totalViews, 0),
      artworkViews: artworkStats[0]?.views ?? 0,
      uniqueVisitors: events
        .filter((event) => event._id.type === "store_view" || event._id.type === "artwork_view")
        .reduce((sum, event) => sum + event.count, 0),
      saves: artworkStats[0]?.saves ?? 0,
      messages: artworkStats[0]?.messages ?? 0,
      offers: events
        .filter((event) => event._id.type === "offer")
        .reduce((sum, event) => sum + event.count, 0),
      videoRequests: events
        .filter((event) => event._id.type === "video_request")
        .reduce((sum, event) => sum + event.count, 0),
      orders: orders.length,
      revenue: orders
        .filter((order) => !["cancelled", "refunded"].includes(order.status))
        .reduce((sum, order) => sum + order.artworkSubtotal, 0),
      estimatedCommission: orders.reduce((sum, order) => sum + order.platformCommission, 0),
      estimatedPayout: orders.reduce((sum, order) => sum + order.sellerNetAmount, 0),
    };
    return ok(res, { range, from, metrics, series: events });
  }),
);

operationsRouter.get(
  "/customers",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    await requirePermission(req.auth!.user._id, "customers");
    const orders = await OrderModel.aggregate([
      { $match: { sellerId: req.auth!.user._id, status: "completed" } },
      {
        $group: {
          _id: "$buyerId",
          completedOrders: { $sum: 1 },
          totalSpending: { $sum: "$buyerTotal" },
          lastPurchase: { $max: "$completedAt" },
          city: { $last: "$shippingAddress.city" },
        },
      },
      { $sort: { lastPurchase: -1 } },
      { $limit: 500 },
    ]);
    return ok(
      res,
      orders.map((entry) => ({
        id: `buyer-${entry._id}`,
        sellerId: String(req.auth!.user._id),
        buyerId: String(entry._id),
        buyerName: "Collector",
        completedOrders: entry.completedOrders,
        totalSpending: entry.totalSpending,
        lastPurchase: entry.lastPurchase,
        favouriteCategory: "",
        notes: "",
        tags: [],
        city: entry.city ?? "",
        country: "Pakistan",
        marketingConsent: false,
        contactVisible: true,
      })),
    );
  }),
);

function serializePromotion(value: Record<string, any>) {
  const labels: Record<string, string> = {
    draft: "Draft",
    pending_payment: "Pending",
    pending_approval: "Pending",
    scheduled: "Scheduled",
    active: "Active",
    completed: "Completed",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return {
    id: String(value._id),
    paymentId: value.paymentId ? String(value.paymentId) : undefined,
    artworkId: value.artworkId ? String(value.artworkId) : undefined,
    storeId: String(value.storeId),
    placementId: value.promotionType,
    promotionType: value.promotionType,
    status: labels[value.status] ?? value.status,
    startDate: value.startAt?.toISOString?.() ?? value.startAt,
    endDate: value.endAt?.toISOString?.() ?? value.endAt,
    price: value.price,
    impressions: value.impressions,
    clicks: value.clicks,
    saves: value.saves,
    messages: value.messages,
    conversions: 0,
    rejectionReason: value.rejectionReason,
  };
}

function serializeTicket(value: Record<string, any>) {
  return {
    id: String(value._id),
    ticketNumber: value.ticketNumber,
    userId: String(value.userId),
    subject: value.subject,
    category: value.category,
    description: value.description,
    priority: String(value.priority).replace(/^./, (c) => c.toUpperCase()),
    status: value.status === "open" ? "Open" : value.status === "waiting" ? "Waiting" : "Resolved",
    messages: value.messages ?? [],
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
  };
}

function serializeVerification(value: Record<string, any>) {
  const label: Record<string, string> = {
    not_submitted: "Not Submitted",
    pending: "Pending Review",
    under_review: "Pending Review",
    approved: "Approved",
    changes_requested: "Changes Requested",
    rejected: "Rejected",
  };
  return {
    id: String(value._id),
    userId: String(value.userId),
    sellerId: String(value.userId),
    storeId: value.storeId ? String(value.storeId) : undefined,
    type: value.type === "gallery" ? "Gallery" : "Artist",
    status: value.status ?? "pending",
    identityStatus: label[value.status] ?? value.status,
    portfolioStatus: label[value.status] ?? value.status,
    phoneVerified: Boolean(value.submittedData?.phoneVerified),
    emailVerified: true,
    ownershipDeclared: Boolean(value.submittedData?.ownershipDeclared),
    submittedData: value.submittedData ?? {},
    documentReferences: (value.documentReferences ?? []).map(String),
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
    submittedAt: value.createdAt?.toISOString?.() ?? value.createdAt,
    rejectionReason: value.rejectionReason,
  };
}

function serializeNotificationPreferences(value?: Record<string, any> | null) {
  return {
    email: value?.email ?? true,
    inApp: value?.inApp ?? true,
    marketing: value?.marketing ?? false,
    orderUpdates: value?.orderUpdates ?? true,
    messageUpdates: value?.messageUpdates ?? true,
  };
}
