import { describe, expect, it } from "vitest";
import { hasActiveProfessionalSubscription } from "../src/lib/subscription-status";
import { isActiveProfessionalSubscription } from "../server/services/plans";

const now = new Date("2026-08-27T00:00:00.000Z");
const future = "2026-09-27T00:00:00.000Z";
const past = "2026-07-27T00:00:00.000Z";

describe("Professional membership badge eligibility", () => {
  it("requires the Professional plan, active status, and a future expiry", () => {
    expect(
      hasActiveProfessionalSubscription(
        {
          planId: "professional",
          subscriptionStatus: "active",
          subscriptionExpiresAt: future,
        },
        now,
      ),
    ).toBe(true);

    for (const value of [
      { planId: "free", subscriptionStatus: "active", subscriptionExpiresAt: future },
      { planId: "gallery", subscriptionStatus: "active", subscriptionExpiresAt: future },
      { planId: "professional", subscriptionStatus: "expired", subscriptionExpiresAt: future },
      { planId: "professional", subscriptionStatus: "active", subscriptionExpiresAt: past },
      { planId: "professional", subscriptionStatus: "active" },
    ]) {
      expect(hasActiveProfessionalSubscription(value, now)).toBe(false);
    }
  });

  it("uses the same fail-closed rule at the server boundary", () => {
    expect(
      isActiveProfessionalSubscription(
        { planId: "professional", status: "active", currentPeriodEnd: future },
        now,
      ),
    ).toBe(true);
    expect(
      isActiveProfessionalSubscription(
        { planId: "professional", status: "active", currentPeriodEnd: past },
        now,
      ),
    ).toBe(false);
    expect(
      isActiveProfessionalSubscription({ planId: "professional", status: "active" }, now),
    ).toBe(false);
  });
});
