import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ShieldCheck, Sparkles } from "lucide-react";
import { generateMeta, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/for-interior-designers")({
  head: () => {
    const seo = generateMeta({
      title: "Art Sourcing for Interior Designers & Architects | ArtDera Trade",
      description:
        "ArtDera Trade offers dedicated art sourcing, custom commissions, trade discounts, and project curation for interior designers, architects, and hospitality buyers.",
      canonicalPath: "/for-interior-designers",
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
              { name: "For Interior Designers", path: "/for-interior-designers" },
            ]),
          ),
        },
      ],
    };
  },
  component: TradePage,
});

function TradePage() {
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
          <li className="font-semibold text-foreground">For Interior Designers</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">ArtDera Trade Program</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Curated Art Sourcing for Interior Designers &amp; Architects
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          We partner with interior design studios, architects, hotel developers, and corporate
          procurement teams to source original paintings, photography series, and custom calligraphy
          installations.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/trade" className="btn-primary">
            Join ArtDera Trade Program
          </Link>
          <Link to="/discover" className="btn-ghost">
            Browse Trade Catalogue
          </Link>
        </div>
      </header>

      <section className="mt-16 grid gap-8 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <Building2 className="h-6 w-6 text-[var(--indigo)]" />
          <h2 className="mt-4 font-display text-2xl">Hospitality &amp; Commercial</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Multi-room print editions, lobby statement originals, and durable framing options
            tailored for high-traffic environments.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <Sparkles className="h-6 w-6 text-[var(--indigo)]" />
          <h2 className="mt-4 font-display text-2xl">Bespoke Commissions</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Commission artists to match precise room color palettes, custom wall dimensions, or
            architectural project briefs.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <ShieldCheck className="h-6 w-6 text-[var(--indigo)]" />
          <h2 className="mt-4 font-display text-2xl">Dedicated Concierge</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Single point of contact for invoicing, logistics, consolidated shipping, and delivery
            timelines.
          </p>
        </div>
      </section>
    </div>
  );
}
