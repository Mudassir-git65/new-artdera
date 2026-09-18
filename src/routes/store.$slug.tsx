import { createFileRoute } from "@tanstack/react-router";
import { ProBadge } from "@/components/ui/ProBadge";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Filter,
  Heart,
  MapPin,
  MessageCircle,
  PackageCheck,
  Share2,
  ShieldCheck,
  Star,
  Truck,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ARTWORKS, STORES } from "@/marketplace/data";
import {
  ArtworkService,
  FollowService,
  MessageService,
  ReviewService,
  StoreService,
  WishlistService,
} from "@/marketplace/services";
import { hasActiveProfessionalSubscription } from "@/lib/subscription-status";
import { useAuth } from "@/marketplace/auth";
import { formatPKR } from "@/marketplace/config";
import type { Artwork, Store } from "@/marketplace/types";

import { generateMeta, generateGallerySchema, generateBreadcrumbSchema, generateCreatorStoreSocialMeta } from "@/lib/seo";
import { getCreatorOrStoreResolved } from "@/lib/creator-meta";

const PRICE_MIN = 100;
const PRICE_MAX = 300000;

function priceToSlider(price: number): number {
  const logMin = Math.log(PRICE_MIN);
  const logMax = Math.log(PRICE_MAX);
  return Math.round(((Math.log(Math.max(PRICE_MIN, price)) - logMin) / (logMax - logMin)) * 100);
}

function sliderToPrice(pos: number): number {
  const logMin = Math.log(PRICE_MIN);
  const logMax = Math.log(PRICE_MAX);
  const raw = Math.exp(logMin + (pos / 100) * (logMax - logMin));
  if (raw < 1000) return Math.round(raw / 100) * 100;
  if (raw < 10000) return Math.round(raw / 500) * 500;
  if (raw < 100000) return Math.round(raw / 1000) * 1000;
  return Math.round(raw / 5000) * 5000;
}

import { fetchProductsList } from "@/lib/server-loaders";

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ params }) => {
    const [storeMeta, works] = await Promise.all([
      getCreatorOrStoreResolved(params.slug, "store"),
      fetchProductsList({ data: { creatorSlug: params.slug } }),
    ]);
    return { storeMeta, works };
  },
  head: ({ loaderData, params }) => {
    const storeMeta = loaderData?.storeMeta;
    const storeName =
      storeMeta?.name ||
      decodeURIComponent(params.slug)
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const seo = generateCreatorStoreSocialMeta({
      name: storeName,
      slug: params.slug,
      bio: storeMeta?.bio,
      profileImage: storeMeta?.profileImage,
      coverImage: storeMeta?.coverImage,
      routePrefix: "store",
    });

    const gallerySchema = generateGallerySchema({
      name: storeName,
      slug: params.slug,
      bio: storeMeta?.bio || `Discover original artwork by ${storeName} on ArtDera.`,
      location: storeMeta?.location,
      portrait: storeMeta?.profileImage,
    });

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Galleries", path: "/galleries" },
      { name: storeName, path: `/store/${params.slug}` },
    ]);

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(gallerySchema),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
      ],
    };
  },
  component: Storefront,
});

function Storefront() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { storeMeta, works: loaderWorks } = Route.useLoaderData();
  const seeded = STORES.find((item) => item.slug === slug);
  const [store, setStore] = useState<Store | undefined>(seeded || (storeMeta ? ({
    id: slug,
    ownerId: slug,
    slug,
    name: storeMeta.name,
    tagline: "",
    bio: storeMeta.bio || `Discover original artwork by ${storeMeta.name} on ArtDera.`,
    story: "",
    profileImage: storeMeta.profileImage || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80&auto=format",
    coverImage: storeMeta.coverImage || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80&auto=format",
    location: storeMeta.location || "Pakistan",
    verified: Boolean(storeMeta.verified),
    approved: true,
    status: "Active",
    categories: ["Originals"],
    mediums: ["Paintings"],
    followers: 120,
    rating: 5,
    reviewCount: 1,
    shippingInfo: "Ships within 3-5 business days.",
    returnPolicy: "Eligible for return within 7 days.",
  } as unknown as Store) : undefined));
  const [followed, setFollowed] = useState(false);
  const [category, setCategory] = useState("All");
  const [availability, setAvailability] = useState("Available");
  const [framed, setFramed] = useState(false);
  const [minPrice, setMinPrice] = useState(PRICE_MIN);
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX);
  const [minThumb, setMinThumb] = useState(() => priceToSlider(PRICE_MIN));
  const [maxThumb, setMaxThumb] = useState(() => priceToSlider(PRICE_MAX));
  const [reviews, setReviews] = useState<
    Array<{
      id: string;
      rating: number;
      title: string;
      body: string;
      sellerResponse?: string;
      createdAt: string;
    }>
  >([]);

  useEffect(() => {
    if (store) {
      document.title = `${store.name} — Gallery & Studio Storefront | ArtDera`;
    }
  }, [store]);

  useEffect(() => {
    StoreService.fetchBySlug(slug).then((result) => {
      if (result.data?.store) {
        setStore(result.data.store);
        document.title = `${result.data.store.name} — Gallery & Studio Storefront | ArtDera`;
        void ReviewService.publicForStore(result.data.store.id).then(
          (reviewResult) => reviewResult.data && setReviews(reviewResult.data),
        );
      }
    });
  }, [slug]);
  useEffect(() => {
    if (!user || !store) return;
    void FollowService.list().then((result) => {
      if (result.data) setFollowed(result.data.some((item) => item.id === store.id));
    });
  }, [store, user]);
  const artworks = useMemo(
    () =>
      store
        ? ArtworkService.forStore(store.id).length
          ? ArtworkService.forStore(store.id)
          : ARTWORKS.filter((item) => item.storeId === store.id)
        : [],
    [store],
  );
  const visible = artworks.length > 0 ? artworks.filter(
    (item) =>
      (category === "All" || item.category.toLowerCase().includes(category.toLowerCase())) &&
      (availability === "All" || availability === "Available"
        ? ["Published", "Reserved"].includes(item.status)
        : item.status === "Sold") &&
      (!framed || item.framed) &&
      item.price >= minPrice &&
      item.price <= maxPrice,
  ) : (loaderWorks as unknown as Artwork[]);

  if (!store)
    return (
      <div className="container-editorial py-24 text-center">
        <div className="eyebrow">Store not found</div>
        <h1 className="mt-3 font-display text-5xl">This studio is not on the wall.</h1>
        <a href="/creators" className="btn-primary mt-6">
          Explore Artists
        </a>
      </div>
    );
  const toggleFollow = async () => {
    if (!user)
      return window.location.assign(
        `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`,
      );
    const result = followed
      ? await FollowService.unfollow(store.id)
      : await FollowService.follow(store.id);
    if (result.error) return toast.error(result.error.message);
    setFollowed(!followed);
    toast.success(followed ? "Store unfollowed" : "Store followed");
  };
  return (
    <div className="pb-20">
      <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--ivory)]">
        <img
          src={store.coverImage}
          alt={`${store.name} cover`}
          className="absolute inset-0 h-full w-full object-cover opacity-38"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)] via-[var(--ink)]/55 to-transparent" />
        <div className="container-editorial relative flex min-h-[490px] items-end py-10">
          <div className="grid w-full items-end gap-7 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <img
                src={store.profileImage}
                alt={store.name}
                className="h-28 w-28 rounded-full border-4 border-white/20 object-cover shadow-xl"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {hasActiveProfessionalSubscription(store) && <ProBadge size="lg" />}
                  {store.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--indigo)] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm border border-white/10">
                      <BadgeCheck className="h-4 w-4" /> Verified Seller
                    </span>
                  )}
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                    {store.status}
                  </span>
                </div>
                <h1 className="mt-4 font-display text-5xl md:text-6xl">{store.name}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/60">
                  <span>
                    <MapPin className="mr-1 inline h-3.5 w-3.5" />
                    {store.location}
                  </span>
                  <span>{store.followers.toLocaleString()} followers</span>
                  <span>
                    <Star className="mr-1 inline h-3.5 w-3.5 text-amber-400" fill="currentColor" />
                    {store.rating || "New"} ({store.reviewCount} reviews)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void toggleFollow()}
                className={
                  followed
                    ? "btn-primary bg-[var(--terracotta)] !text-[var(--ink)]"
                    : "btn-ghost !border-white/20 !text-white"
                }
              >
                {followed ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                {followed ? "Following" : "Follow"}
              </button>
              <ContactDialog store={store} />
              <VideoDialog store={store} artwork={artworks[0]} />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Store link copied");
                }}
                className="btn-ghost !border-white/20 !text-white"
              >
                <Share2 className="h-4 w-4" /> Share
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="border-b border-[var(--color-border)] bg-[var(--porcelain)]">
        <div className="container-editorial grid gap-8 py-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="eyebrow">About the store</div>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
              {store.bio}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {store.story}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Artworks", artworks.length],
              ["Available", artworks.filter((item) => item.status === "Published").length],
              ["Categories", store.categories.length],
              ["Response", "< 24h"],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-[var(--ivory)] p-4">
                <div className="font-display text-3xl">{value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="container-editorial py-12">
        <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
          <aside className="h-fit rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 lg:sticky lg:top-28">
            <div className="flex items-center justify-between">
              <div className="eyebrow">Filter work</div>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-5 space-y-5">
              <StoreFilter label={`Price range`}>
                {/* Min / Max number inputs */}
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Min
                    </label>
                    <input
                      type="number"
                      min={PRICE_MIN}
                      max={maxPrice - 100}
                      value={minPrice}
                      onChange={(e) => {
                        const val = Math.min(
                          Math.max(Number(e.target.value) || PRICE_MIN, PRICE_MIN),
                          maxPrice - 100,
                        );
                        setMinPrice(val);
                        setMinThumb(priceToSlider(val));
                      }}
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
                      onChange={(e) => {
                        const val = Math.max(
                          Math.min(Number(e.target.value) || PRICE_MAX, PRICE_MAX),
                          minPrice + 100,
                        );
                        setMaxPrice(val);
                        setMaxThumb(priceToSlider(val));
                      }}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-white/60 px-2 py-1.5 text-xs outline-none focus:border-[var(--oxblood)]"
                      placeholder="Max PKR"
                    />
                  </div>
                </div>
                {/* Dual log-scale slider */}
                <div className="relative h-5 w-full">
                  <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-[var(--color-border)]" />
                  <div
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--oxblood)]"
                    style={{ left: `${minThumb}%`, right: `${100 - maxThumb}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={minThumb}
                    onChange={(e) => {
                      const pos = Math.min(Number(e.target.value), maxThumb - 1);
                      setMinThumb(pos);
                      setMinPrice(sliderToPrice(pos));
                    }}
                    className="pointer-events-none absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--oxblood)] [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--oxblood)] [&::-moz-range-thumb]:shadow-md"
                    aria-label="Minimum price"
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={maxThumb}
                    onChange={(e) => {
                      const pos = Math.max(Number(e.target.value), minThumb + 1);
                      setMaxThumb(pos);
                      setMaxPrice(sliderToPrice(pos));
                    }}
                    className="pointer-events-none absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--oxblood)] [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--oxblood)] [&::-moz-range-thumb]:shadow-md"
                    aria-label="Maximum price"
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{formatPKR(minPrice)}</span>
                  <span>{formatPKR(maxPrice)}</span>
                </div>
              </StoreFilter>
              <StoreFilter label="Category">
                <select
                  className="art-field"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option>All</option>
                  {store.categories.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </StoreFilter>
              <StoreFilter label="Availability">
                <select
                  className="art-field"
                  value={availability}
                  onChange={(event) => setAvailability(event.target.value)}
                >
                  <option>All</option>
                  <option>Available</option>
                  <option>Sold</option>
                </select>
              </StoreFilter>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={framed}
                  onChange={(event) => setFramed(event.target.checked)}
                  className="accent-[var(--oxblood)]"
                />{" "}
                Framed only
              </label>
              <button
                onClick={() => {
                  setCategory("All");
                  setAvailability("Available");
                  setFramed(false);
                  setMinPrice(PRICE_MIN);
                  setMaxPrice(PRICE_MAX);
                  setMinThumb(priceToSlider(PRICE_MIN));
                  setMaxThumb(priceToSlider(PRICE_MAX));
                }}
                className="text-xs font-semibold underline"
              >
                Clear filters
              </button>
            </div>
          </aside>
          <main>
            <div className="flex items-end justify-between">
              <div>
                <div className="eyebrow">Available work</div>
                <h2 className="mt-2 font-display text-4xl">From the studio</h2>
              </div>
              <span className="text-xs text-muted-foreground">{visible.length} works</span>
            </div>
            {visible.length ? (
              <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-10 xl:grid-cols-3">
                {visible.map((artwork, index) => (
                  <StoreArtwork
                    key={artwork.id}
                    artwork={artwork}
                    sponsored={artwork.sponsored && index % 5 === 0}
                    canSave={Boolean(user)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-12 text-center">
                <PaletteIcon />
                <h3 className="mt-5 font-display text-3xl">No works match these filters.</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try a wider price or availability choice.
                </p>
                <button
                  onClick={() => {
                    setCategory("All");
                    setAvailability("All");
                    setFramed(false);
                    setMinPrice(PRICE_MIN);
                    setMaxPrice(PRICE_MAX);
                    setMinThumb(priceToSlider(PRICE_MIN));
                    setMaxThumb(priceToSlider(PRICE_MAX));
                  }}
                  className="btn-primary mt-5"
                >
                  Clear filters
                </button>
              </div>
            )}
          </main>
        </div>
      </section>
      <section className="border-y border-[var(--color-border)] bg-[var(--porcelain)]">
        <div className="container-editorial grid gap-5 py-12 md:grid-cols-3">
          {[
            [
              Truck,
              "Shipping information",
              "Domestic shipping estimates are shown per artwork. International availability depends on the listing and eligible plan.",
            ],
            [
              PackageCheck,
              "Returns",
              "Return eligibility depends on the artwork type, condition, delivery status and final reviewed policy.",
            ],
            [
              ShieldCheck,
              "Protected communication",
              "Email, phone and WhatsApp remain private until a confirmed order needs delivery coordination.",
            ],
          ].map(([Icon, title, body]) => {
            const ItemIcon = Icon as typeof Truck;
            return (
              <div key={title as string} className="rounded-2xl bg-[var(--ivory)] p-5">
                <ItemIcon className="h-5 w-5 text-[var(--indigo)]" />
                <h3 className="mt-4 font-display text-2xl">{title as string}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body as string}
                </p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="container-editorial py-12">
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow">Collector reviews</div>
            <h2 className="mt-2 font-display text-4xl">Carefully delivered.</h2>
          </div>
          <span className="chip">{store.reviewCount} reviews</span>
        </div>
        {reviews.length ? (
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {reviews.slice(0, 6).map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5"
              >
                <div className="flex text-amber-500">
                  {Array.from({ length: review.rating }, (_, star) => (
                    <Star key={star} className="h-3.5 w-3.5" fill="currentColor" />
                  ))}
                </div>
                {review.title && <h3 className="mt-4 font-semibold">{review.title}</h3>}
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.body}</p>
                <div className="mt-5 text-xs font-semibold">Verified completed-order buyer</div>
                {review.sellerResponse && (
                  <div className="mt-4 rounded-xl bg-[var(--ivory)] p-3 text-xs">
                    <strong>Seller response</strong>
                    <p className="mt-1 text-muted-foreground">{review.sellerResponse}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-7 rounded-2xl bg-[var(--porcelain)] p-6 text-sm text-muted-foreground">
            No written reviews have been published for this store yet.
          </p>
        )}
      </section>
    </div>
  );
}

function StoreArtwork({
  artwork,
  sponsored,
  canSave,
}: {
  artwork: Artwork;
  sponsored: boolean;
  canSave: boolean;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <article className="group">
      <a
        href={`/product/${artwork.slug}`}
        className="relative block overflow-hidden rounded-xl bg-[var(--porcelain)]"
      >
        <img
          src={artwork.images[0].url}
          alt={artwork.images[0].alt}
          className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.025]"
        />
        {sponsored && (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--porcelain)] px-2.5 py-1 text-[10px] font-bold shadow-sm">
            Sponsored
          </span>
        )}
        {artwork.status === "Sold" && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-sm font-bold uppercase tracking-[0.18em] text-white">
            Sold
          </span>
        )}
      </a>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <a href={`/product/${artwork.slug}`} className="font-display text-xl hover:underline">
            {artwork.title}
          </a>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {artwork.medium} · {artwork.dimensions}
          </div>
          <div className="mt-2 text-sm font-semibold">{formatPKR(artwork.price)}</div>
        </div>
        <button
          onClick={() =>
            void (async () => {
              if (!canSave)
                return window.location.assign(
                  `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`,
                );
              const result = saved
                ? await WishlistService.remove(artwork.id)
                : await WishlistService.save(artwork.id);
              if (result.error) return toast.error(result.error.message);
              setSaved(!saved);
              toast.success(saved ? "Removed from wishlist" : "Saved to wishlist");
            })()
          }
          className="flex h-10 w-10 items-center justify-center rounded-full border"
          aria-label={`Save ${artwork.title}`}
        >
          <Heart className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}
function ContactDialog({ store }: { store: Store }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [type, setType] = useState("Ask a Question");
  const [sending, setSending] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="btn-primary bg-[var(--terracotta)] !text-[var(--ink)]">
          <MessageCircle className="h-4 w-4" /> Message
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[var(--porcelain)]">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Contact {store.name}</DialogTitle>
          <DialogDescription>
            Use protected ArtDera messages before purchase. Private contact details remain hidden.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-4">
          <label>
            <span className="eyebrow mb-2 block">Request type</span>
            <select
              className="art-field"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {[
                "Ask a Question",
                "Make an Offer",
                "Request More Images",
                "Request Artwork Video",
                "Request Video Consultation",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="eyebrow mb-2 block">Message</span>
            <textarea
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="art-field !rounded-xl"
              placeholder="Tell the artist what you would like to know."
            />
          </label>
          <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Do not include phone, email, WhatsApp or external payment links.
          </div>
          <button
            disabled={sending}
            onClick={() =>
              void (async () => {
                if (!user)
                  return window.location.assign(
                    `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`,
                  );
                if (!message.trim()) return toast.error("Write a message first.");
                setSending(true);
                const result = await MessageService.createConversation(
                  store.id,
                  undefined,
                  `${type}: ${message}`,
                );
                setSending(false);
                if (result.error) return toast.error(result.error.message);
                toast.success(`${type} sent securely`);
                setMessage("");
              })()
            }
            className="btn-primary disabled:opacity-45"
          >
            {sending ? "Sending…" : "Send securely"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function VideoDialog({ store, artwork }: { store: Store; artwork?: Artwork }) {
  const { user } = useAuth();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="btn-ghost !border-white/20 !text-white">
          <Video className="h-4 w-4" /> Request Video Call
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[var(--porcelain)]">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Request a video consultation</DialogTitle>
          <DialogDescription>
            Select a preferred time. The artist can accept, suggest another time or decline.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="eyebrow mb-2 block">Preferred date</span>
            <input
              type="date"
              className="art-field"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label>
            <span className="eyebrow mb-2 block">Preferred time</span>
            <input
              type="time"
              className="art-field"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="eyebrow mb-2 block">Message</span>
            <textarea
              rows={4}
              className="art-field !rounded-xl"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
        </div>
        <button
          disabled={sending || !artwork}
          onClick={() =>
            void (async () => {
              if (!user)
                return window.location.assign(
                  `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`,
                );
              if (!artwork)
                return toast.error("This store has no available artwork for a consultation.");
              if (!date || !time) return toast.error("Choose a preferred date and time.");
              setSending(true);
              const conversation = await MessageService.createConversation(store.id, artwork.id);
              if (conversation.error) {
                setSending(false);
                return toast.error(conversation.error.message);
              }
              const result = await MessageService.requestConsultation({
                conversationId: conversation.data!.id,
                requestedDate: new Date(`${date}T${time}:00`).toISOString(),
                requestedTime: time,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                message,
              });
              setSending(false);
              result.error
                ? toast.error(result.error.message)
                : toast.success("Video consultation requested");
            })()
          }
          className="btn-primary mt-5 disabled:opacity-45"
        >
          {sending ? "Sending request…" : "Request consultation"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
function StoreFilter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
    </label>
  );
}
function PaletteIcon() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ivory)]">
      <Filter className="h-6 w-6 text-[var(--oxblood)]" />
    </div>
  );
}
