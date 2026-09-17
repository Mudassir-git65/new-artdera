import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("production-facing UI safety", () => {
  it("keeps the account link relative and independent of mutable checkout destinations", () => {
    const header = source("src/components/site/Header.tsx");
    const login = source("src/routes/auth.login.tsx");
    expect(header).not.toMatch(/AuthService\.destination|localhost|127\.0\.0\.1/i);
    expect(header).toContain('user.role === "admin" ? "/admin" : "/account"');
    expect(login).toContain("requestedDestination ?? AuthService.destination()");
    expect(login).not.toContain("requestedDestination ?? result.data.destination");
  });

  it("does not expose development payment controls or copy", () => {
    const checkout = source("src/routes/artist.checkout.tsx");
    const sellerDashboard = source("src/marketplace/dashboard.tsx");
    expect(`${checkout}\n${sellerDashboard}`).not.toMatch(
      /development payment|development test|simulate failure|confirm development/i,
    );
  });

  it("keeps the browser-only creator loader out of server rendering", () => {
    const creatorRoute = source("src/routes/creator.$slug.tsx");
    expect(creatorRoute).toMatch(/typeof window !== "undefined"/);
  });

  it("never logs password-reset links in production", () => {
    const email = source("server/services/email.ts");
    const productionGuard = email.indexOf('env.NODE_ENV === "production"');
    const resetUrlLog = email.indexOf("Reset URL:");
    expect(productionGuard).toBeGreaterThan(-1);
    expect(resetUrlLog).toBeGreaterThan(productionGuard);
  });
});
