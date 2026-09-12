import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  AffiliateActivityModel,
  AffiliateCommissionModel,
  AffiliateModel,
  AffiliatePayoutModel,
  ArtworkModel,
  CartModel,
  OrderModel,
  ShippingQuoteModel,
  StoreModel,
  SubscriptionModel,
  SystemSettingModel,
  UserModel,
} from "../models";
import { getEnv } from "../config/env";
import { ApiError, asyncRoute, limitQuery, ok, pageQuery } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { sanitizeText } from "../lib/security";
import { audit } from "../services/audit";
import { notify } from "../services/notifications";
import {
  AFFILIATE_SETTINGS_KEY,
  affiliatePricing,
  captureAffiliateReferral,
  getAffiliateSettings,
  minimumPayoutPkr,
  normalizeAffiliateCode,
  reconcileAffiliateCommissions,
  resolveAffiliateAttribution,
  uniqueAffiliateCode,
} from "../services/affiliates";

export const affiliatesRouter = Router();
export const adminAffiliatesRouter = Router();

const codeSchema = z
  .string()
  .trim()
  .min(5)
  .max(20)
  .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only");

affiliatesRouter.get(
  "/program",
  asyncRoute(async (_req, res) => {
    const settings = await getAffiliateSettings();
    return ok(res, {
      enabled: settings.enabled,
      commissionRate: settings.defaultCommissionRate,
      buyerDiscountRate: settings.defaultBuyerDiscountRate,
      attributionDays: settings.attributionDays,
      minimumPayoutUsd: settings.minimumPayoutUsd,
    });
  }),
);

affiliatesRouter.post(
  "/referrals/capture",
  asyncRoute(async (req, res) => {
    const input = z
      .object({ code: codeSchema, landingPage: z.string().trim().max(500).default("/") })
      .strict()
      .parse(req.body);
    const result = await captureAffiliateReferral(req, res, input.code, input.landingPage, "url");
    return ok(res, result, result.preserved ? "Existing referral preserved" : "Referral recorded");
  }),
);

affiliatesRouter.post(
  "/checkout-preview",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        code: codeSchema.optional(),
        shippingQuoteId: z.string().optional(),
      })
      .strict()
      .parse(req.body ?? {});
    if (input.code) await captureAffiliateReferral(req, res, input.code, "/checkout", "code");
    const attribution = await resolveAffiliateAttribution(req, input.code);

    let cartItems: Array<{ artworkId: unknown; quantity: number }> = [];
    let shipping = 0;
    let packaging = 0;
    if (input.shippingQuoteId) {
      const quote = await ShippingQuoteModel.findOne({
        _id: input.shippingQuoteId,
        buyerId: req.auth!.user._id,
        status: "accepted",
      }).lean();
      if (!quote) throw new ApiError(404, "QUOTE_NOT_FOUND", "Accepted shipping quote not found");
      cartItems = [{ artworkId: quote.artworkId, quantity: quote.quantity }];
      shipping = quote.quotedShippingCost ?? 0;
      packaging = quote.quotedPackagingCost ?? 0;
    } else {
      const cart = await CartModel.findOne({ buyerId: req.auth!.user._id }).lean();
      if (!cart?.items.length) throw new ApiError(422, "CART_EMPTY", "Your cart is empty");
      cartItems = cart.items.map((item: { artworkId: unknown; quantity: number }) => ({
        artworkId: item.artworkId,
        quantity: item.quantity,
      }));
    }
    const artworks = await ArtworkModel.find({
      _id: { $in: cartItems.map((item) => item.artworkId) },
    }).lean();
    const itemMap = new Map(cartItems.map((item) => [String(item.artworkId), item]));
    const storeIds = [...new Set(artworks.map((artwork) => String(artwork.storeId)))];
    const stores = await StoreModel.find({ _id: { $in: storeIds } })
      .select("ownerId")
      .lean();
    const subscriptions = await SubscriptionModel.find({
      userId: { $in: stores.map((store) => store.ownerId) },
      status: "active",
    })
      .select("userId commissionRate")
      .lean();
    const storeOwner = new Map(stores.map((store) => [String(store._id), String(store.ownerId)]));
    const commissionByOwner = new Map(
      subscriptions.map((subscription) => [
        String(subscription.userId),
        Number(subscription.commissionRate),
      ]),
    );
    const groups = new Map<string, typeof artworks>();
    for (const artwork of artworks) {
      const storeId = String(artwork.storeId);
      groups.set(storeId, [...(groups.get(storeId) ?? []), artwork]);
    }
    let originalArtworkPrice = 0;
    let affiliateDiscount = 0;
    let eligibleArtworkPrice = 0;
    for (const [storeId, group] of groups) {
      const subtotal = group.reduce(
        (sum, artwork) =>
          sum +
          Number(artwork.discountPrice ?? artwork.price) *
            Number(itemMap.get(String(artwork._id))?.quantity ?? 1),
        0,
      );
      originalArtworkPrice += subtotal;
      const ownerId = storeOwner.get(storeId) ?? "";
      const pricing = affiliatePricing(
        subtotal,
        commissionByOwner.get(ownerId) ?? 0,
        attribution?.affiliate,
      );
      affiliateDiscount += pricing.discount;
      eligibleArtworkPrice += pricing.eligibleArtworkAmount;
    }
    const applied = Boolean(attribution && affiliateDiscount > 0);
    return ok(res, {
      originalArtworkPrice,
      affiliateDiscount,
      finalArtworkPrice: originalArtworkPrice - affiliateDiscount,
      shipping,
      packaging,
      taxes: 0,
      total: originalArtworkPrice - affiliateDiscount + shipping + packaging,
      attribution: attribution
        ? {
            code: attribution.affiliate.code,
            discountRate: attribution.affiliate.buyerDiscountRate,
            applied,
            message: applied
              ? `Affiliate discount applied — ${attribution.affiliate.buyerDiscountRate}% off eligible artwork`
              : "This order is not eligible for an ambassador discount",
          }
        : undefined,
      eligibleArtworkPrice,
    });
  }),
);

affiliatesRouter.post(
  "/apply",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({ requestedCode: codeSchema.optional() })
      .strict()
      .parse(req.body ?? {});
    const existing = await AffiliateModel.findOne({ userId: req.auth!.user._id });
    if (existing) return ok(res, serializeAffiliate(existing), "Application already exists");
    const settings = await getAffiliateSettings();
    if (!settings.enabled)
      throw new ApiError(409, "AFFILIATE_PROGRAM_DISABLED", "The ambassador program is paused");
    const code = await uniqueAffiliateCode(req.auth!.user.fullName, input.requestedCode);
    const approved = settings.autoApproveApplications;
    const affiliate = await AffiliateModel.create({
      userId: req.auth!.user._id,
      code,
      codeNormalized: code,
      status: approved ? "approved" : "pending",
      commissionRate: settings.defaultCommissionRate,
      buyerDiscountRate: settings.defaultBuyerDiscountRate,
      approvedAt: approved ? new Date() : undefined,
    });
    const admins = await UserModel.find({ role: "admin", status: "active" }).select("_id").lean();
    await Promise.all([
      ...admins.map((admin) =>
        notify(
          admin._id,
          "affiliate_application",
          "New ambassador application",
          `${req.auth!.user.fullName} applied with code ${code}.`,
          "/admin/affiliates",
        ),
      ),
      ...(approved
        ? [
            notify(
              req.auth!.user._id,
              "affiliate_approved",
              "Ambassador account approved",
              `Your ambassador code ${code} is ready to share.`,
              "/account/ambassador",
            ),
          ]
        : []),
    ]);
    return ok(res, serializeAffiliate(affiliate), "Application submitted", 201);
  }),
);

affiliatesRouter.patch(
  "/code",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { code } = z.object({ code: codeSchema }).strict().parse(req.body);
    const normalized = normalizeAffiliateCode(code);
    const affiliate = await AffiliateModel.findOne({ userId: req.auth!.user._id });
    if (!affiliate) throw new ApiError(404, "AFFILIATE_NOT_FOUND", "Apply to the program first");
    if (await AffiliateModel.exists({ codeNormalized: normalized, _id: { $ne: affiliate._id } }))
      throw new ApiError(409, "AFFILIATE_CODE_TAKEN", "That ambassador code is already in use");
    affiliate.code = normalized;
    affiliate.codeNormalized = normalized;
    await affiliate.save();
    return ok(res, serializeAffiliate(affiliate), "Ambassador code updated");
  }),
);

affiliatesRouter.get(
  "/dashboard",
  requireAuth,
  asyncRoute(async (req, res) => {
    const affiliate = await AffiliateModel.findOne({ userId: req.auth!.user._id });
    const settings = await getAffiliateSettings();
    if (!affiliate)
      return ok(res, {
        affiliate: null,
        settings: publicDashboardSettings(settings),
        metrics: emptyMetrics(),
        commissions: [],
        recentOrders: [],
        payouts: [],
      });
    await reconcileAffiliateCommissions(affiliate._id);
    const [commissions, payouts] = await Promise.all([
      AffiliateCommissionModel.find({ affiliateId: affiliate._id })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      AffiliatePayoutModel.find({ affiliateId: affiliate._id })
        .sort({ requestedAt: -1 })
        .limit(100)
        .lean(),
    ]);
    const orders = await OrderModel.find({
      _id: { $in: commissions.map((commission) => commission.orderId) },
    })
      .select("orderNumber items createdAt")
      .lean();
    const orderMap = new Map(orders.map((order) => [String(order._id), order]));
    const sums = commissionSums(commissions);
    const successfulOrders = commissions.filter((item) => item.status !== "rejected").length;
    const link = `${getEnv().APP_URL.replace(/\/$/, "")}/?ref=${affiliate.code}`;
    return ok(res, {
      affiliate: { ...serializeAffiliate(affiliate), referralLink: link },
      settings: publicDashboardSettings(settings),
      metrics: {
        totalClicks: affiliate.totalClicks,
        uniqueClicks: affiliate.uniqueClicks,
        successfulOrders,
        pendingCommissions: sums.pending,
        approvedCommissions: sums.approved,
        paidCommissions: sums.paid,
        availableBalance: commissions
          .filter((item) => item.status === "approved" && !item.payoutId)
          .reduce((sum, item) => sum + item.commissionAmount, 0),
        pendingBalance:
          sums.pending +
          payouts
            .filter((payout) => ["requested", "approved", "processing"].includes(payout.status))
            .reduce((sum, payout) => sum + payout.amount, 0),
        totalEarnings: sums.approved + sums.paid,
        generatedRevenue: commissions
          .filter((item) => item.status !== "rejected")
          .reduce((sum, item) => sum + item.eligibleSaleAmount, 0),
        conversionRate: affiliate.uniqueClicks
          ? Number(((successfulOrders / affiliate.uniqueClicks) * 100).toFixed(2))
          : 0,
      },
      commissions: commissions.map((commission) =>
        serializeCommission(commission, orderMap.get(String(commission.orderId))),
      ),
      recentOrders: commissions
        .filter((commission) => commission.status !== "rejected")
        .slice(0, 20)
        .map((commission) =>
          serializeCommission(commission, orderMap.get(String(commission.orderId))),
        ),
      payouts: payouts.map(serializePayout),
    });
  }),
);

affiliatesRouter.post(
  "/payouts",
  requireAuth,
  asyncRoute(async (req, res) => {
    z.object({ payoutMethod: z.literal("manual").default("manual") })
      .strict()
      .parse(req.body ?? {});
    const affiliate = await AffiliateModel.findOne({
      userId: req.auth!.user._id,
      status: "approved",
    });
    if (!affiliate)
      throw new ApiError(
        403,
        "AFFILIATE_NOT_APPROVED",
        "An approved ambassador account is required",
      );
    await reconcileAffiliateCommissions(affiliate._id);
    const settings = await getAffiliateSettings();
    const dbSession = await mongoose.startSession();
    let payout: any;
    try {
      await dbSession.withTransaction(async () => {
        const commissions = await AffiliateCommissionModel.find({
          affiliateId: affiliate._id,
          status: "approved",
          payoutId: { $exists: false },
        })
          .sort({ approvedAt: 1 })
          .session(dbSession);
        const amount = commissions.reduce(
          (sum, commission) => sum + commission.commissionAmount,
          0,
        );
        const minimum = minimumPayoutPkr(settings);
        if (amount < minimum)
          throw new ApiError(
            409,
            "PAYOUT_MINIMUM_NOT_MET",
            `At least PKR ${minimum.toLocaleString("en-PK")} is required to request a payout`,
          );
        [payout] = await AffiliatePayoutModel.create(
          [
            {
              affiliateId: affiliate._id,
              commissionIds: commissions.map((commission) => commission._id),
              amount,
              currency: "PKR",
              status: "requested",
              payoutMethod: { type: "manual", label: "Manual transfer" },
              requestedAt: new Date(),
            },
          ],
          { session: dbSession },
        );
        const claimed = await AffiliateCommissionModel.updateMany(
          {
            _id: { $in: commissions.map((commission) => commission._id) },
            status: "approved",
            payoutId: { $exists: false },
          },
          { $set: { payoutId: payout._id } },
          { session: dbSession },
        );
        if (claimed.modifiedCount !== commissions.length)
          throw new ApiError(
            409,
            "PAYOUT_BALANCE_CHANGED",
            "Your available balance changed; retry",
          );
      });
    } finally {
      await dbSession.endSession();
    }
    const admins = await UserModel.find({ role: "admin", status: "active" }).select("_id").lean();
    await Promise.all(
      admins.map((admin) =>
        notify(
          admin._id,
          "affiliate_payout_requested",
          "Ambassador payout requested",
          `${affiliate.code} requested PKR ${payout.amount.toLocaleString("en-PK")}.`,
          "/admin/affiliates",
        ),
      ),
    );
    return ok(res, serializePayout(payout), "Payout requested", 201);
  }),
);

adminAffiliatesRouter.use(requireRole("admin"));

adminAffiliatesRouter.get(
  "/affiliates",
  asyncRoute(async (req, res) => {
    await reconcileAffiliateCommissions();
    const page = pageQuery(req.query.page);
    const limit = limitQuery(req.query.limit, 25, 100);
    const status = z
      .enum(["pending", "approved", "rejected", "disabled"])
      .optional()
      .catch(undefined)
      .parse(req.query.status);
    const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const userMatches = search
      ? await UserModel.find({
          $or: [
            { fullName: { $regex: escapeRegex(search), $options: "i" } },
            { email: { $regex: escapeRegex(search), $options: "i" } },
          ],
        })
          .select("_id")
          .lean()
      : [];
    const filter = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            $or: [
              { code: { $regex: escapeRegex(search), $options: "i" } },
              { userId: { $in: userMatches.map((user) => user._id) } },
            ],
          }
        : {}),
    };
    const [affiliates, total] = await Promise.all([
      AffiliateModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AffiliateModel.countDocuments(filter),
    ]);
    const ids = affiliates.map((affiliate) => affiliate._id);
    const [users, commissions, payouts] = await Promise.all([
      UserModel.find({ _id: { $in: affiliates.map((affiliate) => affiliate.userId) } })
        .select("fullName email role status")
        .lean(),
      AffiliateCommissionModel.find({ affiliateId: { $in: ids } }).lean(),
      AffiliatePayoutModel.find({ affiliateId: { $in: ids } }).lean(),
    ]);
    const userMap = new Map(users.map((user) => [String(user._id), user]));
    return ok(res, {
      items: affiliates.map((affiliate) => {
        const ownCommissions = commissions.filter(
          (commission) => String(commission.affiliateId) === String(affiliate._id),
        );
        const ownPayouts = payouts.filter(
          (payout) => String(payout.affiliateId) === String(affiliate._id),
        );
        const sums = commissionSums(ownCommissions);
        const user = userMap.get(String(affiliate.userId));
        return {
          ...serializeAffiliate(affiliate),
          user: user
            ? { id: String(user._id), fullName: user.fullName, email: user.email, role: user.role }
            : undefined,
          metrics: {
            clicks: affiliate.totalClicks,
            orders: ownCommissions.filter((item) => item.status !== "rejected").length,
            generatedSales: ownCommissions
              .filter((item) => item.status !== "rejected")
              .reduce((sum, item) => sum + item.eligibleSaleAmount, 0),
            pending: sums.pending,
            approved: sums.approved,
            paid: sums.paid,
            payoutRequests: ownPayouts.length,
          },
        };
      }),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  }),
);

adminAffiliatesRouter.patch(
  "/affiliates/:id",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        action: z.enum(["approve", "reject", "enable", "disable", "update"]),
        reason: z.string().trim().max(1000).optional(),
        commissionRate: z.number().min(0).max(20).optional(),
        buyerDiscountRate: z.number().min(0).max(20).optional(),
        code: codeSchema.optional(),
      })
      .strict()
      .parse(req.body);
    const affiliate = await AffiliateModel.findById(req.params.id);
    if (!affiliate) throw new ApiError(404, "AFFILIATE_NOT_FOUND", "Ambassador not found");
    const before = affiliate.toObject();
    if (input.action === "approve" || input.action === "enable") {
      affiliate.status = "approved";
      affiliate.approvedAt ??= new Date();
      affiliate.disabledAt = undefined;
      affiliate.rejectionReason = undefined;
    } else if (input.action === "reject") {
      affiliate.status = "rejected";
      affiliate.rejectedAt = new Date();
      affiliate.rejectionReason = sanitizeText(input.reason ?? "Application not approved", 1000);
    } else if (input.action === "disable") {
      affiliate.status = "disabled";
      affiliate.disabledAt = new Date();
    }
    const commissionRate = input.commissionRate ?? affiliate.commissionRate;
    const buyerDiscountRate = input.buyerDiscountRate ?? affiliate.buyerDiscountRate;
    if (commissionRate + buyerDiscountRate > 20)
      throw new ApiError(
        422,
        "AFFILIATE_RATES_TOO_HIGH",
        "Commission and buyer discount cannot exceed the marketplace commission together",
      );
    affiliate.commissionRate = commissionRate;
    affiliate.buyerDiscountRate = buyerDiscountRate;
    if (input.code) {
      const normalized = normalizeAffiliateCode(input.code);
      if (await AffiliateModel.exists({ codeNormalized: normalized, _id: { $ne: affiliate._id } }))
        throw new ApiError(409, "AFFILIATE_CODE_TAKEN", "That ambassador code is already in use");
      affiliate.code = normalized;
      affiliate.codeNormalized = normalized;
    }
    await affiliate.save();
    await notify(
      affiliate.userId,
      affiliate.status === "approved" ? "affiliate_approved" : "affiliate_status_changed",
      affiliate.status === "approved" ? "Ambassador account approved" : "Ambassador status updated",
      `Your ArtDera ambassador account is now ${affiliate.status}.`,
      "/account/ambassador",
    );
    await audit(
      req,
      `affiliate.${input.action}`,
      "Affiliate",
      affiliate._id,
      before,
      affiliate.toObject(),
    );
    return ok(res, serializeAffiliate(affiliate), "Ambassador updated");
  }),
);

adminAffiliatesRouter.get(
  "/commissions",
  asyncRoute(async (req, res) => {
    await reconcileAffiliateCommissions();
    const status = z
      .enum(["pending", "approved", "rejected", "paid"])
      .optional()
      .catch(undefined)
      .parse(req.query.status);
    const commissions = await AffiliateCommissionModel.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const [affiliates, orders] = await Promise.all([
      AffiliateModel.find({ _id: { $in: commissions.map((item) => item.affiliateId) } })
        .select("code")
        .lean(),
      OrderModel.find({ _id: { $in: commissions.map((item) => item.orderId) } })
        .select("orderNumber items status inspectionEndsAt")
        .lean(),
    ]);
    const affiliateMap = new Map(affiliates.map((item) => [String(item._id), item]));
    const orderMap = new Map(orders.map((item) => [String(item._id), item]));
    return ok(
      res,
      commissions.map((commission) => ({
        ...serializeCommission(commission, orderMap.get(String(commission.orderId))),
        affiliateCode: affiliateMap.get(String(commission.affiliateId))?.code,
      })),
    );
  }),
);

adminAffiliatesRouter.patch(
  "/commissions/:id",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        action: z.enum(["approve", "reject"]),
        reason: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(req.body);
    const commission = await AffiliateCommissionModel.findById(req.params.id);
    if (!commission) throw new ApiError(404, "COMMISSION_NOT_FOUND", "Commission not found");
    if (commission.status === "paid" || commission.payoutId)
      throw new ApiError(
        409,
        "COMMISSION_LOCKED",
        "This commission is already attached to a payout",
      );
    if (input.action === "approve") {
      const order = await OrderModel.findById(commission.orderId).lean();
      if (
        !order ||
        order.status !== "completed" ||
        !order.inspectionEndsAt ||
        order.inspectionEndsAt > new Date()
      )
        throw new ApiError(
          409,
          "COMMISSION_NOT_ELIGIBLE",
          "Delivery and the inspection/return period must be complete first",
        );
      commission.status = "approved";
      commission.approvedAt = new Date();
      commission.rejectionReason = undefined;
    } else {
      commission.status = "rejected";
      commission.rejectedAt = new Date();
      commission.rejectionReason = sanitizeText(input.reason ?? "Rejected by administrator", 1000);
    }
    await commission.save();
    const affiliate = await AffiliateModel.findById(commission.affiliateId)
      .select("userId code")
      .lean();
    if (affiliate)
      await notify(
        affiliate.userId,
        input.action === "approve"
          ? "affiliate_commission_approved"
          : "affiliate_commission_rejected",
        input.action === "approve" ? "Commission approved" : "Commission rejected",
        `Commission for ${affiliate.code} was ${input.action === "approve" ? "approved" : "rejected"}.`,
        "/account/ambassador",
      );
    await audit(req, `affiliate.commission_${input.action}`, "AffiliateCommission", commission._id);
    return ok(res, { id: String(commission._id), status: commission.status }, "Commission updated");
  }),
);

adminAffiliatesRouter.get(
  "/payouts",
  asyncRoute(async (_req, res) => {
    const payouts = await AffiliatePayoutModel.find().sort({ requestedAt: -1 }).limit(500).lean();
    const affiliates = await AffiliateModel.find({
      _id: { $in: payouts.map((payout) => payout.affiliateId) },
    })
      .select("code userId")
      .lean();
    const affiliateMap = new Map(affiliates.map((item) => [String(item._id), item]));
    return ok(
      res,
      payouts.map((payout) => ({
        ...serializePayout(payout),
        affiliateCode: affiliateMap.get(String(payout.affiliateId))?.code,
      })),
    );
  }),
);

adminAffiliatesRouter.patch(
  "/payouts/:id",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        action: z.enum(["approve", "process", "mark_paid", "reject"]),
        reason: z.string().trim().max(1000).optional(),
        transactionReference: z.string().trim().max(200).optional(),
      })
      .strict()
      .parse(req.body);
    if (input.action === "mark_paid" && !input.transactionReference)
      throw new ApiError(422, "TRANSACTION_REFERENCE_REQUIRED", "Enter a transaction reference");
    const payout = await AffiliatePayoutModel.findById(req.params.id);
    if (!payout) throw new ApiError(404, "PAYOUT_NOT_FOUND", "Payout not found");
    const allowed: Record<string, string[]> = {
      requested: ["approve", "reject"],
      approved: ["process", "mark_paid", "reject"],
      processing: ["mark_paid", "reject"],
    };
    if (!allowed[payout.status]?.includes(input.action))
      throw new ApiError(
        409,
        "INVALID_PAYOUT_TRANSITION",
        "This payout cannot make that transition",
      );
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        if (input.action === "approve") payout.status = "approved";
        if (input.action === "process") payout.status = "processing";
        if (input.action === "reject") {
          payout.status = "rejected";
          payout.rejectionReason = sanitizeText(input.reason ?? "Rejected by administrator", 1000);
          payout.processedAt = new Date();
          payout.processedBy = req.auth!.user._id;
          await AffiliateCommissionModel.updateMany(
            { _id: { $in: payout.commissionIds }, status: "approved", payoutId: payout._id },
            { $unset: { payoutId: 1 } },
            { session: dbSession },
          );
        }
        if (input.action === "mark_paid") {
          payout.status = "paid";
          payout.transactionReference = sanitizeText(input.transactionReference!, 200);
          payout.processedAt = new Date();
          payout.processedBy = req.auth!.user._id;
          await AffiliateCommissionModel.updateMany(
            { _id: { $in: payout.commissionIds }, status: "approved", payoutId: payout._id },
            { $set: { status: "paid", paidAt: new Date() } },
            { session: dbSession },
          );
        }
        await payout.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }
    const affiliate = await AffiliateModel.findById(payout.affiliateId)
      .select("userId code")
      .lean();
    if (affiliate)
      await notify(
        affiliate.userId,
        payout.status === "paid" ? "affiliate_payout_paid" : "affiliate_payout_updated",
        payout.status === "paid" ? "Ambassador payout processed" : "Ambassador payout updated",
        `Payout for ${affiliate.code} is now ${payout.status}.`,
        "/account/ambassador",
      );
    await audit(req, `affiliate.payout_${input.action}`, "AffiliatePayout", payout._id);
    return ok(res, serializePayout(payout), "Payout updated");
  }),
);

adminAffiliatesRouter.get(
  "/activity",
  asyncRoute(async (_req, res) => {
    const activity = await AffiliateActivityModel.find().sort({ createdAt: -1 }).limit(500).lean();
    const affiliates = await AffiliateModel.find({
      _id: { $in: activity.map((item) => item.affiliateId) },
    })
      .select("code")
      .lean();
    const map = new Map(affiliates.map((item) => [String(item._id), item.code]));
    return ok(
      res,
      activity.map((item) => ({
        id: String(item._id),
        affiliateId: String(item.affiliateId),
        affiliateCode: map.get(String(item.affiliateId)),
        type: item.type,
        severity: item.severity,
        metadata: item.metadata,
        resolved: Boolean(item.resolvedAt),
        createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
      })),
    );
  }),
);

adminAffiliatesRouter.get(
  "/analytics",
  asyncRoute(async (_req, res) => {
    const [summary, byAffiliate, byArtwork] = await Promise.all([
      AffiliateCommissionModel.aggregate([
        { $match: { status: { $ne: "rejected" } } },
        {
          $group: {
            _id: null,
            successfulOrders: { $sum: 1 },
            generatedRevenue: { $sum: "$eligibleSaleAmount" },
            commissions: { $sum: "$commissionAmount" },
            buyerDiscounts: { $sum: "$buyerDiscountAmount" },
          },
        },
      ]),
      AffiliateCommissionModel.aggregate([
        { $match: { status: { $ne: "rejected" } } },
        {
          $group: {
            _id: "$affiliateId",
            orders: { $sum: 1 },
            revenue: { $sum: "$eligibleSaleAmount" },
            commissions: { $sum: "$commissionAmount" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
      AffiliateCommissionModel.aggregate([
        { $match: { status: { $ne: "rejected" } } },
        { $unwind: "$artworkIds" },
        {
          $group: {
            _id: "$artworkIds",
            orders: { $sum: 1 },
            revenue: { $sum: "$eligibleSaleAmount" },
          },
        },
        { $sort: { orders: -1, revenue: -1 } },
        { $limit: 10 },
      ]),
    ]);
    const [affiliates, artworks, clickTotals] = await Promise.all([
      AffiliateModel.find({ _id: { $in: byAffiliate.map((item) => item._id) } })
        .select("code")
        .lean(),
      ArtworkModel.find({ _id: { $in: byArtwork.map((item) => item._id) } })
        .select("title slug")
        .lean(),
      AffiliateModel.aggregate([
        {
          $group: {
            _id: null,
            clicks: { $sum: "$totalClicks" },
            uniqueClicks: { $sum: "$uniqueClicks" },
          },
        },
      ]),
    ]);
    const affiliateMap = new Map(affiliates.map((item) => [String(item._id), item]));
    const artworkMap = new Map(artworks.map((item) => [String(item._id), item]));
    return ok(res, {
      summary: {
        totalClicks: clickTotals[0]?.clicks ?? 0,
        uniqueClicks: clickTotals[0]?.uniqueClicks ?? 0,
        successfulOrders: summary[0]?.successfulOrders ?? 0,
        generatedRevenue: summary[0]?.generatedRevenue ?? 0,
        commissions: summary[0]?.commissions ?? 0,
        buyerDiscounts: summary[0]?.buyerDiscounts ?? 0,
      },
      topAffiliates: byAffiliate.map((item) => ({
        affiliateId: String(item._id),
        code: affiliateMap.get(String(item._id))?.code ?? "Unknown",
        orders: item.orders,
        revenue: item.revenue,
        commissions: item.commissions,
      })),
      topArtworks: byArtwork.map((item) => ({
        artworkId: String(item._id),
        title: artworkMap.get(String(item._id))?.title ?? "Artwork",
        slug: artworkMap.get(String(item._id))?.slug,
        orders: item.orders,
        revenue: item.revenue,
      })),
    });
  }),
);

adminAffiliatesRouter.get(
  "/settings",
  asyncRoute(async (_req, res) => ok(res, await getAffiliateSettings())),
);

adminAffiliatesRouter.patch(
  "/settings",
  asyncRoute(async (req, res) => {
    const settings = z
      .object({
        enabled: z.boolean(),
        defaultCommissionRate: z.number().min(0).max(20),
        defaultBuyerDiscountRate: z.number().min(0).max(20),
        attributionDays: z.number().int().min(1).max(365),
        minimumPayoutUsd: z.number().min(1).max(10_000),
        usdToPkrRate: z.number().positive().max(10_000),
        autoApproveApplications: z.boolean(),
        allowDiscountStacking: z.boolean(),
      })
      .strict()
      .parse(req.body);
    if (settings.defaultCommissionRate + settings.defaultBuyerDiscountRate > 20)
      throw new ApiError(
        422,
        "AFFILIATE_RATES_TOO_HIGH",
        "Commission and buyer discount cannot exceed 20% together",
      );
    await SystemSettingModel.updateOne(
      { key: AFFILIATE_SETTINGS_KEY },
      {
        $set: { value: settings, isPublic: false, updatedBy: req.auth!.user._id },
        $setOnInsert: { key: AFFILIATE_SETTINGS_KEY },
      },
      { upsert: true },
    );
    await audit(req, "affiliate.settings_updated", "SystemSetting", undefined, undefined, settings);
    return ok(res, settings, "Affiliate settings updated");
  }),
);

adminAffiliatesRouter.get(
  "/export.csv",
  asyncRoute(async (_req, res) => {
    const affiliates = await AffiliateModel.find().sort({ createdAt: -1 }).lean();
    const users = await UserModel.find({ _id: { $in: affiliates.map((item) => item.userId) } })
      .select("fullName email")
      .lean();
    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const rows = [
      ["Code", "Name", "Email", "Status", "Commission %", "Buyer discount %", "Clicks", "Created"],
      ...affiliates.map((affiliate) => {
        const user = userMap.get(String(affiliate.userId));
        return [
          affiliate.code,
          user?.fullName ?? "",
          user?.email ?? "",
          affiliate.status,
          affiliate.commissionRate,
          affiliate.buyerDiscountRate,
          affiliate.totalClicks,
          affiliate.createdAt?.toISOString?.() ?? "",
        ];
      }),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", "attachment; filename=artdera-affiliates.csv");
    return res.status(200).send(csv);
  }),
);

function serializeAffiliate(value: Record<string, any>) {
  return {
    id: String(value._id),
    userId: String(value.userId),
    code: value.code,
    status: value.status,
    commissionRate: value.commissionRate,
    buyerDiscountRate: value.buyerDiscountRate,
    totalClicks: value.totalClicks ?? 0,
    uniqueClicks: value.uniqueClicks ?? 0,
    suspiciousActivityCount: value.suspiciousActivityCount ?? 0,
    approvedAt: value.approvedAt?.toISOString?.() ?? value.approvedAt,
    rejectionReason: value.rejectionReason,
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
  };
}

function serializeCommission(value: Record<string, any>, order?: Record<string, any>) {
  return {
    id: String(value._id),
    affiliateId: String(value.affiliateId),
    orderId: String(value.orderId),
    orderReference: order?.orderNumber ?? `Order ${String(value.orderId).slice(-8).toUpperCase()}`,
    artwork: order?.items?.map((item: any) => item.title).join(", ") ?? "Artwork order",
    eligibleSaleAmount: value.eligibleSaleAmount,
    commissionRate: value.commissionRate,
    commissionAmount: value.commissionAmount,
    buyerDiscountAmount: value.buyerDiscountAmount,
    status: value.status,
    rejectionReason: value.rejectionReason,
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
    approvedAt: value.approvedAt?.toISOString?.() ?? value.approvedAt,
    paidAt: value.paidAt?.toISOString?.() ?? value.paidAt,
  };
}

function serializePayout(value: Record<string, any>) {
  return {
    id: String(value._id),
    affiliateId: String(value.affiliateId),
    amount: value.amount,
    currency: value.currency,
    status: value.status,
    payoutMethod: value.payoutMethod?.label ?? "Manual transfer",
    requestedAt: value.requestedAt?.toISOString?.() ?? value.requestedAt,
    processedAt: value.processedAt?.toISOString?.() ?? value.processedAt,
    transactionReference: value.transactionReference,
    rejectionReason: value.rejectionReason,
  };
}

function commissionSums(commissions: Array<Record<string, any>>) {
  return commissions.reduce(
    (totals, item) => {
      if (item.status === "pending") totals.pending += item.commissionAmount;
      if (item.status === "approved") totals.approved += item.commissionAmount;
      if (item.status === "paid") totals.paid += item.commissionAmount;
      return totals;
    },
    { pending: 0, approved: 0, paid: 0 },
  );
}

function publicDashboardSettings(settings: Awaited<ReturnType<typeof getAffiliateSettings>>) {
  return {
    enabled: settings.enabled,
    attributionDays: settings.attributionDays,
    minimumPayoutUsd: settings.minimumPayoutUsd,
    minimumPayoutPkr: minimumPayoutPkr(settings),
    defaultCommissionRate: settings.defaultCommissionRate,
    defaultBuyerDiscountRate: settings.defaultBuyerDiscountRate,
  };
}

function emptyMetrics() {
  return {
    totalClicks: 0,
    uniqueClicks: 0,
    successfulOrders: 0,
    pendingCommissions: 0,
    approvedCommissions: 0,
    paidCommissions: 0,
    availableBalance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
    generatedRevenue: 0,
    conversionRate: 0,
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
