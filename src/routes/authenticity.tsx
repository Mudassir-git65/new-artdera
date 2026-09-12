import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, ShieldCheck, FileCheck } from "lucide-react";
import { generateMeta, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/authenticity")({
  head: () => {
    const seo = generateMeta({
      title: "Artwork Authenticity & Seller Verification Policy | ArtDera",
      description:
        "Learn how ArtDera ensures artwork authenticity, artist identity verification, Certificates of Authenticity (COA), and transparent item disclosures.",
      canonicalPath: "/authenticity",
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
              { name: "Authenticity & Trust", path: "/authenticity" },
            ]),
          ),
        },
      ],
    };
  },
  component: AuthenticityPage,
});

function AuthenticityPage() {
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
          <li className="font-semibold text-foreground">Authenticity Policy</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">Trust &amp; Transparency</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Artwork Authenticity &amp; Disclosures
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          We believe that collector confidence rests on verified artist identities, transparent
          creation disclosures, and clear provenance records for every work on ArtDera.
        </p>
      </header>

      <section className="mt-16 grid gap-8 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <BadgeCheck className="h-6 w-6 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-2xl">Verified Creators</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Seller profiles undergo identity verification and portfolio review prior to publishing
            listings on the marketplace.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <FileCheck className="h-6 w-6 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-2xl">Certificates of Authenticity</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Original paintings and limited edition prints include signed Certificates of
            Authenticity issued by the artist or representing gallery.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <ShieldCheck className="h-6 w-6 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-2xl">Explicit Disclosure Labels</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Listings explicitly declare whether a work is an Original, Limited Edition, Open
            Edition, Handmade, or AI-assisted creation.
          </p>
        </div>
      </section>
    </div>
  );
}
