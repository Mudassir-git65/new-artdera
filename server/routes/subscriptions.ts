import { randomUUID } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  ArtworkModel,
  InvoiceModel,
  ListingQuotaModel,
  PaymentModel,
  SubscriptionModel,
} from "../models";
import { ApiError, asyncRoute, ok } from "../lib/http";
import { requireAuth, requireVerified } from "../middleware/auth";
import { getActivePlan } from "../services/plans";
import { paymentProvider } from "../services/payments";
import { serializeSubscription } from "../lib/serializers";
import { notify } from "../services/notifications";
import { audit } from "../services/audit";
import { getEnv } from "../config/env";
import { PLAN_RANK } from "../config/plans";
import {
  MANUAL_PAYMENT_INSTRUCTION,
  manualPaymentAccount,
  type ManualPaymentMethod,
} from "../services/manual-payments";

export const subscriptionsRouter = Router();

function addCycle(date: Date, cycle: string) {
  const next = new Date(date);
  if (cycle === "annual") next.setFullYear(next.getFullYear() + 1);
  else if (cycle === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

subscriptionsRouter.get(
  "/current",
  requireAuth,
  asyncRoute(async (req, res) => {
    const subscription = await SubscriptionModel.findOne({ userId: req.auth!.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, subscription ? serializeSubscription(subscription) : null);
  }),
);

subscriptionsRouter.post(
  "/payment",
  requireVerified,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        planId: z.enum(["professional", "gallery"]).optional(),
        billingCycle: z.enum(["monthly", "annual"]).optional(),
        method: z.enum(["card", "bank-transfer", "easypaisa", "jazzcash", "raast"]).default("card"),
      })
      .strict()
      .parse(req.body);
    const isManualPayment = input.method === "jazzcash" || input.method === "easypaisa";
    if (!isManualPayment && !getEnv().DEMO_PAYMENT_MODE)
      throw new ApiError(
        422,
        "PAYMENT_METHOD_NOT_AVAILABLE",
        "Choose JazzCash or Easypaisa to continue",
      );
    let subscription = await SubscriptionModel.findOne({ userId: req.auth!.user._id }).sort({
      createdAt: -1,
    });
    const targetPlanId = input.planId ?? subscription?.pendingPlanId ?? subscription?.planId;
    const targetCycle = input.billingCycle ?? subscription?.billingCycle;
    if (!targetPlanId || targetPlanId === "free")
      throw new ApiError(422, "PAYMENT_NOT_REQUIRED", "The Free plan does not require payment");
    const { plan, cycle, price } = await getActivePlan(targetPlanId, targetCycle);
    if (!subscription) {
      subscription = await SubscriptionModel.create({
        userId: req.auth!.user._id,
        planId: plan.planId,
        billingCycle: cycle,
        status: "pending",
        price,
        currency: "PKR",
        commissionRate: plan.commissionRate,
        listingLimit: plan.listingLimit,
        featuresSnapshot: plan.permissions,
      });
    }
    const existing = await PaymentModel.findOne({
      userId: req.auth!.user._id,
      subscriptionId: subscription._id,
      status: {
        $in: [
          "initiated",
          "pending",
          "pending_verification",
          "information_requested",
          "processing",
        ],
      },
      "metadata.targetPlanId": plan.planId,
      "metadata.billingCycle": cycle,
      "metadata.method": input.method,
    }).lean();
    if (existing) return ok(res, serializePayment(existing));
    const intent = isManualPayment
      ? {
          reference: `manual_subscription_${randomUUID()}`,
          amount: price,
          currency: "PKR" as const,
          status: "pending" as const,
        }
      : await paymentProvider().createPayment({
          amount: price,
          currency: "PKR",
          idempotencyKey: `${String(req.auth!.user._id)}_${plan.planId}_${cycle}`,
        });
    const payment = await PaymentModel.create({
      userId: req.auth!.user._id,
      subscriptionId: subscription._id,
      paymentType: "subscription",
      provider: isManualPayment ? "manual" : getEnv().PAYMENT_PROVIDER,
      providerReference: intent.reference,
      amount: price,
      currency: "PKR",
      status: "pending",
      metadata: { targetPlanId: plan.planId, billingCycle: cycle, method: input.method },
    });
    return ok(
      res,
      {
        ...serializePayment(payment.toObject()),
        paymentInstructions: isManualPayment
          ? {
              ...manualPaymentAccount(input.method as ManualPaymentMethod),
              amount: price,
              paymentId: String(payment._id),
              referenceLabel: `${plan.name} ${cycle} subscription`,
              instruction: MANUAL_PAYMENT_INSTRUCTION,
            }
          : undefined,
      },
      "Payment initiated",
      201,
    );
  }),
);

subscriptionsRouter.post(
  "/payment/:paymentId/confirm-demo",
  requireVerified,
  asyncRoute(async (req, res) => {
    if (!getEnv().DEMO_PAYMENT_MODE)
      throw new ApiError(404, "NOT_FOUND", "The requested resource was not found");
    const { outcome } = z
      .object({ outcome: z.enum(["success", "failure"]).default("success") })
      .strict()
      .parse(req.body);
    const payment = await PaymentModel.findOne({
      _id: req.params.paymentId,
      userId: req.auth!.user._id,
    });
    if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    if (payment.status === "successful") return ok(res, serializePayment(payment.toObject()));
    const verified = await paymentProvider().verifyPayment(payment.providerReference, outcome);
    if (!verified.successful) {
      payment.status = "failed";
      payment.failureReason = verified.failureReason;
      await payment.save();
      await SubscriptionModel.updateOne(
        { _id: payment.subscriptionId },
        { $set: { status: "payment_failed" } },
      );
      await notify(
        req.auth!.user._id,
        "subscription_payment_failed",
        "Payment failed",
        "Your subscription payment did not complete.",
        "/artist/checkout",
      );
      return ok(res, serializePayment(payment.toObject()), "Demo payment failed");
    }
    const targetPlanId = String(payment.metadata?.targetPlanId ?? "");
    const billingCycle = String(payment.metadata?.billingCycle ?? "");
    const { plan, cycle, price } = await getActivePlan(targetPlanId, billingCycle);
    const dbSession = await mongoose.startSession();
    let invoiceId: unknown;
    try {
      await dbSession.withTransaction(async () => {
        const now = new Date();
        const currentPeriodEnd = addCycle(now, cycle);
        const subscription = await SubscriptionModel.findOneAndUpdate(
          { _id: payment.subscriptionId, userId: req.auth!.user._id },
          {
            $set: {
              planId: plan.planId,
              billingCycle: cycle,
              status: "active",
              price,
              commissionRate: plan.commissionRate,
              listingLimit: plan.listingLimit,
              startedAt: now,
              currentPeriodStart: now,
              currentPeriodEnd,
              nextBillingAt: currentPeriodEnd,
              paymentProvider: payment.provider,
              featuresSnapshot: plan.permissions,
            },
            $unset: { pendingPlanId: 1, pendingChangeAt: 1 },
          },
          { returnDocument: "after", session: dbSession },
        );
        if (!subscription)
          throw new ApiError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription not found");
        payment.status = "successful";
        payment.paidAt = verified.paidAt ?? now;
        await payment.save({ session: dbSession });
        const [invoice] = await InvoiceModel.create(
          [
            {
              invoiceNumber: `INV-${now.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
              userId: req.auth!.user._id,
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
        invoiceId = invoice._id;
        await ListingQuotaModel.updateOne(
          { userId: req.auth!.user._id },
          { $setOnInsert: { activeListings: 0 } },
          { upsert: true, session: dbSession },
        );
      });
    } finally {
      await dbSession.endSession();
    }
    await notify(
      req.auth!.user._id,
      "payment_successful",
      "Payment successful",
      `${plan.name} is now active.`,
      "/artist/payment-success",
    );
    await audit(req, "subscription.activated", "Subscription", payment.subscriptionId, undefined, {
      planId: plan.planId,
      paymentId: payment._id,
    });
    return ok(
      res,
      { payment: serializePayment(payment.toObject()), invoiceId: String(invoiceId) },
      "Subscription activated",
    );
  }),
);

subscriptionsRouter.get(
  "/payments",
  requireAuth,
  asyncRoute(async (req, res) => {
    const payments = await PaymentModel.find({ userId: req.auth!.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, payments.map(serializePayment));
  }),
);

subscriptionsRouter.get(
  "/invoices",
  requireAuth,
  asyncRoute(async (req, res) => {
    const invoices = await InvoiceModel.find({ userId: req.auth!.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return ok(
      res,
      invoices.map((invoice) => ({
        id: String(invoice._id),
        userId: String(invoice.userId),
        subscriptionId: invoice.subscriptionId ? String(invoice.subscriptionId) : undefined,
        planId: undefined,
        billingCycle: undefined,
        amount: invoice.subtotal,
        tax: invoice.tax,
        discount: invoice.discount,
        total: invoice.total,
        status:
          invoice.status === "paid" ? "Paid" : invoice.status === "void" ? "Voided" : "Pending",
        issuedAt: invoice.issuedAt.toISOString(),
        invoiceNumber: invoice.invoiceNumber,
      })),
    );
  }),
);

subscriptionsRouter.post(
  "/change",
  requireVerified,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        planId: z.enum(["free", "professional", "gallery"]),
        billingCycle: z.enum(["free", "monthly", "annual"]).optional(),
        effective: z.enum(["immediately", "end-of-cycle"]).default("end-of-cycle"),
        keepArtworkIds: z.array(z.string()).max(200).default([]),
      })
      .strict()
      .parse(req.body);
    const subscription = await SubscriptionModel.findOne({
      userId: req.auth!.user._id,
      status: "active",
    });
    if (!subscription)
      throw new ApiError(404, "SUBSCRIPTION_NOT_FOUND", "Active subscription not found");
    if (input.planId === subscription.planId)
      throw new ApiError(422, "PLAN_UNCHANGED", "Choose a different plan");
    const { plan, cycle, price } = await getActivePlan(input.planId, input.billingCycle);
    const isUpgrade = PLAN_RANK[plan.planId] > PLAN_RANK[subscription.planId];
    if (isUpgrade) {
      subscription.pendingPlanId = plan.planId;
      subscription.pendingChangeAt = new Date();
      await subscription.save();
      return ok(
        res,
        {
          requiresPayment: price > 0,
          subscription: serializeSubscription(subscription.toObject()),
        },
        "Upgrade payment is required",
      );
    }
    const effectiveAt =
      input.effective === "immediately"
        ? new Date()
        : (subscription.currentPeriodEnd ?? new Date());
    if (input.effective === "end-of-cycle") {
      subscription.pendingPlanId = plan.planId;
      subscription.pendingChangeAt = effectiveAt;
      await subscription.save();
      await audit(
        req,
        "subscription.downgrade_scheduled",
        "Subscription",
        subscription._id,
        undefined,
        { planId: plan.planId, effectiveAt },
      );
      return ok(res, serializeSubscription(subscription.toObject()), "Downgrade scheduled");
    }
    const activeArtworks = await ArtworkModel.find({
      artistId: req.auth!.user._id,
      status: { $in: ["published", "pending_review", "reserved"] },
    }).sort({ createdAt: 1 });
    const allowed = plan.listingLimit ?? activeArtworks.length;
    const keep = new Set(input.keepArtworkIds);
    const selected = activeArtworks
      .filter((artwork) => keep.has(String(artwork._id)))
      .slice(0, allowed);
    const remainingSlots = Math.max(0, allowed - selected.length);
    const fallback = activeArtworks
      .filter((artwork) => !keep.has(String(artwork._id)))
      .slice(0, remainingSlots);
    const keepIds = new Set([...selected, ...fallback].map((artwork) => String(artwork._id)));
    const archiveIds = activeArtworks
      .filter((artwork) => !keepIds.has(String(artwork._id)))
      .map((artwork) => artwork._id);
    if (archiveIds.length)
      await ArtworkModel.updateMany({ _id: { $in: archiveIds } }, { $set: { status: "archived" } });
    subscription.planId = plan.planId;
    subscription.billingCycle = cycle;
    subscription.price = price;
    subscription.commissionRate = plan.commissionRate;
    subscription.listingLimit = plan.listingLimit;
    subscription.featuresSnapshot = [...plan.permissions];
    subscription.pendingPlanId = undefined;
    subscription.pendingChangeAt = undefined;
    await subscription.save();
    await ListingQuotaModel.updateOne(
      { userId: req.auth!.user._id },
      { $set: { activeListings: Math.min(activeArtworks.length, allowed) } },
      { upsert: true },
    );
    await notify(
      req.auth!.user._id,
      "subscription_downgraded",
      "Subscription updated",
      `Your plan is now ${plan.name}.`,
    );
    await audit(req, "subscription.downgraded", "Subscription", subscription._id, undefined, {
      planId: plan.planId,
      archivedArtworkIds: archiveIds,
    });
    return ok(
      res,
      {
        subscription: serializeSubscription(subscription.toObject()),
        archivedArtworkIds: archiveIds.map(String),
      },
      "Plan changed",
    );
  }),
);

subscriptionsRouter.post(
  "/cancel",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { immediately } = z
      .object({ immediately: z.boolean().default(false) })
      .strict()
      .parse(req.body);
    const subscription = await SubscriptionModel.findOne({
      userId: req.auth!.user._id,
      status: "active",
    });
    if (!subscription)
      throw new ApiError(404, "SUBSCRIPTION_NOT_FOUND", "Active subscription not found");
    if (immediately) {
      const { plan } = await getActivePlan("free", "free");
      subscription.planId = "free";
      subscription.billingCycle = "free";
      subscription.price = 0;
      subscription.commissionRate = plan.commissionRate;
      subscription.listingLimit = plan.listingLimit;
      subscription.featuresSnapshot = [...plan.permissions];
      subscription.cancelledAt = new Date();
    } else {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancelledAt = new Date();
    }
    await subscription.save();
    await audit(req, "subscription.cancelled", "Subscription", subscription._id, undefined, {
      immediately,
    });
    return ok(res, serializeSubscription(subscription.toObject()), "Cancellation saved");
  }),
);

function serializePayment(payment: Record<string, any>) {
  const status =
    payment.status === "successful"
      ? "Succeeded"
      : payment.status === "failed"
        ? "Failed"
        : payment.status === "processing"
          ? "Processing"
          : "Pending Review";
  return {
    id: String(payment._id),
    userId: String(payment.userId),
    invoiceId: payment.invoiceId ? String(payment.invoiceId) : undefined,
    planId: payment.metadata?.targetPlanId,
    billingCycle: payment.metadata?.billingCycle,
    method: payment.metadata?.method ?? "card",
    amount: payment.amount,
    status,
    reference: payment.providerReference,
    createdAt: payment.createdAt?.toISOString?.() ?? payment.createdAt,
    failureReason: payment.failureReason,
  };
}
