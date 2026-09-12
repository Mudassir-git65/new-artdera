export type PublicSubscriptionStatus = {
  planId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: string | Date | null;
};

/**
 * A PRO badge is a paid-membership signal, not an identity, account-type, or
 * marketplace-approval signal. Paid plans always have a finite billing period;
 * an absent or invalid expiry therefore fails closed.
 */
export function hasActiveProfessionalSubscription(
  subscription: PublicSubscriptionStatus | null | undefined,
  now = new Date(),
) {
  if (subscription?.planId !== "professional") return false;
  if (String(subscription.subscriptionStatus).toLowerCase() !== "active") return false;
  if (!subscription.subscriptionExpiresAt) return false;

  const expiresAt = new Date(subscription.subscriptionExpiresAt);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}
