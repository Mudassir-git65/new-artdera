import { ListingQuotaModel, SubscriptionModel, SubscriptionPlanModel } from "../models";
import { ApiError } from "../lib/http";

export async function getActivePlan(planId: string, billingCycle?: string) {
  const plan = await SubscriptionPlanModel.findOne({ planId, isActive: true }).lean();
  if (!plan) throw new ApiError(422, "INVALID_PLAN", "The selected plan is not available");
  if (planId === "free" && billingCycle && billingCycle !== "free") {
    throw new ApiError(
      422,
      "INVALID_BILLING_CYCLE",
      "That billing cycle is not available for this plan",
    );
  }
  const cycle = planId === "free" ? "free" : billingCycle;
  if (!cycle || !plan.allowedBillingCycles.includes(cycle as never)) {
    throw new ApiError(
      422,
      "INVALID_BILLING_CYCLE",
      "That billing cycle is not available for this plan",
    );
  }
  const price = cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
  if (price === undefined || price === null)
    throw new ApiError(
      422,
      "INVALID_BILLING_CYCLE",
      "That billing cycle is not available for this plan",
    );
  return { plan, cycle, price };
}

export async function activeSubscription(userId: unknown) {
  const now = new Date();
  return SubscriptionModel.findOne({
    userId,
    status: "active",
    $or: [{ planId: "free" }, { currentPeriodEnd: { $gt: now } }],
  })
    .sort({ createdAt: -1 })
    .lean();
}

export function isActiveProfessionalSubscription(
  subscription:
    | { planId?: unknown; status?: unknown; currentPeriodEnd?: Date | string | null }
    | null
    | undefined,
  now = new Date(),
) {
  if (subscription?.planId !== "professional" || subscription.status !== "active") return false;
  if (!subscription.currentPeriodEnd) return false;
  const expiresAt = new Date(subscription.currentPeriodEnd);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export async function requirePermission(userId: unknown, permission: string) {
  const subscription = await activeSubscription(userId);
  if (!subscription)
    throw new ApiError(403, "ACTIVE_SUBSCRIPTION_REQUIRED", "An active subscription is required");
  if (!subscription.featuresSnapshot.includes(permission))
    throw new ApiError(
      403,
      "PLAN_FEATURE_LOCKED",
      "Your current plan does not include this feature",
    );
  return subscription;
}

export async function reserveListingSlot(userId: unknown) {
  const subscription = await activeSubscription(userId);
  if (!subscription)
    throw new ApiError(403, "ACTIVE_SUBSCRIPTION_REQUIRED", "An active subscription is required");
  if (subscription.listingLimit === null || subscription.listingLimit === undefined)
    return subscription;
  const quota = await ListingQuotaModel.findOneAndUpdate(
    { userId, activeListings: { $lt: subscription.listingLimit } },
    { $inc: { activeListings: 1 }, $setOnInsert: { userId } },
    { returnDocument: "after", upsert: false },
  );
  if (!quota) {
    const existing = await ListingQuotaModel.findOne({ userId });
    if (!existing && subscription.listingLimit > 0) {
      const created = await ListingQuotaModel.create({ userId, activeListings: 1 });
      if (created.activeListings <= subscription.listingLimit) return subscription;
    }
    throw new ApiError(
      409,
      "LISTING_LIMIT_REACHED",
      `Your current plan allows ${subscription.listingLimit} active artworks`,
    );
  }
  return subscription;
}

export async function releaseListingSlot(userId: unknown) {
  await ListingQuotaModel.updateOne(
    { userId, activeListings: { $gt: 0 } },
    { $inc: { activeListings: -1 } },
  );
}
