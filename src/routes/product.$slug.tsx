import { createFileRoute, Link } from "@tanstack/react-router";
import { ProBadge } from "@/components/ui/ProBadge";
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Share2,
  Sparkles,
  Tag,
  Truck,
  Video,
  ZoomIn,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getProduct, getCreator, productsByCreator, formatPKR, PRODUCTS } from "@/lib/artdera";
import { ProductCard } from "@/components/site/ProductCard";
import { ViewInSpace } from "@/components/site/ViewInSpace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/marketplace/auth";
import { useCurrency } from "@/marketplace/currency";
import { ARTWORKS, STORES } from "@/marketplace/data";
import { CartService, MessageService, WishlistService } from "@/marketplace/services";
import type { Artwork } from "@/marketplace/types";
import { hasActiveProfessionalSubscription } from "@/lib/subscription-status";

import { generateMeta, generateProductSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => {
    const p = getProduct(params.slug);
    const title = p
      ? `${p.title} by ${getCreator(p.creatorSlug)?.name ?? "Independent Artist"} | ArtDera`
      : `${decodeURIComponent(params.slug)
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())} | ArtDera`;

    if (!p) {
      const seo = generateMeta({
        title,
        description: "Explore fine artwork, paintings, and studio editions on ArtDera.",
      });
      return { meta: seo.meta, links: seo.links };
    }

    const creator = getCreator(p.creatorSlug);
    const seo = generateMeta({
      title: `${p.title} by ${creator?.name ?? "Independent Artist"}`,
      description: `${p.title} — ${p.kind} ${p.medium} (${p.dimensions}). Discover original artwork and fine-art editions on ArtDera. Tracked delivery & authenticity disclosures included.`,
      canonicalPath: `/product/${p.slug}`,
      ogImage: p.images[0],
      ogType: "product",
    });

    const productSchema = generateProductSchema({
      title: p.title,
      description: p.description,
      slug: p.slug,
      images: p.images,
      price: p.price,
      currency: p.currency,
      medium: p.medium,
      dimensions: p.dimensions,
      kind: p.kind,
      creatorName: creator?.name,
      creatorSlug: creator?.slug,
      framed: p.framed,
    });

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Discover", path: "/discover" },
      { name: p.categorySlug, path: `/discover?category=${p.categorySlug}` },
      { name: p.title, path: `/product/${p.slug}` },
    ]);

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(productSchema),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <div className="container-editorial py-24 text-center">
      <h1 className="font-display text-4xl">Work not found</h1>
      <a href="/discover" className="btn-primary mt-6">
        Back to Discover
      </a>
    </div>
  ),
});

function ProductPage() {
  const { slug } = Route.useParams();
  const product = getProduct(slug);
  const { user, catalogReady } = useAuth();
  const { formatPrice } = useCurrency();
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState(false);
  const privateArtwork = ARTWORKS.find((item) => item.slug === slug);
  const privateStore = privateArtwork
    ? STORES.find((store) => store.id === privateArtwork.storeId)
    : undefined;
  const canManagePrivateArtwork = Boolean(
    user && privateArtwork && (user.role === "admin" || privateStore?.ownerId === user.id),
  );
  if (!product && privateArtwork && canManagePrivateArtwork)
    return <ArtworkModerationNotice artwork={privateArtwork} isAdmin={user?.role === "admin"} />;
  // Don't flash "Work not found" while the server bootstrap is still loading.
  // The parent MarketplaceLayout already shows a loading screen for most cases,
  // but this guard handles direct navigation after the shell has mounted.
  if (!product && !catalogReady) return null;
  if (!product)
    return (
      <div className="container-editorial py-24 text-center">
        <h1 className="font-display text-4xl">Work not found</h1>
        <a href="/discover" className="btn-primary mt-6">
          Back to Discover
        </a>
      </div>
    );
  const creator = getCreator(product.creatorSlug)!;
  const artwork = ARTWORKS.find((item) => item.slug === product.slug);
  const storyText = artwork?.story?.text || product.story?.text;
  const more = productsByCreator(product.creatorSlug).filter((p) => p.slug !== product.slug);
  const similar = PRODUCTS.filter(
    (p) => p.slug !== product.slug && p.categorySlug === product.categorySlug,
  ).slice(0, 4);

  const requireCollector = () => {
    if (!user) {
      window.location.assign(
        `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`,
      );
      return false;
    }
    return true;
  };

  const addToCart = async (buyNow = false) => {
    if (!requireCollector() || !artwork) return;
    const result = await CartService.add(artwork.id);
    if (result.error) return toast.error(result.error.message);
    toast.success("Added to your secure cart");
    if (buyNow) window.location.assign("/checkout");
  };

  const toggleWishlist = async () => {
    if (!requireCollector() || !artwork) return;
    const result = saved
      ? await WishlistService.remove(artwork.id)
      : await WishlistService.save(artwork.id);
    if (result.error) return toast.error(result.error.message);
    setSaved(!saved);
    toast.success(saved ? "Removed from wishlist" : "Saved to wishlist");
  };

  const conversation = async (message?: string) => {
    if (!requireCollector() || !artwork) return undefined;
    const result = await MessageService.createConversation(artwork.storeId, artwork.id, message);
    if (result.error) toast.error(result.error.message);
    return result.data;
  };

  return (
    <div className="pb-20 lg:pb-0">
      <div className="container-editorial py-6 text-xs text-muted-foreground">
        <a href="/discover" className="hover:text-foreground">
          Discover
        </a>{" "}
        <span className="mx-1.5">/</span>
        <a href={`/discover?category=${product.categorySlug}`} className="hover:text-foreground">
          {product.categorySlug.replace(/-/g, " ")}
        </a>{" "}
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{product.title}</span>
      </div>

      <div className="container-editorial grid gap-10 pb-16 lg:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.82fr)] lg:gap-16">
        <section aria-label={`${product.title} image gallery`}>
          <div className="relative overflow-hidden rounded-xl bg-secondary">
            <img
              src={product.images[active]}
              alt={product.title}
              decoding="async"
              width={1200}
              height={1500}
              className="aspect-[4/5] h-full w-full object-contain md:aspect-[5/6]"
            />
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="absolute bottom-4 right-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--porcelain)] px-4 text-sm font-semibold text-[var(--ink)] shadow-sm"
                >
                  <ZoomIn className="h-4 w-4" /> Zoom
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[calc(100vh-3rem)] max-w-5xl overflow-y-auto bg-[var(--ink)] p-0 text-white">
                <DialogHeader className="sr-only">
                  <DialogTitle>{product.title} enlarged image</DialogTitle>
                </DialogHeader>
                <img
                  src={product.images[active]}
                  alt={product.title}
                  className="h-auto max-h-[calc(100vh-3rem)] w-full object-contain"
                />
              </DialogContent>
            </Dialog>
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {product.images.map((img: string, i: number) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === active ? "ring-[var(--oxblood)]" : "ring-transparent"}`}
                >
                  <img
                    src={img}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
            <TrustNote
              icon={ShieldCheck}
              title="Protected purchase"
              text="Eligible orders include ArtDera support."
            />
            <TrustNote
              icon={Truck}
              title="Tracked delivery"
              text="Packed carefully with delivery updates."
            />
            <TrustNote
              icon={BadgeCheck}
              title="Clear disclosure"
              text="Creation type and edition details shown."
            />
          </div>
        </section>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            {hasActiveProfessionalSubscription(creator) && <ProBadge size="md" />}
            <span className="chip" style={{ background: "var(--ink)", color: "var(--ivory)" }}>
              {product.kind}
              {product.editionOf ? ` / Ed. of ${product.editionOf}` : ""}
            </span>
            {creator.verified && (
              <span
                className="chip"
                style={{ background: "var(--indigo)", color: "var(--porcelain)" }}
              >
                Verified Seller
              </span>
            )}
            <span className="chip">{product.framed ? "Framed" : "Unframed"}</span>
          </div>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] md:text-5xl">{product.title}</h1>
          <Link
            to="/creator/$slug"
            params={{ slug: creator.slug }}
            className="mt-3 inline-block text-sm hover:underline"
          >
            by <span className="font-semibold">{creator.name}</span> / {creator.location}
          </Link>
          <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-2">
            <div className="font-display text-3xl">{formatPrice(product.price)}</div>
            <span className="mb-0.5 rounded-full border border-[var(--color-border)] bg-[var(--porcelain)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--oxblood)]">
              Price excludes shipping
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Truck className="h-3.5 w-3.5 shrink-0" />
            {artwork?.internationalShipping
              ? "Ships in 5–7 business days · Worldwide shipping available"
              : "Ships in 5–7 business days · Pakistan delivery only"}
          </div>

          {/* Prominent shipping disclosure: keep this above the purchase CTAs so the buyer
              understands that the displayed artwork price does not include delivery. */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] shadow-[0_12px_32px_rgba(23,23,23,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--oxblood)] px-4 py-3 text-[var(--porcelain)]">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]">
                <Truck className="h-4 w-4" />
                Important Shipping Information
              </div>
              <span className="rounded-full border border-white/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]">
                {artwork?.internationalShipping ? "Worldwide Delivery" : "Pakistan Delivery"}
              </span>
            </div>

            <div className="p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--ivory)] text-lg">
                  {artwork?.internationalShipping ? "🌍" : "📍"}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-semibold leading-snug text-[var(--ink)]">
                    Shipping Cost Calculated Separately
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                    Artwork price does{" "}
                    <strong className="font-semibold text-[var(--ink)]">
                      not include shipping
                    </strong>
                    .
                    {artwork?.internationalShipping
                      ? " Delivery charges are calculated based on your destination, artwork size, weight and packaging requirements."
                      : " Delivery charges are calculated separately according to your delivery area, artwork size, weight and packaging requirements."}
                  </p>

                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] px-3.5 py-3 text-xs font-semibold leading-relaxed text-[var(--ink)]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--oxblood)]" />
                    <span>Final shipping cost will be confirmed before payment.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={() => void addToCart()}
              className="btn-primary w-full py-3.5"
            >
              <ShoppingBag className="h-4 w-4" /> Add to Cart
            </button>
            <button
              type="button"
              onClick={() => void addToCart(true)}
              className="btn-dark w-full py-3.5"
            >
              Buy Now
            </button>
            {artwork?.internationalShipping && (
              <a
                href={`/request-quote?artwork=${product.slug}`}
                className="btn-ghost w-full py-3.5 border border-[var(--color-border)]"
              >
                Request International Shipping Quote
              </a>
            )}
            <ViewInSpace product={product} />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void toggleWishlist()}
                aria-pressed={saved}
                className="btn-ghost"
              >
                <Heart className="h-4 w-4" fill={saved ? "currentColor" : "none"} /> Wishlist
              </button>
              <button
                type="button"
                onClick={() =>
                  void conversation().then(
                    (value) =>
                      value && window.location.assign(`/messages?conversation=${value.id}`),
                  )
                }
                className="btn-ghost"
              >
                <MessageCircle className="h-4 w-4" /> Message
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    const value = window.prompt(
                      "Your offer in PKR",
                      String(Math.round(product.price * 0.9)),
                    );
                    const amount = Number(value);
                    if (!value || !Number.isFinite(amount) || amount <= 0) return;
                    const thread = await conversation();
                    if (!thread) return;
                    const result = await MessageService.createOffer(thread.id, amount);
                    result.error
                      ? toast.error(result.error.message)
                      : toast.success("Offer sent securely");
                  })()
                }
                className="btn-ghost"
              >
                <Tag className="h-4 w-4" /> Make an Offer
              </button>
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    const thread = await conversation();
                    if (!thread) return;
                    const date = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
                    const result = await MessageService.requestConsultation({
                      conversationId: thread.id,
                      requestedDate: date,
                      requestedTime: "17:00",
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    });
                    result.error
                      ? toast.error(result.error.message)
                      : toast.success("Video consultation requested");
                  })()
                }
                className="btn-ghost"
              >
                <Video className="h-4 w-4" /> Request Video
              </button>
            </div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Artwork link copied");
              }}
              className="btn-ghost w-full"
            >
              <Share2 className="h-4 w-4" /> Share Artwork
            </button>
            <a
              href={`/discover?category=custom-commissions&q=${encodeURIComponent(product.title)}`}
              className="btn-ghost w-full"
            >
              Request Customization
            </a>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--color-border)] pt-6 text-xs">
            {[
              ["Medium", product.medium],
              ["Dimensions", product.dimensions],
              ["Year", product.year.toString()],
              ["Framing", product.framed ? "Included" : "Available on request"],
              ["Availability", "Available"],
              ["Certificate", "Declared by seller"],
              ["Colours", product.colours.join(", ")],
              ["Best for", product.room.join(", ")],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="eyebrow">{k}</dt>
                <dd className="mt-1 text-foreground">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-[var(--indigo)]" /> Buyer protection
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>Seller identity and listing details are reviewed before publication.</li>
              <li>Return eligibility depends on product type, condition and delivery status.</li>
              <li>ArtDera can help resolve delivery, damage or listing-disclosure issues.</li>
            </ul>
          </div>
        </aside>
      </div>

      {storyText && (
        <section className="border-t border-[var(--color-border)] bg-[var(--ivory)] py-14 md:py-20">
          <div className="container-editorial max-w-4xl">
            <div className="text-center">
              <div className="eyebrow tracking-widest text-[var(--oxblood)]">From the Artist</div>
              <h2 className="mt-2 font-display text-3xl md:text-4xl lg:text-5xl text-[var(--ink)]">
                The Story Behind the Work
              </h2>
              <div className="mx-auto mt-4 h-0.5 w-16 bg-[var(--oxblood)]/30" />
            </div>

            <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-8 md:p-12 shadow-sm">
              <blockquote className="font-serif text-lg leading-relaxed md:text-xl md:leading-loose text-[var(--ink)] italic whitespace-pre-line">
                “{storyText}”
              </blockquote>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] pt-6">
                <div className="flex items-center gap-3">
                  {creator?.portrait && (
                    <img
                      src={creator.portrait}
                      alt={creator.name}
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-[var(--color-border)] shadow-xs"
                    />
                  )}
                  <div>
                    <div className="font-display text-lg font-semibold text-[var(--ink)]">
                      — {creator?.name ?? artwork?.creatorName}
                    </div>
                    {creator?.discipline && (
                      <div className="text-xs text-muted-foreground">
                        {creator.discipline} · {creator.location}
                      </div>
                    )}
                  </div>
                </div>
                {creator?.slug && (
                  <Link
                    to="/creator/$slug"
                    params={{ slug: creator.slug }}
                    className="btn-ghost !text-xs !py-2.5 !px-4"
                  >
                    View Artist Profile →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="border-y border-[var(--color-border)] bg-[var(--porcelain)]">
        <div className="container-editorial grid gap-12 py-16 lg:grid-cols-[0.9fr_1.4fr]">
          <div>
            <div className="eyebrow">The Work</div>
            <h2 className="mt-3 font-display text-3xl md:text-4xl">Story, method and disclosure</h2>
          </div>
          <div>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {product.description}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={Ruler}
                title="Scale"
                text={`${product.dimensions}. Measure your wall and leave breathing room around the work.`}
              />
              <InfoCard
                icon={Sparkles}
                title="Creation Method"
                text={
                  product.kind === "AI-assisted"
                    ? "This listing is disclosed as AI-assisted."
                    : `${product.kind} work declared by the seller.`
                }
              />
            </div>
          </div>
        </div>
      </section>

      <section className="container-editorial section-y">
        <div className="grid items-center gap-10 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="relative aspect-[4/5] max-w-sm overflow-hidden rounded-xl">
            <img
              src={creator.portrait}
              alt={creator.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <div className="eyebrow">Creator</div>
            <h2 className="mt-3 font-display text-4xl">{creator.name}</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              {creator.discipline} / {creator.location}
            </div>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {creator.bio}
            </p>
            <Link to="/creator/$slug" params={{ slug: creator.slug }} className="btn-ghost mt-6">
              Visit Studio Profile
            </Link>
          </div>
        </div>
      </section>

      {more.length > 0 && (
        <section className="container-editorial pb-16">
          <div className="eyebrow">More from {creator.name.split(" ")[0]}'s studio</div>
          <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-4">
            {more.slice(0, 4).map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="container-editorial pb-16">
          <div className="eyebrow">Similar in this category</div>
          <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-4">
            {similar.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--porcelain)] p-3 shadow-[0_-12px_35px_rgba(23,23,23,0.08)] lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{product.title}</div>
            <div className="text-xs text-muted-foreground">{formatPrice(product.price)}</div>
          </div>
          <button
            type="button"
            onClick={() => void addToCart()}
            className="btn-primary shrink-0 px-4"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

function ArtworkModerationNotice({ artwork, isAdmin }: { artwork: Artwork; isAdmin: boolean }) {
  const pending = artwork.status === "Pending Review";
  const draft = artwork.status === "Draft";
  const title = pending
    ? "Admin approval is needed before this artwork is public."
    : draft
      ? "This artwork is saved as a draft."
      : artwork.status === "Rejected"
        ? "This artwork needs changes before it can be approved."
        : "This artwork is not public yet.";
  const description = pending
    ? "Your artwork upload was successful and the listing is safely saved. An ArtDera admin must approve it before collectors can open or buy it."
    : draft
      ? "Submit this listing for review when its information and main image are ready."
      : "Open the artwork manager to review its current status and make any required changes.";
  return (
    <div className="container-editorial flex min-h-[70vh] items-center justify-center py-14">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--porcelain)] shadow-[var(--shadow-soft)] md:grid-cols-[0.72fr_1.28fr]">
        <div className="bg-[var(--ivory)] p-5">
          {artwork.images[0]?.url ? (
            <img
              src={artwork.images[0].url}
              alt={artwork.title}
              className="aspect-[4/5] h-full max-h-[440px] w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-white text-sm text-muted-foreground">
              Artwork image pending
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center p-7 md:p-10">
          <div className="eyebrow">Artwork moderation · {artwork.status}</div>
          <h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">{title}</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>{artwork.title}</strong>
            <p className="mt-1 text-xs">
              {pending
                ? "Approval pending — no further upload is required unless an admin requests changes."
                : `Current listing status: ${artwork.status}.`}
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={isAdmin ? "/admin/artworks" : "/artist/dashboard/artworks"}
              className="btn-primary"
            >
              {isAdmin ? "Open moderation queue" : "Back to my artworks"}
            </a>
            {!isAdmin && (
              <a href="/artist/dashboard" className="btn-ghost">
                Go to dashboard
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function TrustNote({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Icon className="h-4 w-4 text-[var(--indigo)]" /> {title}
      </div>
      <p className="mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Ruler;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white/45 p-5">
      <div className="flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-[var(--oxblood)]" /> {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
