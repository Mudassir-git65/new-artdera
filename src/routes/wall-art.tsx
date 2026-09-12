import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS } from "@/lib/artdera";
import { ProductCard } from "@/components/site/ProductCard";
import { generateMeta, generateItemListSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/wall-art")({
  head: () => {
    const wallArt = PRODUCTS.filter(
      (p) => p.categorySlug === "wall-decor" || p.categorySlug === "originals",
    );
    const seo = generateMeta({
      title: "Wall Art & Decorative Hanging Works | ArtDera",
      description:
        "Transform your living room, bedroom, and office with curated wall art, large-scale original canvases, and statement decorative works from ArtDera.",
      canonicalPath: "/wall-art",
    });

    const items = wallArt.map((p) => ({
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
              "Wall Art & Decor",
              "Curated wall hanging art and interior decor.",
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
              { name: "Wall Art", path: "/wall-art" },
            ]),
          ),
        },
      ],
    };
  },
  component: WallArtPage,
});

function WallArtPage() {
  const wallArtWorks = PRODUCTS;

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
          <li className="font-semibold text-foreground">Wall Art</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">Interior Styling</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Wall Art &amp; Decorative Pieces
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Curated statement art, wall-hanging textiles, and architectural pieces designed to
          transform living rooms, dining spaces, bedrooms, and commercial interiors.
        </p>
      </header>

      <section aria-label="Room Filter Links" className="mt-8 flex flex-wrap gap-2">
        <Link to="/discover" search={{ room: "living-room" }} className="chip">
          Living Room Art
        </Link>
        <Link to="/discover" search={{ room: "bedroom" }} className="chip">
          Bedroom Art
        </Link>

        <Link to="/discover" search={{ room: "office" }} className="chip">
          Office &amp; Workspaces
        </Link>

        <Link to="/discover" search={{ room: "dining" }} className="chip">
          Dining Spaces
        </Link>
      </section>

      <main className="mt-12">
        <div className="grid grid-cols-1 gap-x-5 gap-y-12 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {wallArtWorks.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </main>
    </div>
  );
}
