import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronDown, Info, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { PLAN_ORDER, SUBSCRIPTION_PLANS, validBillingCycle } from "@/config/subscription-plans";
import { formatPKR } from "@/marketplace/config";
import { SubscriptionService, UserService } from "@/marketplace/services";
import type { PlanId } from "@/marketplace/types";
import { useAuth } from "@/marketplace/auth";

export const Route = createFileRoute("/sell/plans")({
  head: () => ({
    meta: [
      { title: "Seller Subscription Plans — ArtDera" },
      {
        name: "description",
        content: "Compare ArtDera Free, Professional, and Gallery seller plans.",
      },
    ],
  }),
  component: PlansPage,
});

type ComparisonRow = { label: string; values: Record<PlanId, string> };

const planValues = (value: (planId: PlanId) => string): Record<PlanId, string> => ({
  free: value("free"),
  professional: value("professional"),
  gallery: value("gallery"),
});

const comparison: ComparisonRow[] = [
  {
    label: "Price",
    values: {
      free: "PKR 0 forever",
      professional: "PKR 500 / year",
      gallery: "PKR 10,000 / month",
    },
  },
  {
    label: "Commission",
    values: planValues(
      (id) => `${SUBSCRIPTION_PLANS[id]?.commission ?? (id === "gallery" ? 0 : 20)}%`,
    ),
  },
  {
    label: "Listing limit",
    values: planValues((id) =>
      SUBSCRIPTION_PLANS[id]?.listingLimit === null
        ? "Fair-use unlimited"
        : `${SUBSCRIPTION_PLANS[id]?.listingLimit ?? (id === "free" ? 5 : 200)} active`,
    ),
  },
  {
    label: "Profile type",
    values: {
      free: "Basic artist profile",
      professional: "Professional seller profile",
      gallery: "Gallery storefront",
    },
  },
  {
    label: "Verification",
    values: {
      free: "Standard review",
      professional: "Priority verification review",
      gallery: "Gallery review",
    },
  },
  {
    label: "Analytics",
    values: {
      free: "Basic analytics",
      professional: "Detailed analytics",
      gallery: "Advanced reports",
    },
  },
  {
    label: "Store URL",
    values: {
      free: "Standard URL",
      professional: "Professional store URL",
      gallery: "Gallery URL",
    },
  },
  {
    label: "Promotional tools",
    values: { free: "Included", professional: "Included", gallery: "Included" },
  },
  {
    label: "Customer tools & CRM",
    values: { free: "—", professional: "Included", gallery: "CRM included" },
  },
  {
    label: "Staff accounts",
    values: { free: "—", professional: "—", gallery: "3–10 staff accounts" },
  },
  {
    label: "Artist management",
    values: { free: "—", professional: "—", gallery: "Included" },
  },
  {
    label: "Exhibitions & inventory",
    values: { free: "—", professional: "—", gallery: "Included" },
  },
  {
    label: "Support",
    values: {
      free: "Standard support",
      professional: "Priority support",
      gallery: "Dedicated / priority support",
    },
  },
];

function PlansPage() {
  const { user, ready, catalogReady, refresh } = useAuth();
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [selecting, setSelecting] = useState<PlanId | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const subscription = user ? SubscriptionService.getForUser(user.id) : undefined;
    setSelected(subscription?.planId ?? SubscriptionService.getSelection()?.planId ?? null);
  }, [catalogReady, user]);

  async function choose(planId: PlanId) {
    if (user && !["buyer", "artist", "gallery"].includes(user.role)) {
      setNotice(
        "This workspace account cannot open a store. Use a personal ArtDera account to start selling.",
      );
      return;
    }
    const cycle = validBillingCycle(planId, "annual");
    setSelecting(planId);
    setNotice("");
    const result = await SubscriptionService.selectPlan(planId, cycle);
    if (result.error) {
      setSelecting(null);
      setNotice(result.error.message);
      return;
    }
    setSelected(planId);
    if (user?.role === "buyer") {
      const conversion = await UserService.becomeSeller();
      if (conversion.error || !conversion.data) {
        setSelecting(null);
        setNotice(
          conversion.error?.message ?? "Seller setup could not be started. Please try again.",
        );
        return;
      }
      await refresh();
      window.location.assign(
        planId === "free" ? "/artist/onboarding?activated=free" : conversion.data.destination,
      );
      return;
    }
    if (user && ["artist", "gallery"].includes(user.role)) {
      const subscription = SubscriptionService.getForUser(user.id);
      if (subscription?.planId === planId && subscription.status === "Active") {
        window.location.assign(SubscriptionService.destinationFor(user));
        return;
      }
      if (planId === "free" && subscription) {
        window.location.assign("/artist/dashboard/subscription?upgrade=free");
        return;
      }
      window.location.assign(`/artist/checkout?plan=${planId}&billing=${cycle}`);
      return;
    }
    window.location.assign(`/artist/signup?plan=${planId}&billing=${cycle}`);
  }

  return (
    <div className="container-editorial overflow-x-clip py-12 lg:py-16">
      <header className="mx-auto max-w-4xl text-center">
        <div className="eyebrow">Artist subscriptions</div>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
          Choose the Right Plan for Your Art Business
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Start free or choose a professional plan with more listings, analytics and business tools.
          You can upgrade or change your plan later.
        </p>
      </header>

      {notice && (
        <div
          role="status"
          className="mx-auto mt-7 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-950"
        >
          {notice}
        </div>
      )}

      <section
        className="mt-12 grid items-stretch gap-6 md:grid-cols-3"
        aria-label="Subscription plans"
      >
        {PLAN_ORDER.map((planId) => {
          const plan = SUBSCRIPTION_PLANS[planId];
          const isPro = planId === "professional";
          const isFree = planId === "free";
          const isGallery = planId === "gallery";

          const priceDisplay = isFree
            ? "PKR 0"
            : isPro
              ? "PKR 500"
              : formatPKR(plan?.monthlyPrice ?? 10000);

          const periodDisplay = isFree ? "forever" : isPro ? "/year" : "/month";

          const buttonLabel = isFree
            ? "Start Selling Free"
            : isPro
              ? "Go Professional — PKR 500/year"
              : "Choose Gallery";

          return (
            <article
              key={planId}
              data-plan-card={planId}
              className={`relative flex min-h-[550px] min-w-0 flex-col rounded-2xl border p-6 md:p-8 opacity-100 ${
                isPro
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--ivory)] shadow-[var(--shadow-lift)] ring-2 ring-[var(--oxblood)]"
                  : "border-[var(--color-border)] bg-[var(--porcelain)]"
              } ${selected === planId ? "ring-2 ring-[var(--terracotta)] ring-offset-2" : ""}`}
            >
              {isPro && (
                <span className="absolute -top-3.5 left-6 rounded-full bg-[var(--terracotta)] px-3.5 py-1 text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                  MOST POPULAR
                </span>
              )}
              <h2 className="font-display text-3xl">
                {plan?.name ?? (isFree ? "Free" : isPro ? "Professional" : "Gallery")}
              </h2>

              <div className="mt-5 flex min-w-0 flex-wrap items-baseline gap-x-1">
                <span className="font-display text-4xl leading-none">{priceDisplay}</span>
                <span
                  className={`text-xs font-semibold ${isPro ? "text-white/70" : "text-muted-foreground"}`}
                >
                  {periodDisplay}
                </span>
              </div>

              {isPro && (
                <p className="mt-1.5 text-xs text-[var(--terracotta)] font-medium">
                  Less than PKR 42/month
                </p>
              )}

              <dl
                className={`mt-5 grid gap-2 border-y py-4 text-xs ${
                  isPro
                    ? "border-white/12 text-white/72"
                    : "border-[var(--color-border)] text-muted-foreground"
                }`}
              >
                <div className="flex justify-between gap-3">
                  <dt>Commission</dt>
                  <dd className="font-semibold">{isGallery ? "0%" : "20%"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Listings</dt>
                  <dd className="text-right font-semibold">
                    {isFree ? "5 active artworks" : isPro ? "200 listings" : "Fair-use unlimited"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Payout</dt>
                  <dd className="text-right font-semibold">
                    {plan?.payoutTime ?? "1–3 working days"}
                  </dd>
                </div>
              </dl>

              <ul className="mt-6 flex-1 space-y-3">
                {(plan?.features ?? []).map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm leading-relaxed">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${isPro ? "text-[var(--terracotta)]" : "text-[var(--oxblood)]"}`}
                    />
                    <span className="min-w-0">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => void choose(planId)}
                disabled={!ready || selecting !== null}
                className={`mt-8 min-h-12 w-full text-sm font-semibold transition ${
                  isPro
                    ? "btn-primary bg-[var(--terracotta)] !text-[var(--ink)] hover:brightness-110"
                    : "btn-ghost border-[var(--color-border-strong)] hover:border-[var(--oxblood)]"
                }`}
              >
                {!ready
                  ? "Checking your account…"
                  : selecting === planId
                    ? "Saving your plan…"
                    : buttonLabel}
              </button>

              {isGallery && (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Gallery should remain designed for galleries, organizations, and businesses
                  managing multiple artists rather than individual artists.
                </p>
              )}
            </article>
          );
        })}
      </section>

      <section className="mt-16">
        <div className="eyebrow">Full comparison</div>
        <h2 className="mt-3 font-display text-4xl">Compare every detail.</h2>
        <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] md:block">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--ivory)]">
              <tr>
                <th className="p-4">Feature</th>
                {PLAN_ORDER.map((id) => (
                  <th key={id} className="p-4">
                    {SUBSCRIPTION_PLANS[id]?.name ?? id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label} className="border-b border-[var(--color-border)] last:border-0">
                  <th className="p-4 font-semibold">{row.label}</th>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="p-4 text-muted-foreground">
                      {row.values[id] === "—" ? <Minus className="h-4 w-4" /> : row.values[id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 space-y-3 md:hidden">
          {PLAN_ORDER.map((id) => (
            <details
              key={id}
              className="group rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between font-display text-2xl">
                {SUBSCRIPTION_PLANS[id]?.name ?? id}
                <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
              </summary>
              <dl className="mt-5 divide-y divide-[var(--color-border)]">
                {comparison.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 py-3 text-sm">
                    <dt className="font-semibold">{row.label}</dt>
                    <dd className="text-right text-muted-foreground">{row.values[id]}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => void choose(id)}
                disabled={!ready || selecting !== null}
                className="btn-primary mt-5 w-full disabled:cursor-wait disabled:opacity-65"
              >
                {!ready
                  ? "Checking your account…"
                  : selecting === id
                    ? "Saving your plan…"
                    : id === "free"
                      ? "Start Selling Free"
                      : id === "professional"
                        ? "Go Professional — PKR 500/year"
                        : "Choose Gallery"}
              </button>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-10 flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 text-[var(--indigo)]" />
        <p>
          Artist Verification (<strong>✓ Verified Artist</strong>) is evaluated separately from
          subscription plans by ArtDera administration. Paid plans proceed to checkout after account
          setup.
        </p>
      </div>
      <div className="mt-8 text-center text-sm">
        <Link to="/sell" className="font-semibold underline">
          Back to Sell on ArtDera
        </Link>
      </div>
    </div>
  );
}
