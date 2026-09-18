import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { CATEGORIES, CREATORS, PRODUCTS, formatPKR } from "@/lib/artdera";
import { useCurrency } from "@/marketplace/currency";
import { ProductCard } from "@/components/site/ProductCard";
import { ProductCardSkeleton } from "@/components/site/ProductCardSkeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { z } from "zod";
import { generateMeta, generateBreadcrumbSchema } from "@/lib/seo";
import { MarketplaceService } from "@/marketplace/services";

const searchSchema = z.object({
  category: z.string().optional(),
  room: z.string().optional(),
  q: z.string().optional(),
  kind: z.string().optional(),
  color: z.string().optional(),
  framed: z.string().optional(),
  min: z.coerce.number().optional().catch(undefined),
  max: z.coerce.number().optional().catch(undefined),
  sort: z.string().optional(),
});

const PRICE_MIN = 100;
const PRICE_MAX = 10000000;

// Convert a real price to a 0-100 slider position using log scale
function priceToSlider(price: number): number {
  const logMin = Math.log(PRICE_MIN);
  const logMax = Math.log(PRICE_MAX);
  return Math.round(((Math.log(Math.max(PRICE_MIN, price)) - logMin) / (logMax - logMin)) * 100);
}

// Convert a 0-100 slider position back to a real price using log scale
function sliderToPrice(pos: number): number {
  const logMin = Math.log(PRICE_MIN);
  const logMax = Math.log(PRICE_MAX);
  const raw = Math.exp(logMin + (pos / 100) * (logMax - logMin));
  // Snap to a round number for cleaner display
  if (raw < 1000) return Math.round(raw / 100) * 100;
  if (raw < 10000) return Math.round(raw / 500) * 500;
  if (raw < 100000) return Math.round(raw / 1000) * 1000;
  return Math.round(raw / 5000) * 5000;
}

export const Route = createFileRoute("/discover")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => {
    const seo = generateMeta({
      title: "Discover Original Art, Calligraphy & Decor | ArtDera",
      description:
        "Browse original paintings, calligraphy, photography, prints, and wall decor from verified independent artists and galleries on ArtDera.",
      canonicalPath: "/discover",
    });

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Discover", path: "/discover" },
    ]);

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
      ],
    };
  },
  component: Discover,
});

const KINDS = ["Original", "Limited Edition", "Open Edition", "Handmade", "AI-assisted"] as const;
const SORTS = ["Recommended", "Newest", "Price: low to high", "Price: high to low"] as const;
const COLOURS = ["oxblood", "terracotta", "indigo", "ivory", "ink", "stone", "gold"] as const;

function Discover() {
  const { formatPrice } = useCurrency();
  const search = useSearch({ from: "/discover" });
  const initialSort = SORTS.includes(search.sort as (typeof SORTS)[number])
    ? (search.sort as (typeof SORTS)[number])
    : "Recommended";
  const [category, setCategory] = useState<string | undefined>(search.category);
  const [room, setRoom] = useState<string | undefined>(search.room);
  const [query, setQuery] = useState(search.q ?? "");
  const [kinds, setKinds] = useState<string[]>(search.kind ? search.kind.split(",") : []);
  const [selectedColour, setSelectedColour] = useState<string | undefined>(search.color);
  const [framedOnly, setFramedOnly] = useState(search.framed === "true");
  const [minPrice, setMinPrice] = useState<number>(search.min ?? PRICE_MIN);
  const [maxPrice, setMaxPrice] = useState<number>(search.max ?? PRICE_MAX);
  const [sort, setSort] = useState<(typeof SORTS)[number]>(initialSort);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [shuffledProducts, setShuffledProducts] = useState<typeof PRODUCTS>(() => [...PRODUCTS]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(() => PRODUCTS.length === 0);

  const ARTWORKS_PER_PAGE = 24;

  const [visibleLimit, setVisibleLimit] = useState(24);

  useEffect(() => {
    setShuffledProducts((prev) => {
      const existingIds = new Set(prev.map((p) => p.slug));
      const newItems = PRODUCTS.filter((p) => !existingIds.has(p.slug));
      if (newItems.length === 0) return prev;
      const shuffledNew = [...newItems];
      for (let i = shuffledNew.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledNew[i], shuffledNew[j]] = [shuffledNew[j], shuffledNew[i]];
      }
      return [...prev, ...shuffledNew];
    });
  }, [catalogVersion]);

  // Load the FIRST page on mount — no while-loop, no bulk download
  useEffect(() => {
    let active = true;
    async function loadFirstPage() {
      const result = await MarketplaceService.loadArtworkPage(1, ARTWORKS_PER_PAGE);
      if (!active) return;
      if (result.data) {
        setHasMore(result.data.page < result.data.pages);
        setCurrentPage(result.data.page);
      }
      setInitialLoading(false);
    }
    void loadFirstPage();
    return () => { active = false; };
  }, []);

  const loadNextPage = () => {
    setVisibleLimit((limit) => limit + 24);
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      void MarketplaceService.loadArtworkPage(nextPage, ARTWORKS_PER_PAGE).then((result) => {
        if (result.data) {
          setHasMore(result.data.page < result.data.pages);
          setCurrentPage(result.data.page);
          setCatalogVersion((v) => v + 1);
        }
        setIsLoadingMore(false);
      });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (room) params.set("room", room);
    if (query.trim()) params.set("q", query.trim());
    if (kinds.length) params.set("kind", kinds.join(","));
    if (selectedColour) params.set("color", selectedColour);
    if (framedOnly) params.set("framed", "true");
    if (minPrice > PRICE_MIN) params.set("min", String(minPrice));
    if (maxPrice < PRICE_MAX) params.set("max", String(maxPrice));
    if (sort !== "Recommended") params.set("sort", sort);
    const next = params.toString() ? `/discover?${params}` : "/discover";
    if (`${window.location.pathname}${window.location.search}` === next) return;
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(
      () => window.history.pushState({ artderaFilters: true }, "", next),
      300,
    );
    return () => {
      if (urlTimer.current) clearTimeout(urlTimer.current);
    };
  }, [category, framedOnly, kinds, minPrice, maxPrice, query, room, selectedColour, sort]);

  useEffect(() => {
    const restoreFromUrl = () => {
      const parsed = searchSchema.safeParse(
        Object.fromEntries(new URLSearchParams(window.location.search)),
      );
      if (!parsed.success) return;
      const next = parsed.data;
      setCategory(next.category);
      setRoom(next.room);
      setQuery(next.q ?? "");
      setKinds(next.kind ? next.kind.split(",") : []);
      setSelectedColour(next.color);
      setFramedOnly(next.framed === "true");
      setMinPrice(next.min ?? PRICE_MIN);
      setMaxPrice(next.max ?? PRICE_MAX);
      setSort(
        SORTS.includes(next.sort as (typeof SORTS)[number])
          ? (next.sort as (typeof SORTS)[number])
          : "Recommended",
      );
    };
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, []);

  const filtered = useMemo(() => {
    let list = catalogVersion >= 0 ? shuffledProducts.slice() : [];
    const q = query.trim().toLowerCase();
    if (category) {
      const catLower = category.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const catSingular = catLower.replace(/s$/, "");
      list = list.filter((p) => {
        const slugLower = p.categorySlug.toLowerCase().replace(/[^a-z0-9]+/g, "");
        const slugSingular = slugLower.replace(/s$/, "");
        const mediumLower = p.medium.toLowerCase();
        const titleLower = p.title.toLowerCase();
        return (
          slugLower === catLower ||
          slugSingular === catSingular ||
          slugLower.includes(catSingular) ||
          catSingular.includes(slugSingular) ||
          mediumLower.includes(catSingular) ||
          titleLower.includes(catSingular) ||
          (catSingular.includes("paint") && (slugLower.includes("original") || mediumLower.includes("oil") || mediumLower.includes("acrylic") || mediumLower.includes("canvas"))) ||
          (catSingular.includes("original") && (slugLower.includes("original") || p.kind === "Original")) ||
          (catSingular.includes("photo") && slugLower.includes("photo")) ||
          (catSingular.includes("calligraph") && slugLower.includes("calligraph")) ||
          (catSingular.includes("print") && (slugLower.includes("print") || p.kind.includes("Edition")))
        );
      });
    }
    if (kinds.length) list = list.filter((p) => kinds.includes(p.kind));
    if (room)
      list = list.filter((p) => p.room.some((r) => r.toLowerCase().replace(/ /g, "-") === room));
    if (selectedColour) list = list.filter((p) => p.colours.includes(selectedColour));
    if (framedOnly) list = list.filter((p) => p.framed);
    if (q) {
      list = list.filter((p) => {
        const creator = CREATORS.find((c) => c.slug === p.creatorSlug);
        const categoryName = CATEGORIES.find((c) => c.slug === p.categorySlug)?.name;
        return [
          p.title,
          p.description,
          p.medium,
          p.kind,
          p.colours.join(" "),
          creator?.name,
          creator?.location,
          categoryName,
          p.style,
          p.subject,
          (p.tags ?? []).join(" "),
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      });
    }
    list = list.filter((p) => p.price >= minPrice && p.price <= maxPrice);
    if (sort === "Newest") list.sort((a, b) => (b.new ? 1 : 0) - (a.new ? 1 : 0));
    if (sort === "Price: low to high") list.sort((a, b) => a.price - b.price);
    if (sort === "Price: high to low") list.sort((a, b) => b.price - a.price);
    return list;
  }, [catalogVersion, shuffledProducts, category, kinds, room, selectedColour, framedOnly, query, minPrice, maxPrice, sort]);

  const visibleProducts = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);

  const activeCategory = category ? CATEGORIES.find((c) => c.slug === category) : undefined;
  const applied: Array<readonly [string, string, () => void]> = [];
  if (category)
    applied.push(["Category", activeCategory?.name ?? category, () => setCategory(undefined)]);
  if (query.trim()) applied.push(["Search", query.trim(), () => setQuery("")]);
  if (room) applied.push(["Room", room.replaceAll("-", " "), () => setRoom(undefined)]);
  kinds.forEach((kind) =>
    applied.push([
      "Type",
      kind,
      () => setKinds((values) => values.filter((value) => value !== kind)),
    ]),
  );
  if (selectedColour) applied.push(["Colour", selectedColour, () => setSelectedColour(undefined)]);
  if (framedOnly) applied.push(["Framing", "Framed", () => setFramedOnly(false)]);
  if (minPrice > PRICE_MIN || maxPrice < PRICE_MAX)
    applied.push([
      "Price",
      `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`,
      () => {
        setMinPrice(PRICE_MIN);
        setMaxPrice(PRICE_MAX);
      },
    ]);

  const filterPanel = (
    <FilterPanel
      category={category}
      setCategory={setCategory}
      kinds={kinds}
      setKinds={setKinds}
      selectedColour={selectedColour}
      setSelectedColour={setSelectedColour}
      framedOnly={framedOnly}
      setFramedOnly={setFramedOnly}
      minPrice={minPrice}
      setMinPrice={setMinPrice}
      maxPrice={maxPrice}
      setMaxPrice={setMaxPrice}
      reset={() => {
        setKinds([]);
        setMinPrice(PRICE_MIN);
        setMaxPrice(PRICE_MAX);
        setCategory(undefined);
        setSelectedColour(undefined);
        setFramedOnly(false);
        setQuery("");
        setRoom(undefined);
      }}
      formatPrice={formatPrice}
    />
  );

  return (
    <div className="container-editorial py-10 lg:py-14">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <div className="eyebrow">Discover</div>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">
            {activeCategory ? activeCategory.name : "The full marketplace"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "work" : "works"} from verified creators,
            studios and galleries.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" className="btn-ghost lg:hidden">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[86vh] overflow-y-auto rounded-t-2xl bg-[var(--porcelain)]"
            >
              <SheetHeader className="text-left">
                <SheetTitle>Filter ArtDera</SheetTitle>
                <SheetDescription>
                  Refine by category, creation type, colour, framing and price.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">{filterPanel}</div>
            </SheetContent>
          </Sheet>
          <label className="sr-only" htmlFor="sort">
            Sort results
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])}
            className="min-w-0 flex-1 rounded-full border bg-transparent px-3 py-2 text-sm lg:flex-none lg:px-4"
            style={{ borderColor: "var(--color-border-strong)" }}
          >
            {SORTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <form
        className="mt-8 flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-3 sm:flex-row"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="discover-search" className="sr-only">
          Search marketplace
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="discover-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Describe what belongs on your wall..."
            className="min-h-12 w-full rounded-full border border-transparent bg-white/55 pl-11 pr-4 text-sm outline-none focus:border-[var(--oxblood)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setQuery("")}
          className="btn-ghost text-xs px-3 py-1.5 sm:w-auto"
        >
          Clear Search
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setCategory(undefined)}
          className="chip"
          style={!category ? { background: "var(--ink)", color: "var(--ivory)" } : {}}
        >
          All
        </button>
        {CATEGORIES.filter((c) => PRODUCTS.some((p) => p.categorySlug === c.slug)).map((c) => (
          <button
            key={c.slug}
            onClick={() => setCategory(c.slug === category ? undefined : c.slug)}
            className="chip"
            style={category === c.slug ? { background: "var(--ink)", color: "var(--ivory)" } : {}}
          >
            {c.name}
          </button>
        ))}
      </div>

      {applied.length > 0 && (
        <div className="mt-5 hidden lg:flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Applied:</span>
          {applied.map(([label, value, clear]) => (
            <button
              key={`${label}-${value}`}
              type="button"
              onClick={clear}
              className="chip bg-[var(--porcelain)]"
            >
              {label}: {value} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="sticky top-32 hidden self-start lg:block">{filterPanel}</aside>

        <div>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-8 text-center max-w-lg mx-auto">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ivory)]">
                <Filter className="h-4 w-4 text-[var(--oxblood)]" />
              </div>
              <div className="mt-4 font-display text-2xl">No works match those filters.</div>
              <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Your walls may need a wider search. Try removing a category, colour or price limit.
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setKinds([]);
                    setMinPrice(PRICE_MIN);
                    setMaxPrice(PRICE_MAX);
                    setCategory(undefined);
                    setSelectedColour(undefined);
                    setFramedOnly(false);
                    setQuery("");
                    setRoom(undefined);
                  }}
                  className="btn-primary"
                >
                  Reset Filters
                </button>
                <Link
                  to="/discover"
                  onClick={() => {
                    setKinds([]);
                    setMinPrice(PRICE_MIN);
                    setMaxPrice(PRICE_MAX);
                    setCategory(undefined);
                    setSelectedColour(undefined);
                    setFramedOnly(false);
                    setQuery("");
                    setRoom(undefined);
                  }}
                  className="btn-ghost"
                >
                  View All Art
                </Link>
              </div>
            </div>
          ) : initialLoading ? (
            // Skeleton grid shown on first load — prevents blank screen
            <div className="grid grid-cols-1 gap-x-5 gap-y-12 min-[480px]:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-5 gap-y-12 min-[480px]:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((p, index) => {
                  const sponsored = visibleProducts.length >= 5 && index === 4;
                  return (
                    <div key={p.slug} className="relative">
                      {sponsored && (
                        <span className="absolute left-3 top-3 z-10 rounded-full bg-[var(--porcelain)] px-2.5 py-1 text-[10px] font-bold shadow-sm">
                          Sponsored
                        </span>
                      )}
                      <ProductCard product={p} />
                    </div>
                  );
                })}
              </div>
              {/* Load More pagination button */}
              {(hasMore || visibleLimit < filtered.length) && (
                <div className="mt-12 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadNextPage()}
                    disabled={isLoadingMore}
                    className="btn-ghost min-w-[180px] disabled:cursor-wait disabled:opacity-60"
                  >
                    {isLoadingMore ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Loading more…
                      </span>
                    ) : (
                      "Load more artworks"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterPanel({
  category,
  setCategory,
  kinds,
  setKinds,
  selectedColour,
  setSelectedColour,
  framedOnly,
  setFramedOnly,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  reset,
  formatPrice,
}: {
  category: string | undefined;
  setCategory: (category: string | undefined) => void;
  kinds: string[];
  setKinds: Dispatch<SetStateAction<string[]>>;
  selectedColour: string | undefined;
  setSelectedColour: (colour: string | undefined) => void;
  framedOnly: boolean;
  setFramedOnly: (framed: boolean) => void;
  minPrice: number;
  setMinPrice: (price: number) => void;
  maxPrice: number;
  setMaxPrice: (price: number) => void;
  reset: () => void;
  formatPrice: (price: number) => string;
}) {
  // Local slider thumb positions (0-100) mapped via log scale
  const [minThumb, setMinThumb] = useState(() => priceToSlider(minPrice));
  const [maxThumb, setMaxThumb] = useState(() => priceToSlider(maxPrice));

  // Sync thumbs when external prices change (e.g. reset)
  useEffect(() => {
    setMinThumb(priceToSlider(minPrice));
  }, [minPrice]);
  useEffect(() => {
    setMaxThumb(priceToSlider(maxPrice));
  }, [maxPrice]);

  const handleMinThumb = (pos: number) => {
    const clamped = Math.min(pos, maxThumb - 1);
    setMinThumb(clamped);
    setMinPrice(sliderToPrice(clamped));
  };

  const handleMaxThumb = (pos: number) => {
    const clamped = Math.max(pos, minThumb + 1);
    setMaxThumb(clamped);
    setMaxPrice(sliderToPrice(clamped));
  };

  const handleMinInput = (raw: string) => {
    const val = Number(raw.replace(/[^0-9]/g, ""));
    if (isNaN(val)) return;
    const clamped = Math.min(Math.max(val, PRICE_MIN), maxPrice - 100);
    setMinPrice(clamped);
    setMinThumb(priceToSlider(clamped));
  };

  const handleMaxInput = (raw: string) => {
    const val = Number(raw.replace(/[^0-9]/g, ""));
    if (isNaN(val)) return;
    const clamped = Math.max(Math.min(val, PRICE_MAX), minPrice + 100);
    setMaxPrice(clamped);
    setMaxThumb(priceToSlider(clamped));
  };
  return (
    <div className="space-y-6 text-sm">
      <FilterGroup title="Price range">
        {/* Min / Max number inputs */}
        <div className="mb-2 flex items-center gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Min
            </label>
            <input
              type="number"
              min={PRICE_MIN}
              max={maxPrice - 100}
              value={minPrice}
              onChange={(e) => handleMinInput(e.target.value)}
              onBlur={(e) => handleMinInput(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white/60 px-2 py-1.5 text-xs outline-none focus:border-[var(--oxblood)]"
              placeholder="Min PKR"
            />
          </div>
          <span className="mt-4 text-xs text-muted-foreground">–</span>
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Max
            </label>
            <input
              type="number"
              min={minPrice + 100}
              max={PRICE_MAX}
              value={maxPrice}
              onChange={(e) => handleMaxInput(e.target.value)}
              onBlur={(e) => handleMaxInput(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white/60 px-2 py-1.5 text-xs outline-none focus:border-[var(--oxblood)]"
              placeholder="Max PKR"
            />
          </div>
        </div>

        {/* Dual log-scale slider track */}
        <div className="relative h-5 w-full">
          {/* Base track */}
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-[var(--color-border)]" />
          {/* Filled track between thumbs */}
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--oxblood)]"
            style={{ left: `${minThumb}%`, right: `${100 - maxThumb}%` }}
          />
          {/* Min thumb */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={minThumb}
            onChange={(e) => handleMinThumb(Number(e.target.value))}
            className="pointer-events-none absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--oxblood)] [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--oxblood)] [&::-moz-range-thumb]:shadow-md"
            aria-label="Minimum price slider"
          />
          {/* Max thumb */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={maxThumb}
            onChange={(e) => handleMaxThumb(Number(e.target.value))}
            className="pointer-events-none absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--oxblood)] [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--oxblood)] [&::-moz-range-thumb]:shadow-md"
            aria-label="Maximum price slider"
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{formatPrice(minPrice)}</span>
          <span>{formatPrice(maxPrice)}</span>
        </div>
      </FilterGroup>
      <FilterGroup title="Category">
        <div className="grid gap-1">
          {CATEGORIES.filter((c) => PRODUCTS.some((p) => p.categorySlug === c.slug)).map((item) => (
            <button
              type="button"
              key={item.slug}
              onClick={() => setCategory(category === item.slug ? undefined : item.slug)}
              className={`rounded-lg px-3 py-2 text-left transition ${category === item.slug ? "bg-[var(--ink)] text-[var(--ivory)]" : "hover:bg-[var(--porcelain)]"}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Creation type">
        {KINDS.map((k) => (
          <label key={k} className="flex min-h-9 cursor-pointer items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={kinds.includes(k)}
              onChange={() =>
                setKinds((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))
              }
              className="accent-[var(--oxblood)]"
            />
            {k}
          </label>
        ))}
      </FilterGroup>
      <FilterGroup title="Colour">
        <div className="flex flex-wrap gap-2">
          {COLOURS.map((colour) => (
            <button
              key={colour}
              type="button"
              onClick={() => setSelectedColour(selectedColour === colour ? undefined : colour)}
              className={`chip capitalize ${selectedColour === colour ? "ring-2 ring-[var(--oxblood)]" : ""}`}
            >
              {colour}
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Framing">
        <label className="flex min-h-10 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={framedOnly}
            onChange={(event) => setFramedOnly(event.target.checked)}
            className="accent-[var(--oxblood)]"
          />
          Framed or ready to hang
        </label>
      </FilterGroup>
      <button
        type="button"
        onClick={reset}
        className="text-xs font-semibold text-muted-foreground underline hover:text-foreground"
      >
        Clear all filters
      </button>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-3">{title}</div>
      <div>{children}</div>
    </div>
  );
}
