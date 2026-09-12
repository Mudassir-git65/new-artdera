import type { BillingCycle, PlanId, SubscriptionPlan } from "@/marketplace/types";

const ALL_SELLER_MODULES = [
  "overview",
  "store",
  "artworks",
  "orders",
  "messages",
  "promotions",
  "shipping",
  "payouts",
  "reviews",
  "verification",
  "subscription",
  "support",
  "settings",
  "analytics",
];

const FALLBACK_SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    listingLimit: 5,
    commission: 20,
    profile: "Basic artist profile",
    analytics: "Basic",
    payoutTime: "1–3 working days",
    features: [
      "5 active artworks",
      "Basic artist profile",
      "Basic analytics",
      "Orders & messages",
      "Standard support",
    ],
    billingOptions: ["free"],
    buttonLabel: "Start Free",
    styleId: "free",
    allowedModules: ALL_SELLER_MODULES,
    lockedModules: ["advanced-analytics", "customers", "international-tools", "premium-url"],
    upgradeTarget: "professional",
    sellerType: "artist",
    verification: "Independent verification review available",
  },
  professional: {
    id: "professional",
    name: "Professional",
    monthlyPrice: 500,
    annualPrice: 500,
    listingLimit: 200,
    commission: 20,
    profile: "Professional seller profile",
    analytics: "Detailed",
    payoutTime: "1–3 working days",
    recommended: true,
    features: [
      "200 listings",
      "Professional seller profile",
      "Detailed analytics",
      "PRO Artist badge",
      "Verification review",
      "Promotional tools",
      "Professional store URL",
      "Priority support",
      "Orders & messages",
    ],
    billingOptions: ["annual"],
    buttonLabel: "Choose Professional",
    styleId: "professional",
    allowedModules: [
      ...ALL_SELLER_MODULES,
      "portfolio",
      "priority-support",
      "advanced-analytics",
      "customers",
      "premium-url",
      "international-tools",
    ],
    lockedModules: [],
    sellerType: "artist",
    verification: "Independent verification review available",
  },
  gallery: {
    id: "gallery",
    name: "Gallery",
    monthlyPrice: 10_000,
    listingLimit: null,
    commission: 0,
    profile: "Gallery storefront",
    analytics: "Advanced",
    payoutTime: "1–3 working days",
    staffLimit: "3–10",
    features: [
      "Fair-use unlimited listings",
      "3–10 staff accounts",
      "Gallery storefront",
      "CRM",
      "Artist management",
      "Inventory management",
      "Exhibitions",
      "Advanced reports",
      "Dedicated/priority support",
    ],
    billingOptions: ["monthly"],
    buttonLabel: "Choose Gallery",
    styleId: "gallery",
    allowedModules: [
      ...ALL_SELLER_MODULES,
      "advanced-analytics",
      "customers",
      "premium-url",
      "international-tools",
      "managed-artists",
      "staff",
      "staff-permissions",
      "inventory",
      "exhibitions",
      "gallery-crm",
      "reports",
    ],
    lockedModules: [],
    sellerType: "gallery",
    verification: "Independent gallery verification review available",
  },
};

export const SUBSCRIPTION_PLANS = structuredClone(FALLBACK_SUBSCRIPTION_PLANS);
export const PLAN_ORDER: PlanId[] = ["free", "professional", "gallery"];
export const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  professional: 1,
  gallery: 2,
};

export function hydrateSubscriptionPlans(plans: SubscriptionPlan[]) {
  for (const key of Object.keys(SUBSCRIPTION_PLANS)) delete SUBSCRIPTION_PLANS[key as PlanId];
  Object.assign(SUBSCRIPTION_PLANS, structuredClone(FALLBACK_SUBSCRIPTION_PLANS));
  for (const plan of plans) SUBSCRIPTION_PLANS[plan.id] = plan;
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && PLAN_ORDER.includes(value as PlanId);
}

export function planPrice(planId: PlanId, billingCycle: BillingCycle) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) return 0;
  if (planId === "free") return 0;
  if (planId === "professional") return plan.annualPrice ?? plan.monthlyPrice ?? 500;
  if (billingCycle === "annual" && plan.annualPrice !== undefined) return plan.annualPrice;
  return plan.monthlyPrice;
}

export function validBillingCycle(planId: PlanId, value: unknown) {
  if (planId === "free") return "free" as const;
  if (planId === "professional") return "annual" as const;
  const plan = SUBSCRIPTION_PLANS[planId];
  if (value === "annual" && plan?.billingOptions.includes("annual")) return "annual" as const;
  return "monthly" as const;
}

export function annualSavings(planId: PlanId) {
  const plan = SUBSCRIPTION_PLANS[planId];
  return plan?.annualPrice ? plan.monthlyPrice * 12 - plan.annualPrice : 0;
}
