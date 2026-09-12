import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS } from "@/lib/artdera";
import { ProductCard } from "@/components/site/ProductCard";
import { generateMeta, generateItemListSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/calligraphy")({
  head: () => {
    const works = PRODUCTS.filter((p) => p.categorySlug === "calligraphy");
    const seo = generateMeta({
      title: "Original Calligraphy Art & Nastaliq Scripts | ArtDera",
      description:
        "Browse original Islamic, Urdu, and Arabic calligraphy works by verified calligraphers. Ink on wasli paper, gold leaf, and modern calligraphic paintings.",
      canonicalPath: "/calligraphy",
    });

    const items = works.map((p) => ({
      title: p.title,
      slug: p.slug,
      image: p.images[0],
      price: p.price,
    }));

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            generateItemListSchema(
              "Calligraphy Art for Sale",
              "Original calligraphy art across Nastaliq, Kufic, and modern abstract script.",
              items,
            ),
          ),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Discover", path: "/discover" },
              { name: "Calligraphy", path: "/calligraphy" },
            ]),
          ),
        },
      ],
    };
  },
  component: CalligraphyPage,
});

function CalligraphyPage() {
  const calligraphyWorks = PRODUCTS.filter((p) => p.categorySlug === "calligraphy");

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
            <Link to="/discover" className="hover:text-foreground">
              Discover
            </Link>
          </li>
          <li>/</li>
          <li className="font-semibold text-foreground">Calligraphy</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">Script &amp; Tradition</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Calligraphy Art &amp; Script Works
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Explore contemporary and classical calligraphic artwork in Nastaliq, Kufic, and modern
          script. Masterpieces rendered in ink on wasli, gold illumination, and statement canvases.
        </p>
      </header>

      <section aria-label="Calligraphy Filters" className="mt-8 flex flex-wrap gap-2">
        <Link to="/discover" search={{ category: "calligraphy" }} className="chip">
          All Calligraphy
        </Link>
        <Link to="/discover" search={{ q: "wasli" }} className="chip">
          Ink on Wasli
        </Link>
        <Link to="/discover" search={{ q: "gold" }} className="chip">
          Gold Illumination
        </Link>
        <Link to="/discover" search={{ framed: "true" }} className="chip">
          Framed Works
        </Link>
      </section>

      <main className="mt-12">
        <div className="grid grid-cols-1 gap-x-5 gap-y-12 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {calligraphyWorks.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </main>

      <section className="mt-20 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-10">
        <h2 className="font-display text-3xl">Understanding Calligraphy Materials &amp; Framing</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="font-semibold">Wasli Paper</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Traditional hand-burnished paper layered for durability, ideal for absorbing natural
              inks without bleeding.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Framing &amp; Mounting</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Works on paper require UV-protective glass and acid-free matting to preserve pigment
              and gilding over decades.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Custom Script Commissions</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Connect directly with master calligraphers to request bespoke verses, family names, or
              architectural installations.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
