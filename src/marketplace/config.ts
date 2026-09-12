import { SUBSCRIPTION_PLANS } from "@/config/subscription-plans";
import type { PromotionPlacement, UserRole } from "./types";

export { PLAN_ORDER } from "@/config/subscription-plans";
export const PLANS = SUBSCRIPTION_PLANS;

export let DEMO_MODE = false;
export let DEMO_PAYMENT_MODE = false;

export const PROMOTION_PLACEMENTS: PromotionPlacement[] = [];

export function hydrateRuntimeConfig(input: {
  demoPaymentMode?: boolean;
  promotionPlacements?: PromotionPlacement[];
}) {
  DEMO_PAYMENT_MODE = Boolean(input.demoPaymentMode);
  DEMO_MODE = DEMO_PAYMENT_MODE;
  PROMOTION_PLACEMENTS.splice(0, PROMOTION_PLACEMENTS.length, ...(input.promotionPlacements ?? []));
}

export const ROUTES = {
  home: "/",
  discover: "/discover",
  sell: "/sell",
  plans: "/sell/plans",
  artistSignup: "/artist/signup",
  artistCheckout: "/artist/checkout",
  paymentSuccess: "/artist/payment-success",
  paymentFailed: "/artist/payment-failed",
  onboarding: "/artist/onboarding",
  storeCreated: "/artist/store-created",
  login: "/auth/login",
  dashboard: "/artist/dashboard",
  buyer: "/account",
  admin: "/admin",
} as const;

export const ROLE_HOME: Record<UserRole, string> = {
  artist: ROUTES.dashboard,
  gallery: ROUTES.dashboard,
  gallery_staff: ROUTES.dashboard,
  buyer: ROUTES.buyer,
  admin: ROUTES.admin,
  moderator: ROUTES.admin,
  support: ROUTES.admin,
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  buyer: ["shop", "wishlist", "message", "offer", "review"],
  artist: [
    "shop",
    "wishlist",
    "offer",
    "review",
    "manage_store",
    "manage_artworks",
    "manage_orders",
    "message",
    "promote",
  ],
  gallery: [
    "shop",
    "wishlist",
    "offer",
    "review",
    "manage_store",
    "manage_artworks",
    "manage_orders",
    "message",
    "promote",
    "manage_artists",
    "manage_staff",
    "reports",
  ],
  gallery_staff: ["manage_store", "manage_artworks", "manage_orders", "message"],
  admin: ["moderate", "manage_plans", "manage_users", "manage_content", "view_audit"],
  moderator: ["moderate", "manage_content"],
  support: ["manage_support", "view_orders"],
};

export const formatPKR = (value: number) => `PKR ${new Intl.NumberFormat("en-PK").format(value)}`;
