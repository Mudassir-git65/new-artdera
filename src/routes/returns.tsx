import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, RotateCcw, HelpCircle } from "lucide-react";
import { generateMeta, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/returns")({
  head: () => {
    const seo = generateMeta({
      title: "Buyer Protection & Return Eligibility Policy | ArtDera",
      description:
        "Understand ArtDera's return policy, buyer protection window, damage inspection, and refund resolution process for marketplace artwork purchases.",
      canonicalPath: "/returns",
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
              { name: "Returns & Refund Policy", path: "/returns" },
            ]),
          ),
        },
      ],
    };
  },
  component: ReturnsPage,
});

function ReturnsPage() {
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
          <li className="font-semibold text-foreground">Returns Policy</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">Buyer Confidence</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Return Eligibility &amp; Refund Policy
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          ArtDera buyer protection provides clear resolution for transit damage, listing
          discrepancies, or eligible return requests so you can collect with total peace of mind.
        </p>
      </header>

      <section className="mt-16 grid gap-8 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <ShieldCheck className="h-6 w-6 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-2xl">Inspection Window</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Buyers have a 7-day inspection window upon delivery to unbox, inspect, and verify the
            artwork matches listing specifications.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <RotateCcw className="h-6 w-6 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-2xl">Transit Damage Cover</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            In the rare event of transit damage, report the issue with photos within 48 hours for
            immediate return packaging and replacement/refund processing.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <HelpCircle className="h-6 w-6 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-2xl">Dispute Support</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            ArtDera support mediates disputes between buyers and sellers to ensure fair resolution
            under published platform guidelines.
          </p>
        </div>
      </section>
    </div>
  );
}
