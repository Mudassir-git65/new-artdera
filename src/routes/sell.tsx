import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  Globe2,
  LayoutDashboard,
  MessageCircle,
  PackageCheck,
  Palette,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { IMAGES } from "@/lib/artdera";
import { useEffect, useState } from "react";
import { PLANS } from "@/marketplace/config";
import { SubscriptionService } from "@/marketplace/services";
import type { ArtistFlowState } from "@/marketplace/types";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell on ArtDera — Build Your Professional Art Store" },
      {
        name: "description",
        content:
          "Create an ArtDera storefront, reach collectors and manage artwork, orders, shipping and buyer conversations from one simple dashboard.",
      },
      { property: "og:title", content: "Turn Your Art Into a Professional Online Store" },
      { property: "og:image", content: IMAGES.creator1 },
    ],
    links: [{ rel: "canonical", href: "/sell" }],
  }),
  component: SellRoute,
});

function SellRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/sell" ? <Sell /> : <Outlet />;
}

const benefits = [
  [
    Store,
    "Professional storefront",
    "A polished public home for your work, biography, collections and reviews.",
  ],
  [
    Palette,
    "Easy artwork management",
    "Publish, update and organise artwork without technical experience.",
  ],
  [
    MessageCircle,
    "Buyer communication",
    "Keep questions, offers and consultation requests in one protected place.",
  ],
  [
    BarChart3,
    "Store analytics",
    "Understand views, saves, enquiries and orders in clear language.",
  ],
  [
    Sparkles,
    "Sponsored visibility",
    "Choose optional, clearly labelled promotions with transparent pricing.",
  ],
  [
    Truck,
    "Order and shipping tools",
    "Prepare orders, estimate shipping and follow delivery milestones.",
  ],
  [
    Users,
    "Customer management",
    "Eligible plans can organise collectors, notes and consent-aware follow-ups.",
  ],
  [
    Building2,
    "Gallery tools",
    "Manage represented artists, staff, exhibitions, inventory and reports.",
  ],
] as const;

const faqs = [
  [
    "Can I start for free?",
    "Yes. The Free plan costs PKR 0 per month and supports up to five active artwork listings.",
  ],
  [
    "How many artworks can I upload?",
    "Free supports 5 active listings, Professional supports 200 listings, and Gallery supports fair-use unlimited listings.",
  ],
  [
    "Can I change my plan later?",
    "Yes. The billing area lets you compare, upgrade, downgrade, cancel and reactivate a plan.",
  ],
  [
    "Does ArtDera charge commission?",
    "The current rates are 20% for Free, 20% for Professional, and 0% for Gallery. Payment processing, shipping, taxes and optional services are itemized separately where applicable.",
  ],
  [
    "How do sponsored listings work?",
    "You select an artwork, placement and dates. Sponsored work is labelled and limited to no more than one in every five marketplace cards.",
  ],
  [
    "When will I receive my payout?",
    "The expected timing depends on your plan and begins after successful delivery and order completion. Payout availability depends on the configured provider.",
  ],
  [
    "Can galleries manage multiple artists?",
    "Yes. Gallery accounts include managed artists, staff roles, inventory, exhibitions, CRM and reporting tools.",
  ],
  [
    "Can I communicate with buyers?",
    "Yes. ArtDera provides in-platform messages, offers and video-consultation requests.",
  ],
  [
    "Can buyers contact me directly on WhatsApp?",
    "Not before purchase. Direct contact is revealed only after a confirmed order when delivery coordination requires it.",
  ],
  [
    "Can I sell internationally?",
    "Professional and Gallery accounts include international buyer tools. Courier and payment coverage depends on the configured providers.",
  ],
  [
    "Can I cancel my subscription?",
    "Yes. Cancellation is scheduled for the end of the current billing period; listings remain safe and plan-limit rules are explained before changes.",
  ],
  [
    "Is verification automatic?",
    "No. Paying for a plan never guarantees a verified badge. Every verification request is subject to review.",
  ],
] as const;

function Sell() {
  const [recovery, setRecovery] = useState<ArtistFlowState | null>(null);
  useEffect(() => {
    const flow = SubscriptionService.getFlow();
    if (flow.selection && !flow.onboardingComplete) setRecovery(flow);
  }, []);
  const recoveryRoute = !recovery?.signupComplete
    ? recovery?.selection
      ? `/artist/signup?plan=${recovery.selection.planId}&billing=${recovery.selection.billingCycle}`
      : "/sell/plans"
    : !recovery.paymentComplete
      ? "/artist/checkout"
      : "/artist/onboarding";
  const lastStep = !recovery?.signupComplete
    ? "Plan selected"
    : !recovery.paymentComplete
      ? "Account created"
      : `Onboarding step ${recovery.onboardingStep + 1} of 8`;
  return (
    <div>
      <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--ivory)]">
        <div className="absolute inset-0 opacity-25">
          <img src={IMAGES.heroStudio} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--ink)] via-[var(--ink)]/90 to-transparent" />
        </div>
        <div className="container-editorial relative grid min-h-[650px] items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="max-w-3xl">
            <div className="eyebrow !text-white/55">Sell on ArtDera</div>
            <h1 className="mt-5 text-balance font-display text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
              Turn Your Art Into a Professional Online Store
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/72 sm:text-lg">
              Create your ArtDera store, display your work, reach art collectors and manage your art
              business from one simple dashboard.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/sell/plans"
                className="btn-primary min-h-12 bg-[var(--terracotta)] !text-[var(--ink)]"
              >
                View Plans and Start Selling <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="btn-ghost min-h-12 !border-white/25 !text-white hover:!border-white hover:!bg-white/10"
              >
                See How It Works
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-white/62">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[var(--terracotta)]" /> Start free
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--terracotta)]" /> Secure server-validated
                checkout mode
              </span>
              <span className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-[var(--terracotta)]" /> International tools on
                eligible plans
              </span>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="glass-dark rounded-3xl border border-white/10 p-5 shadow-[var(--shadow-lift)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs text-white/50">Your studio</div>
                  <div className="mt-1 font-display text-2xl">One calm dashboard</div>
                </div>
                <LayoutDashboard className="h-7 w-7 text-[var(--terracotta)]" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ["Store views", "2,480"],
                  ["Artwork saves", "186"],
                  ["New messages", "24"],
                  ["Orders", "12"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white/7 p-4">
                    <div className="text-xs text-white/48">{label}</div>
                    <div className="mt-2 font-display text-3xl">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl bg-[var(--terracotta)] p-4 text-[var(--ink)]">
                <div className="text-xs font-bold uppercase tracking-[0.14em]">
                  Next best action
                </div>
                <div className="mt-2 flex items-center justify-between font-semibold">
                  Reply to a collector <MessageCircle className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {recovery?.selection && (
        <section className="container-editorial pt-8">
          <div className="flex flex-col justify-between gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center md:p-6">
            <div>
              <div className="eyebrow">Continue Setting Up Your ArtDera Store</div>
              <h2 className="mt-2 font-display text-3xl">Your progress is safe in this browser.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {PLANS[recovery.selection.planId].name} Plan · Last completed: {lastStep} · Your
                remaining steps will resume where you left off.
              </p>
            </div>
            <a href={recoveryRoute} className="btn-primary shrink-0">
              Continue Setup <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      )}

      <section id="how-it-works" className="container-editorial section-y scroll-mt-28">
        <div className="eyebrow">How it works</div>
        <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <h2 className="max-w-xl font-display text-4xl md:text-5xl">
            From first choice to first listing.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            A guided setup that keeps advanced business details out of the way until you need them.
          </p>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            ["01", "Choose a plan", "Compare every plan before creating an account."],
            ["02", "Create your account", "Enter only the details needed to begin safely."],
            ["03", "Build your store", "Follow clear steps with a live store preview."],
            ["04", "Add art and sell", "Publish when ready, then manage everything in one place."],
          ].map(([number, title, body], index) => (
            <li
              key={number}
              className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6"
            >
              <div className="font-display text-4xl text-[var(--oxblood)]">{number}</div>
              <h3 className="mt-5 text-2xl">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              {index < 3 && (
                <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 rounded-full bg-[var(--ivory)] p-1 text-muted-foreground md:block" />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--porcelain)]">
        <div className="container-editorial section-y">
          <div className="eyebrow">Built for the business of art</div>
          <h2 className="mt-3 max-w-2xl font-display text-4xl md:text-5xl">
            Professional tools, explained simply.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(([Icon, title, body]) => (
              <article
                key={title}
                className="rounded-2xl border border-[var(--color-border)] bg-white/45 p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ivory)] text-[var(--oxblood)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-2xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-editorial section-y">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <div className="eyebrow">Who can join</div>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">
              A store model for every serious practice.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [
                Palette,
                "Individual Artist",
                "A clear, approachable start for an independent practice.",
              ],
              [
                BadgeCheck,
                "Professional Artist",
                "More listings, detailed insight and a verification review.",
              ],
              [
                Building2,
                "Art Gallery or Art Business",
                "Multiple artists, staff accounts, inventory and exhibitions.",
              ],
            ].map(([Icon, title, body]) => {
              const ItemIcon = Icon as typeof Palette;
              return (
                <div
                  key={title as string}
                  className="rounded-2xl bg-[var(--ink)] p-6 text-[var(--ivory)]"
                >
                  <ItemIcon className="h-6 w-6 text-[var(--terracotta)]" />
                  <h3 className="mt-6 text-2xl">{title as string}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/62">{body as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[var(--indigo)] text-[var(--ivory)]">
        <div className="container-editorial grid gap-10 py-16 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <PackageCheck className="h-9 w-9 text-[var(--terracotta)]" />
            <h2 className="mt-5 font-display text-4xl">Trust is part of the product.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Artists control their profiles and artwork information.",
              "Buyer contact details remain protected before an order.",
              "Sponsored listings are always clearly labelled.",
              "Verification is subject to review — never guaranteed by payment.",
              "ArtDera supports safe communication and transparent transactions.",
            ].map((text) => (
              <div
                key={text}
                className="flex gap-3 rounded-xl border border-white/12 p-4 text-sm leading-relaxed text-white/75"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--terracotta)]" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-editorial section-y">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <div className="eyebrow">Seller FAQ</div>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">Questions before you begin.</h2>
          </div>
          <div className="mt-10 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-1">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 font-semibold">
                  {question}
                  <span className="text-xl transition group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-3xl pb-6 text-sm leading-relaxed text-muted-foreground">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container-editorial pb-20">
        <div className="overflow-hidden rounded-3xl bg-[var(--oxblood)] p-8 text-[var(--ivory)] md:p-12">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <div className="eyebrow !text-white/55">Your store starts here</div>
              <h2 className="mt-3 max-w-2xl font-display text-4xl md:text-5xl">
                Compare every plan. Start only when it feels right.
              </h2>
            </div>
            <Link
              to="/sell/plans"
              className="btn-primary min-h-12 bg-[var(--porcelain)] !text-[var(--ink)]"
            >
              View Plans and Start Selling <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
