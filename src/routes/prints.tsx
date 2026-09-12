import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS } from "@/lib/artdera";
import { ProductCard } from "@/components/site/ProductCard";
import { generateMeta, generateItemListSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/prints")({
  head: () => {
    const prints = PRODUCTS.filter(
      (p) => p.categorySlug === "prints" || p.kind.includes("Edition"),
    );
    const seo = generateMeta({
      title: "Art Prints & Limited Editions for Sale | ArtDera",
      description:
        "Shop affordable fine-art prints, giclée editions, and limited-run reproductions from independent creators. Museum-grade paper and archival inks.",
      canonicalPath: "/prints",
    });

    const items = prints.map((p) => ({
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
              "Art Prints & Limited Editions",
              "Curated fine-art prints and accessible reproductions.",
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
              { name: "Prints", path: "/prints" },
            ]),
          ),
        },
      ],
    };
  },
  component: PrintsPage,
});

function PrintsPage() {
  const printWorks = PRODUCTS.filter(
    (p) => p.categorySlug === "prints" || p.kind === "Limited Edition" || p.kind === "Open Edition",
  );

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
          <li className="font-semibold text-foreground">Prints &amp; Editions</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">Accessible Art</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Art Prints &amp; Limited Editions
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Bring fine art into your home with museum-quality giclée prints and limited-run editions.
          High-resolution color accuracy on premium textured paper.
        </p>
      </header>

      <section aria-label="Print Options" className="mt-8 flex flex-wrap gap-2">
        <Link to="/discover" search={{ category: "prints" }} className="chip">
          All Prints
        </Link>
        <Link to="/discover" search={{ max: 15000 }} className="chip">
          Under PKR 15,000
        </Link>
        <Link to="/discover" search={{ kind: "Open Edition" }} className="chip">
          Open Editions
        </Link>

        <Link to="/discover" search={{ kind: "Limited Edition" }} className="chip">
          Limited Runs
        </Link>
      </section>

      <main className="mt-12">
        <div className="grid grid-cols-1 gap-x-5 gap-y-12 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {printWorks.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </main>

      <section className="mt-20 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-10">
        <h2 className="font-display text-3xl">Why Choose Fine Art Prints?</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="font-semibold">Accessible Collecting</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Fine-art prints allow new collectors to enjoy original artwork styles at accessible
              price points.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Giclée Quality</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              High-resolution inkjet printing captures subtle brushwork and color transitions with
              fidelity.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Standard Dimensions</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Many prints are formatted to standard frame sizes for effortless framing and display.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
