import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { generateMeta, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/sell/art")({
  head: () => {
    const seo = generateMeta({
      title: "Sell Original Art Online | Join ArtDera Marketplace",
      description:
        "Build your online artist studio, exhibit paintings and original works to global art collectors, retain control over your inventory, and enjoy transparent seller terms.",
      canonicalPath: "/sell/art",
    });

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Sell", path: "/sell" },
              { name: "Sell Art", path: "/sell/art" },
            ]),
          ),
        },
      ],
    };
  },
  component: SellArtPage,
});

function SellArtPage() {
  return (
    <div className="container-editorial py-12 lg:py-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex items-center gap-2">
          <li>
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link to="/sell" className="hover:text-foreground">
              Sell
            </Link>
          </li>
          <li>/</li>
          <li className="font-semibold text-foreground">Sell Art</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">For Painters &amp; Independent Artists</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Sell Your Original Artwork Online
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          ArtDera gives independent painters, calligraphers, and visual artists a dedicated
          storefront to publish original works, manage commissions, and connect with serious
          collectors.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/sell/plans" className="btn-primary">
            Apply to Sell Original Art
          </Link>
          <Link to="/sell/plans" className="btn-ghost">
            View Seller Plans
          </Link>
        </div>
      </header>

      <section className="mt-16 grid gap-8 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <CheckCircle2 className="h-6 w-6 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-2xl">Verified Artist Identity</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Display your studio biography, education, exhibition history, and identity verification
            badge to build immediate buyer trust.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <CheckCircle2 className="h-6 w-6 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-2xl">Direct Commission Briefs</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Receive structured inquiry messages from interior designers and collectors seeking
            custom paintings or specialized scripts.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <CheckCircle2 className="h-6 w-6 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-2xl">Protected Payouts</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Get paid directly to your bank account upon order delivery with clear, upfront platform
            commission structures.
          </p>
        </div>
      </section>

      <section className="mt-16 rounded-2xl bg-[var(--ink)] p-8 text-white md:p-12">
        <h2 className="font-display text-3xl md:text-4xl">
          Ready to launch your studio storefront?
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">
          Create your profile in minutes, upload high-resolution images, and start reaching
          collectors worldwide.
        </p>
        <Link to="/sell/plans" className="btn-primary mt-8">
          Start Application <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
