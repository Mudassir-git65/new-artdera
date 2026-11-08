import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Flower2,
  Gift,
  Heart,
  House,
  Package,
  Paintbrush,
  Search,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { fetchCatalogPage } from "@/lib/server-loaders";
import { DECORA_CATEGORIES, DECORA_TAGLINE, decoraBrowseCategorySchema } from "@/lib/decora";
import { generateMeta, generateBreadcrumbSchema, generateItemListSchema } from "@/lib/seo";
import { artworkRouteSlug } from "@/lib/catalog-product";
import { artworkImageUrl } from "@/lib/artwork-image";
import type { Product } from "@/lib/artdera";
import { z } from "zod";

const searchSchema = z.object({
  category: decoraBrowseCategorySchema.optional().catch(undefined),
  budget: z.preprocess(
    (value) => (typeof value === "number" ? String(value) : value),
    z.enum(["all", "1000", "2000", "3000"]).catch("all"),
  ),
  q: z.preprocess(
    (value) => (typeof value === "number" ? String(value) : value),
    z.string().trim().max(120).catch(""),
  ),
  sort: z.enum(["newest", "popular", "price_asc", "price_desc"]).catch("newest"),
  cursor: z.string().max(2000).optional().catch(undefined),
});
type DecoraSearch = z.infer<typeof searchSchema>;
function href(search: Partial<DecoraSearch>) {
  const params = new URLSearchParams();
  Object.entries(search).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  return `/decora${params.size ? `?${params}` : ""}`;
}
const icons = [House, Gift, Heart, BookOpen, Paintbrush, Flower2, Sparkles];
const money = (value: number) =>
  `PKR ${value.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

export const Route = createFileRoute("/decora")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const min = deps.budget === "2000" ? 1000 : deps.budget === "3000" ? 2000 : 0;
    const max = deps.budget === "1000" ? 999.99 : deps.budget === "2000" ? 1999.99 : 3000;
    const [catalog, featured] = await Promise.all([
      fetchCatalogPage({
        data: {
          section: "decora",
          decoraCategory: deps.category,
          q: deps.q,
          min,
          max,
          sort: deps.sort,
          cursor: deps.cursor,
          limit: 12,
        },
      }),
      fetchCatalogPage({ data: { section: "decora", sort: "popular", limit: 4 } }),
    ]);
    return { catalog, featured: featured.products };
  },
  head: ({ loaderData }) => {
    const seo = generateMeta({
      title: "ArtDera Décora | Décor & Personalized Gifts Up to PKR 3,000",
      description:
        "Artful Décor. Thoughtful Gifts. Shop affordable home décor, personalized gifts, customized prayer mats, booklets, mini paintings, handmade crafts and accessories. Every piece at PKR 3,000 or less.",
      canonicalPath: "/decora",
      ogImage: "/images/hero-interior.jpg",
    });
    const items = (loaderData?.catalog.products ?? []).map((product) => ({
      ...product,
      slug: artworkRouteSlug(product),
      image: product.images[0],
    }));
    return {
      ...seo,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "ArtDera Décora", path: "/decora" },
            ]),
          ),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            generateItemListSchema("ArtDera Décora", DECORA_TAGLINE, items),
          ).replace(/</g, "\\u003c"),
        },
      ],
    };
  },
  component: DecoraPage,
  errorComponent: () => (
    <div className="container-editorial py-24 text-center">
      <h1 className="font-display text-4xl">Décora will be back shortly.</h1>
      <p className="mt-4 text-muted-foreground">
        We couldn’t load the collection. Please try again.
      </p>
      <a href="/decora" className="btn-primary mt-6">
        Try again
      </a>
    </div>
  ),
});

function DecoraPage() {
  const { catalog, featured } = Route.useLoaderData();
  const search = Route.useSearch();
  const filtered = Boolean(search.category || search.q || search.budget !== "all");
  return (
    <div>
      <section className="relative overflow-hidden bg-[#e9dfd2]">
        <div className="container-editorial grid items-center gap-8 py-10 md:grid-cols-2 md:gap-12 md:py-16 lg:py-20">
          <div className="relative z-10">
            <nav aria-label="Breadcrumb" className="mb-9 flex gap-2 text-xs text-muted-foreground">
              <a href="/" className="hover:underline">
                Home
              </a>
              <span>/</span>
              <span aria-current="page">Décora</span>
            </nav>
            <div className="eyebrow text-[var(--oxblood)]">The little things, beautifully made</div>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              ArtDera
              <br />
              <em className="text-[var(--oxblood)]">Décora.</em>
            </h1>
            <p className="mt-5 text-base font-medium tracking-wide">{DECORA_TAGLINE}</p>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
              A little beauty for your home. A little joy for someone you love. Thoughtful décor and
              personal gifts, with a price to make you smile.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a href="#decora-shop" className="btn-primary">
                Find your little treasure <ArrowUpRight className="h-4 w-4" />
              </a>
              <span className="text-xs font-semibold text-[var(--oxblood)]">
                Every piece at PKR 3,000 or less
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-lg pb-6 pl-4 pt-4">
            <div className="absolute inset-0 rounded-t-[48%] border border-[var(--oxblood)]/25" />
            <img
              src="/images/hero-interior.jpg"
              alt="An inviting home styled with warm textures, art and decorative details"
              width={1000}
              height={1200}
              fetchPriority="high"
              className="relative aspect-[5/4] w-full rounded-t-[48%] rounded-b-lg object-cover sm:aspect-[5/5]"
            />
            <div className="absolute bottom-0 left-0 max-w-[85%] rounded-xl border border-[var(--oxblood)]/10 bg-[var(--porcelain)] px-6 py-4 shadow-lg">
              <span className="eyebrow text-[var(--oxblood)]">Small details. Big feeling.</span>
              <p className="mt-1 font-display text-2xl">Beautifully within reach.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="border-b bg-[var(--porcelain)]">
        <div className="container-editorial grid grid-cols-1 gap-4 py-5 text-xs sm:grid-cols-3">
          {[
            [Gift, "Gifts with a personal touch"],
            [Flower2, "Crafted by independent sellers"],
            [Package, "Your familiar ArtDera checkout"],
          ].map(([Icon, text]) => {
            const Symbol = Icon as typeof Gift;
            return (
              <div key={String(text)} className="flex items-center justify-center gap-3">
                <Symbol className="h-4 w-4 text-[var(--oxblood)]" />
                <span>{String(text)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="decora-categories" className="container-editorial py-14 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow text-[var(--oxblood)]">A little something for every day</div>
            <h2 id="decora-categories" className="mt-3 font-display text-3xl sm:text-4xl">
              Find your kind of lovely.
            </h2>
          </div>
          <a href="#decora-shop" className="inline-flex items-center gap-2 text-xs font-semibold">
            Shop all Décora <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {DECORA_CATEGORIES.map((category, index) => {
            const Icon = icons[index];
            return (
              <a
                key={category.id}
                href={`${href({ ...search, category: category.id, cursor: undefined })}#decora-shop`}
                aria-current={search.category === category.id ? "true" : undefined}
                className="group rounded-xl border border-[var(--oxblood)]/10 bg-[var(--porcelain)] p-4 transition hover:-translate-y-1 hover:border-[var(--oxblood)]/50 hover:shadow-sm"
              >
                <div
                  className={`mb-4 flex aspect-[4/3] items-center justify-center rounded-t-[45%] rounded-b-lg ${index % 2 ? "bg-[#e9dfd2]" : "bg-[#efe8dc]"}`}
                >
                  <Icon
                    strokeWidth={1.2}
                    className="h-10 w-10 text-[var(--oxblood)] transition group-hover:scale-110"
                  />
                </div>
                <h3 className="text-xs font-semibold leading-5">{category.name}</h3>
              </a>
            );
          })}
        </div>
      </section>

      {featured.length > 0 && !filtered && !search.cursor && (
        <section aria-labelledby="decora-featured" className="container-editorial pb-16">
          <div className="eyebrow text-[var(--oxblood)]">The Décora edit</div>
          <h2 id="decora-featured" className="mt-3 font-display text-3xl sm:text-4xl">
            Featured little finds.
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
            {featured.map((product) => (
              <DecoraCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section
        id="decora-shop"
        aria-labelledby="decora-shop-title"
        className="scroll-mt-28 border-y bg-[var(--porcelain)] py-14 md:py-20"
      >
        <div className="container-editorial">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow text-[var(--oxblood)]">
                Thoughtfully chosen. Happily affordable.
              </div>
              <h2 id="decora-shop-title" className="mt-3 font-display text-3xl sm:text-4xl">
                The Décora collection.
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              All product prices at or below PKR 3,000
            </p>
          </div>
          <form
            action="/decora#decora-shop"
            method="get"
            className="mt-8 grid gap-3 rounded-xl border bg-[var(--ivory)] p-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto]"
          >
            <label className="text-[11px] font-semibold">
              Search Décora
              <div className="relative mt-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  name="q"
                  defaultValue={search.q}
                  maxLength={120}
                  placeholder="A gift, a detail, a little joy…"
                  className="art-field !pl-9"
                />
              </div>
            </label>
            <label className="text-[11px] font-semibold">
              Category
              <select
                name="category"
                defaultValue={search.category ?? ""}
                className="art-field mt-2"
              >
                <option value="">All categories</option>
                <option value="artworks">Artworks from the collection</option>
                {DECORA_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold">
              Price range
              <select name="budget" defaultValue={search.budget} className="art-field mt-2">
                <option value="all">All at PKR 3,000 or less</option>
                <option value="1000">Under PKR 1,000</option>
                <option value="2000">PKR 1,000 – 1,999</option>
                <option value="3000">PKR 2,000 – 3,000</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold">
              Sort by
              <select name="sort" defaultValue={search.sort} className="art-field mt-2">
                <option value="newest">Newest arrivals</option>
                <option value="popular">Most popular</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
            <button className="btn-primary self-end">
              <SlidersHorizontal className="h-4 w-4" /> Apply
            </button>
          </form>
          <div
            className="mt-6 flex items-center justify-between gap-3 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <span>
              {catalog.total} {catalog.total === 1 ? "find" : "finds"}
              {filtered ? " matching your filters" : " in the collection"}
            </span>
            {(filtered || search.cursor) && (
              <a
                href="/decora#decora-shop"
                className="font-semibold text-[var(--oxblood)] underline underline-offset-4"
              >
                Clear filters
              </a>
            )}
          </div>
          {catalog.products.length ? (
            <>
              <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                {catalog.products.map((product) => (
                  <DecoraCard key={product.id} product={product} />
                ))}
              </div>
              {catalog.nextCursor && (
                <div className="mt-12 text-center">
                  <a
                    href={`${href({ ...search, cursor: catalog.nextCursor })}#decora-shop`}
                    className="btn-ghost border"
                  >
                    Next finds <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="my-10 rounded-2xl border border-dashed bg-[var(--ivory)] px-5 py-16 text-center">
              <Flower2 strokeWidth={1.2} className="mx-auto h-12 w-12 text-[var(--oxblood)]" />
              <h3 className="mt-5 font-display text-3xl">
                {filtered
                  ? "A different little treasure awaits."
                  : "Lovely things are on their way."}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                {filtered
                  ? "Try another category, price range or search to find your next thoughtful piece."
                  : "Our Décora collection is waiting for its first seller creations. Come back soon for thoughtful gifts and beautiful everyday details."}
              </p>
              <a
                href={filtered ? "/decora#decora-shop" : "/artist/dashboard/add-decora"}
                className="btn-primary mt-6"
              >
                {filtered ? "Reset filters" : "List a Décora creation"}{" "}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="container-editorial py-14 md:py-20">
        <div className="relative overflow-hidden rounded-2xl bg-[var(--oxblood)] px-7 py-12 text-[var(--ivory)] md:px-14">
          <div className="pointer-events-none absolute -right-8 -top-20 h-80 w-80 rounded-full border border-white/15" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
                <WandSparkles className="h-4 w-4" /> Make it personal
              </div>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl">
                Their name. Your thought.
                <br />
                <em>A gift to keep.</em>
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-white/80">
                From customized prayer mats to keepsake gifts, choose the personal touches offered
                by each maker. Personalization is included in the listed price.
              </p>
            </div>
            <div className="md:justify-self-end">
              <a
                href="/decora?category=personalized-gifts#decora-shop"
                className="btn-ghost border border-white/40 !text-[var(--ivory)]"
              >
                Find a thoughtful gift <ArrowUpRight className="h-4 w-4" />
              </a>
              <p className="mt-4 text-xs text-white/75">Always at PKR 3,000 or less per piece.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="container-editorial flex flex-col items-start justify-between gap-6 pb-12 sm:flex-row sm:items-center">
        <div>
          <div className="eyebrow text-[var(--oxblood)]">Made by you. Loved by someone.</div>
          <h2 className="mt-3 font-display text-3xl">Your craft belongs here.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            List your décor and gifts through your ArtDera seller dashboard. Choose Décora, add your
            personal touches, and keep every piece at PKR 3,000 or less.
          </p>
        </div>
        <a href="/artist/dashboard/add-decora" className="btn-ghost shrink-0 border">
          Sell with Décora <ArrowUpRight className="h-4 w-4" />
        </a>
      </section>
    </div>
  );
}

function DecoraCard({ product }: { product: Product }) {
  const category = DECORA_CATEGORIES.find((item) => item.id === product.artwork?.decoraCategory);
  const personalized = Boolean(product.artwork?.customizationOptions?.length);
  const url = `/product/${artworkRouteSlug(product)}`;
  return (
    <article className="group min-w-0">
      <a
        href={url}
        className="relative block overflow-hidden rounded-xl bg-[#efe8dc]"
        aria-label={`View ${product.title}`}
      >
        <img
          src={artworkImageUrl(product.images[0])}
          alt={product.title}
          loading="lazy"
          width={600}
          height={750}
          className="aspect-[4/5] w-full object-contain p-3 transition duration-500 group-hover:scale-105"
        />
        {personalized && (
          <span className="absolute bottom-3 left-3 right-3 w-fit rounded-full bg-[var(--ivory)] px-3 py-1.5 text-[10px] font-semibold text-[var(--oxblood)]">
            Make it personal
          </span>
        )}
      </a>
      <p className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground">
        {product.artwork?.section === "decora"
          ? (category?.name ?? "Décora")
          : "From the art collection"}
      </p>
      <h3 className="mt-1 font-display text-xl leading-snug">
        <a href={url} className="hover:text-[var(--oxblood)]">
          {product.title}
        </a>
      </h3>
      <p className="mt-1 truncate text-xs text-muted-foreground">by {product.creatorName}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--oxblood)]">{money(product.price)}</span>
        <a
          href={url}
          className="inline-flex items-center gap-1 text-[11px] font-semibold underline-offset-4 hover:underline"
        >
          {personalized ? "Personalize" : "View piece"}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
}
