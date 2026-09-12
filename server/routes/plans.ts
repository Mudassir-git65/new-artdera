import { Router, type Request } from "express";
import { z } from "zod";
import { PendingPlanSelectionModel, SubscriptionPlanModel } from "../models";
import { asyncRoute, ok } from "../lib/http";
import { getActivePlan } from "../services/plans";
import { hashToken, randomToken } from "../lib/security";
import { getEnv } from "../config/env";
import { requireRole } from "../middleware/auth";
import { audit } from "../services/audit";

export const PLAN_SELECTION_COOKIE = "artdera_plan_selection";
export const plansRouter = Router();

export async function pendingPlanSelectionFor(req: Request, userId: unknown) {
  const token = req.cookies?.[PLAN_SELECTION_COOKIE] as string | undefined;
  if (!token) return null;
  const pending = await PendingPlanSelectionModel.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  })
    .select("+tokenHash")
    .lean();
  // A selection made while signed in belongs only to that account. An
  // anonymous selection is attached during registration before it is reused.
  if (!pending?.userId || String(pending.userId) !== String(userId)) return null;
  const { plan, cycle, price } = await getActivePlan(pending.planId, pending.billingCycle);
  return {
    planId: plan.planId,
    billingCycle: cycle,
    price,
    commission: plan.commissionRate,
    listingLimit: plan.listingLimit,
    features: plan.features,
    selectedAt: pending.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

function serializePlan(plan: Record<string, any>) {
  return {
    id: plan.planId,
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    annualPrice: plan.annualPrice,
    listingLimit: plan.listingLimit,
    commission: plan.commissionRate,
    profile: plan.planId === "gallery" ? "Gallery storefront" : `${plan.name} artist profile`,
    analytics: `${String(plan.analyticsLevel).charAt(0).toUpperCase()}${String(plan.analyticsLevel).slice(1)}`,
    payoutTime: `${plan.payoutMinimumDays}–${plan.payoutMaximumDays} working days`,
    staffLimit: plan.staffAccountMaximum
      ? `${plan.staffAccountMinimum}–${plan.staffAccountMaximum}`
      : undefined,
    recommended: plan.recommended,
    features: plan.features,
    billingOptions: plan.allowedBillingCycles,
    buttonLabel:
      plan.planId === "free"
        ? "Start Selling Free"
        : plan.planId === "professional"
          ? "Go Professional — PKR 500/year"
          : "Choose Gallery",
    styleId: plan.planId,
    allowedModules: plan.permissions,
    lockedModules: [],
    sellerType: plan.planId === "gallery" ? "gallery" : "artist",
    verification: "Verification review available after independent approval",
  };
}

plansRouter.get(
  "/",
  asyncRoute(async (_req, res) => {
    const plans = await SubscriptionPlanModel.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();
    return ok(res, plans.map(serializePlan));
  }),
);

plansRouter.post(
  "/select",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        planId: z.enum(["free", "professional", "gallery"]),
        billingCycle: z.enum(["free", "monthly", "annual"]).optional(),
      })
      .strict()
      .parse(req.body);
    const { plan, cycle, price } = await getActivePlan(input.planId, input.billingCycle);
    const token = randomToken();
    await PendingPlanSelectionModel.create({
      tokenHash: hashToken(token),
      planId: plan.planId,
      billingCycle: cycle,
      userId: req.auth?.user._id,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    const env = getEnv();
    res.cookie(PLAN_SELECTION_COOKIE, token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 60_000,
    });
    return ok(res, {
      planId: plan.planId,
      billingCycle: cycle,
      price,
      commission: plan.commissionRate,
      listingLimit: plan.listingLimit,
      features: plan.features,
      selectedAt: new Date().toISOString(),
    });
  }),
);

plansRouter.patch(
  "/:planId",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        monthlyPrice: z.number().nonnegative().optional(),
        annualPrice: z.number().nonnegative().nullable().optional(),
        listingLimit: z.number().int().nonnegative().nullable().optional(),
        commissionRate: z.number().min(0).max(100).optional(),
        features: z.array(z.string().trim().min(1).max(180)).max(100).optional(),
        permissions: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
        isActive: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    const before = await SubscriptionPlanModel.findOne({ planId: req.params.planId }).lean();
    const plan = await SubscriptionPlanModel.findOneAndUpdate(
      { planId: req.params.planId },
      { $set: input },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!plan)
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Plan not found", fieldErrors: {} },
      });
    await audit(req, "plan.updated", "SubscriptionPlan", plan._id, before, plan);
    return ok(res, serializePlan(plan), "Plan updated");
  }),
);
