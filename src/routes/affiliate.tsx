import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgePercent, Clock3, Link2, Share2, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/marketplace/auth";
import { AffiliateService } from "@/marketplace/services";
import { generateMeta } from "@/lib/seo";

export const Route = createFileRoute("/affiliate")({
  head: () =>
    generateMeta({
      title: "ArtDera Ambassador Program",
      description:
        "Share artwork you love, give collectors a discount, and earn from eligible ArtDera sales.",
      canonicalPath: "/affiliate",
    }),
  component: AffiliateProgramPage,
});

function AffiliateProgramPage() {
  const { user, ready } = useAuth();
  const [program, setProgram] = useState({
    enabled: true,
    commissionRate: 5,
    buyerDiscountRate: 10,
    attributionDays: 30,
    minimumPayoutUsd: 25,
  });
  useEffect(() => {
    void AffiliateService.program().then((result) => {
      if (result.data) setProgram(result.data);
    });
  }, []);
  const destination = user ? "/account/ambassador" : "/auth/login?redirect=/account/ambassador";
  return (
    <div>
      <section className="relative overflow-hidden bg-[var(--ink)] pb-20 pt-16 text-[var(--ivory)] md:pb-28 md:pt-24">
        <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-[var(--terracotta)]/12 blur-3xl" />
        <div className="container-editorial relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="eyebrow !text-white/45">ArtDera Ambassador Program</div>
            <h1 className="mt-4 max-w-3xl font-display text-6xl leading-[.98] md:text-7xl">
              Share Art You Love. Earn When It Sells.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/65">
              Recommend original artwork and editions from ArtDera. Collectors receive{" "}
              {program.buyerDiscountRate}% off the eligible artwork price, and you earn{" "}
              {program.commissionRate}% from eligible completed sales.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={destination}
                className="btn-primary bg-[var(--terracotta)] !text-[var(--ink)]"
              >
                {ready && user ? "Open Ambassador Dashboard" : "Join the Program"}
              </a>
              <Link to="/discover" className="btn-ghost !border-white/20 !text-white">
                Explore shareable art
              </Link>
            </div>
            {!program.enabled && (
              <p className="mt-4 text-sm text-amber-200">
                New applications are temporarily paused.
              </p>
            )}
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur md:p-8">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Collector discount", `${program.buyerDiscountRate}%`, BadgePercent],
                ["Your commission", `${program.commissionRate}%`, WalletCards],
                ["Attribution window", `${program.attributionDays} days`, Clock3],
                ["Minimum payout", `$${program.minimumPayoutUsd}`, ShieldCheck],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="rounded-2xl bg-white/[0.07] p-5">
                  <Icon className="h-5 w-5 text-[var(--terracotta)]" />
                  <div className="mt-5 font-display text-3xl">{String(value)}</div>
                  <div className="mt-1 text-[11px] text-white/45">{String(label)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-editorial py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-3 font-display text-5xl">A simple way to champion artists.</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            [
              Share2,
              "Share artworks",
              "Choose work you genuinely love and share its personal referral link.",
            ],
            [
              Link2,
              "Collectors save",
              `Your protected code gives buyers ${program.buyerDiscountRate}% off eligible artwork—not shipping, taxes, customs or fees.`,
            ],
            [
              WalletCards,
              "Earn after completion",
              `You earn ${program.commissionRate}% of the final eligible artwork amount after delivery and the return period.`,
            ],
          ].map(([Icon, title, body], index) => (
            <article
              key={String(title)}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-8"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ivory)] text-[var(--oxblood)]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="eyebrow mt-6">Step {index + 1}</div>
              <h3 className="mt-2 font-display text-3xl">{String(title)}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{String(body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--porcelain)] py-16">
        <div className="container-editorial flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div>
            <div className="eyebrow">Open to every ArtDera account</div>
            <h2 className="mt-2 font-display text-4xl">Ready to share a more artful world?</h2>
          </div>
          <a href={destination} className="btn-primary shrink-0">
            {ready && user ? "Go to Ambassador Dashboard" : "Sign In and Join"}
          </a>
        </div>
      </section>
    </div>
  );
}
