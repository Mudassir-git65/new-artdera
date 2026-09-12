import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS } from "@/lib/artdera";
import { ProductCard } from "@/components/site/ProductCard";
import { generateMeta, generateItemListSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/photography")({
  head: () => {
    const photos = PRODUCTS.filter((p) => p.categorySlug === "photography");
    const seo = generateMeta({
      title: "Fine Art Photography Prints for Sale | ArtDera",
      description:
        "Discover fine-art photography prints, architectural studies, and landscapes by independent photographers. Archival pigment prints and numbered limited editions.",
      canonicalPath: "/photography",
    });

    const items = photos.map((p) => ({
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
              "Fine Art Photography Prints",
              "Curated archival photography prints and limited editions.",
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
              { name: "Photography", path: "/photography" },
            ]),
          ),
        },
      ],
    };
  },
  component: PhotographyPage,
});

function PhotographyPage() {
  const photoWorks = PRODUCTS.filter((p) => p.categorySlug === "photography");

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
          <li className="font-semibold text-foreground">Photography</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">Lens &amp; Light</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Fine-Art Photography Prints
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Explore museum-quality photographic prints, documentary series, architectural studies, and
          natural landscapes. Published in numbered limited editions and signed open releases.
        </p>
      </header>

      <section aria-label="Photography Subcategories" className="mt-8 flex flex-wrap gap-2">
        <Link to="/discover" search={{ category: "photography" }} className="chip">
          All Photography
        </Link>
        <Link to="/discover" search={{ kind: "Limited Edition" }} className="chip">
          Limited Editions
        </Link>
        <Link to="/discover" search={{ q: "landscape" }} className="chip">
          Landscapes
        </Link>
        <Link to="/discover" search={{ q: "architecture" }} className="chip">
          Architecture &amp; Cityscapes
        </Link>
      </section>

      <main className="mt-12">
        <div className="grid grid-cols-1 gap-x-5 gap-y-12 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {photoWorks.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </main>

      <section className="mt-20 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-10">
        <h2 className="font-display text-3xl">Collecting Fine-Art Photography</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="font-semibold">Archival Pigment Printing</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Printed using 12-colour archival inks on 100% cotton rag paper, ensuring lightfastness
              for up to 100 years.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Edition Numbers</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Limited edition prints specify exact run sizes (e.g. Ed. of 10), preserving scarcity
              and collector value over time.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Hanging &amp; Scale</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Large-format photographic prints work exceptionally well as statement pieces in living
              rooms, boardrooms, and corridors.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
