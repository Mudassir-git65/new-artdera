import { SiteLink } from "@/components/site/SiteLink";
import { createFileRoute } from "@tanstack/react-router";
import { fetchCollectionCatalog } from "@/lib/server-loaders";
import { ProductCard } from "@/components/site/ProductCard";
import { artworkImageUrl, artworkImageSrcSet } from "@/lib/artwork-image";

export const Route = createFileRoute("/collections")({
  loader: () => fetchCollectionCatalog(),
  head: () => ({
    meta: [
      { title: "Collections — ArtDera" },
      {
        name: "description",
        content:
          "Curated collections from ArtDera — considered edits of original works, prints and photography.",
      },
      { property: "og:title", content: "Collections — ArtDera" },
      { property: "og:url", content: "/collections" },
    ],
    links: [{ rel: "canonical", href: "/collections" }],
  }),
  component: Collections,
});

function Collections() {
  const { collections: COLLECTIONS, products: PRODUCTS } = Route.useLoaderData();
  const productsBySlug = new Map(PRODUCTS.map((product) => [product.slug, product]));
  return (
    <div className="container-editorial py-14">
      <div className="max-w-2xl">
        <div className="eyebrow">Collections</div>
        <h1 className="mt-3 font-display text-5xl">Considered edits.</h1>
        <p className="mt-4 text-muted-foreground">
          Small groupings chosen by our curators around a mood, a price, or a way of living with
          art.
        </p>
      </div>
      <div className="mt-14 space-y-24">
        {COLLECTIONS.map((col) => {
          const items = col.products.map((s) => productsBySlug.get(s)!).filter(Boolean);
          return (
            <section key={col.slug}>
              <div className="grid md:grid-cols-[1fr_1.4fr] gap-8 items-end">
                <div>
                  <div className="eyebrow">Collection</div>
                  <h2 className="mt-3 font-display text-4xl">{col.name}</h2>
                  <p className="mt-3 text-muted-foreground">{col.blurb}</p>
                </div>
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg">
                  <img
                    src={artworkImageUrl(col.cover, 960)}
                    srcSet={artworkImageSrcSet(col.cover)}
                    sizes="(max-width: 767px) 100vw, 60vw"
                    decoding="async"
                    alt={col.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-4">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
