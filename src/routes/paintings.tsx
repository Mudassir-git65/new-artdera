import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS, formatPKR } from "@/lib/artdera";
import { ProductCard } from "@/components/site/ProductCard";
import { generateMeta, generateItemListSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/paintings")({
  head: () => {
    const paintings = PRODUCTS.filter(
      (p) =>
        p.categorySlug === "originals" ||
        p.medium.toLowerCase().includes("oil") ||
        p.medium.toLowerCase().includes("acrylic"),
    );
    const seo = generateMeta({
      title: "Original Paintings for Sale | Buy Fine Art Online on ArtDera",
      description:
        "Explore curated original oil paintings, acrylic works, and mixed media canvases from independent artists and galleries. Authenticity declared, nationwide tracked delivery.",
      canonicalPath: "/paintings",
    });

    const items = paintings.map((p) => ({
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
              "Original Paintings for Sale",
              "Curated original paintings, acrylics, and oil works from independent artists.",
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
              { name: "Paintings", path: "/paintings" },
            ]),
          ),
        },
      ],
    };
  },
  component: PaintingsPage,
});

function PaintingsPage() {
  const paintings = PRODUCTS.filter(
    (p) =>
      p.categorySlug === "originals" ||
      p.medium.toLowerCase().includes("oil") ||
      p.medium.toLowerCase().includes("acrylic") ||
      p.medium.toLowerCase().includes("board") ||
      p.medium.toLowerCase().includes("canvas"),
  );

  return (
    <div className="container-editorial py-12 lg:py-16">
      {/* Breadcrumb Navigation */}
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
          <li className="font-semibold text-foreground">Paintings</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">Original Art &amp; Mediums</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Original Paintings for Sale
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Discover one-of-a-kind oil paintings, acrylic on canvas, and mixed-media works by emerging
          and established independent artists. Every piece includes creator disclosures, dimensions,
          and tracked shipping.
        </p>
      </header>

      {/* Subcategory & Filter Quick Links */}
      <section aria-label="Painting Subcategories" className="mt-8 flex flex-wrap gap-2">
        <Link to="/discover" search={{ category: "originals" }} className="chip">
          All Originals
        </Link>
        <Link to="/discover" search={{ q: "oil" }} className="chip">
          Oil Paintings
        </Link>
        <Link to="/discover" search={{ q: "acrylic" }} className="chip">
          Acrylic Canvases
        </Link>
        <Link to="/discover" search={{ color: "terracotta" }} className="chip">
          Terracotta Tones
        </Link>

        <Link to="/discover" search={{ max: 50000 }} className="chip">
          Under PKR 50,000
        </Link>
      </section>

      {/* Main Grid */}
      <main className="mt-12">
        <div className="grid grid-cols-1 gap-x-5 gap-y-12 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {paintings.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </main>

      {/* Educational & Buyer Guidance Footer */}
      <section className="mt-20 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-10">
        <h2 className="font-display text-3xl">How to Choose an Original Painting</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="font-semibold">1. Evaluate Scale &amp; Proportion</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Measure your wall space and allow 6 to 12 inches of negative space around the artwork
              so the painting can breathe within the room.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">2. Medium &amp; Preservation</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Oil paintings offer rich depth and texture, while acrylic works dry quickly with crisp
              vibrancy. Keep paintings out of direct sunlight.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">3. Seller Disclosures &amp; Support</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              All ArtDera listings state medium, creation year, framing status, and artist
              attribution for complete buyer confidence.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
