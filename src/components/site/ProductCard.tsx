import { Link } from "@tanstack/react-router";
import { Eye, Heart, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Product } from "@/lib/artdera";
import { CREATORS } from "@/lib/artdera";
import { ARTWORKS } from "@/marketplace/data";
import { useAuth } from "@/marketplace/auth";
import { CartService, WishlistService } from "@/marketplace/services";
import { useCurrency } from "@/marketplace/currency";
import { ProBadge } from "@/components/ui/ProBadge";
import { hasActiveProfessionalSubscription } from "@/lib/subscription-status";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ProductCard({ product }: { product: Product }) {
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const creator = CREATORS.find((c) => c.slug === product.creatorSlug);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<"wishlist" | "cart" | null>(null);
  const artwork = ARTWORKS.find((item) => item.slug === product.slug);
  const primaryImage = product.images[0];
  const secondaryImage = product.images[1] ?? primaryImage;
  const hasStory = Boolean(
    product.story?.text || ARTWORKS.find((a) => a.slug === product.slug)?.story?.text,
  );
  const isProfessional = hasActiveProfessionalSubscription(creator);

  const requireAccount = () => {
    if (user) return true;
    window.location.assign(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    return false;
  };

  const toggleWishlist = async (): Promise<void> => {
    if (!requireAccount() || !artwork || busy) return;
    setBusy("wishlist");
    const result = saved
      ? await WishlistService.remove(artwork.id)
      : await WishlistService.save(artwork.id);
    setBusy(null);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    setSaved((value) => !value);
    toast.success(saved ? "Removed from wishlist" : "Saved to wishlist");
  };

  const addToCart = async (): Promise<void> => {
    if (!requireAccount() || !artwork || busy) return;
    setBusy("cart");
    const result = await CartService.add(artwork.id);
    setBusy(null);
    if (result.error) toast.error(result.error.message);
    else toast.success("Added to your secure cart");
  };

  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[#ebe7df]">
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          aria-label={`View ${product.title}`}
        >
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product.title}
              loading="lazy"
              decoding="async"
              width={800}
              height={1000}
              className="h-full w-full object-contain transition-transform duration-700 md:group-hover:scale-[1.02]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Artwork image unavailable
            </span>
          )}
          {secondaryImage && secondaryImage !== primaryImage && (
            <img
              src={secondaryImage}
              alt=""
              loading="lazy"
              decoding="async"
              width={800}
              height={1000}
              className="absolute inset-0 hidden h-full w-full object-contain opacity-0 transition duration-700 md:block md:group-hover:opacity-100"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </Link>

        <div className="absolute left-3 top-3 hidden flex-col gap-1.5 md:flex">
          {hasStory && (
            <span
              className="chip font-medium shadow-xs"
              style={{ background: "var(--oxblood)", color: "var(--ivory)" }}
            >
              ✦ Story Inside
            </span>
          )}
          {product.kind === "Original" && (
            <span className="chip" style={{ background: "var(--ink)", color: "var(--ivory)" }}>
              Original
            </span>
          )}
          {product.kind === "Limited Edition" && (
            <span className="chip" style={{ background: "var(--porcelain)", color: "var(--ink)" }}>
              Ed. {product.editionOf}
            </span>
          )}
          {product.kind === "AI-assisted" && (
            <span
              className="chip"
              style={{ background: "var(--indigo)", color: "var(--porcelain)" }}
            >
              AI-assisted
            </span>
          )}
          {product.new && (
            <span className="chip" style={{ background: "var(--terracotta)", color: "var(--ink)" }}>
              New
            </span>
          )}
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void toggleWishlist()}
            disabled={busy === "wishlist"}
            aria-pressed={saved}
            aria-label={
              saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`
            }
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--porcelain)]/92 text-[var(--ink)] shadow-sm transition hover:scale-105 disabled:cursor-wait disabled:opacity-70"
          >
            <Heart className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 right-3 hidden translate-y-3 gap-2 opacity-0 transition duration-300 md:flex md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
          <ProductQuickView
            product={product}
            onAddToCart={addToCart}
            onToggleWishlist={toggleWishlist}
            saved={saved}
            busy={busy}
          />
          <button
            type="button"
            onClick={() => void addToCart()}
            disabled={busy === "cart"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--porcelain)] text-[var(--ink)] shadow-sm transition hover:bg-white"
            aria-label={`Add ${product.title} to cart`}
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3.5">
        <div className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate">{creator?.name ?? "Independent creator"}</span>
            {isProfessional && <ProBadge size="sm" />}
          </div>
          {creator?.verified && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[var(--indigo)]">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified
            </span>
          )}
        </div>
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          className="mt-0.5 block font-display text-lg leading-snug hover:underline"
        >
          {product.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold">{formatPrice(product.price)}</span>
          <span className="text-muted-foreground">{product.medium.split(" on ")[0]}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{product.framed ? "Framed" : "Unframed"}</span>
          <span aria-hidden className="text-[var(--color-border-strong)]">
            •
          </span>
          <span>{product.dimensions}</span>
          <span aria-hidden className="text-[var(--color-border-strong)]">
            •
          </span>
          <span>Ships in 5–7 days</span>
        </div>
      </div>
    </article>
  );
}

function ProductQuickView({
  product,
  onAddToCart,
  onToggleWishlist,
  saved,
  busy,
}: {
  product: Product;
  onAddToCart: () => Promise<void>;
  onToggleWishlist: () => Promise<void>;
  saved: boolean;
  busy: "wishlist" | "cart" | null;
}) {
  const { formatPrice } = useCurrency();
  const creator = CREATORS.find((c) => c.slug === product.creatorSlug);
  const hasStory = Boolean(
    product.story?.text || ARTWORKS.find((a) => a.slug === product.slug)?.story?.text,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--porcelain)] px-4 text-sm font-semibold text-[var(--ink)] shadow-sm transition hover:bg-white"
        >
          <Eye className="h-4 w-4" />
          Quick view
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-3rem)] max-w-4xl overflow-y-auto rounded-2xl bg-[var(--porcelain)] p-0 sm:rounded-2xl">
        <div className="grid md:grid-cols-[0.95fr_1fr]">
          <div className="relative min-h-[320px] bg-secondary">
            {product.images[0] ? (
              <img
                src={product.images[0]}
                alt={product.title}
                decoding="async"
                width={800}
                height={1000}
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[320px] items-center justify-center p-6 text-sm text-muted-foreground">
                Artwork image unavailable
              </div>
            )}
          </div>
          <div className="p-6 md:p-8">
            <DialogHeader className="text-left">
              <div className="flex flex-wrap gap-2">
                <span className="chip" style={{ background: "var(--ink)", color: "var(--ivory)" }}>
                  {product.kind}
                  {product.editionOf ? ` / Ed. of ${product.editionOf}` : ""}
                </span>
                {hasStory && (
                  <span
                    className="chip font-medium"
                    style={{ background: "var(--oxblood)", color: "var(--ivory)" }}
                  >
                    ✦ Story Behind This Work
                  </span>
                )}
                {product.kind === "AI-assisted" && (
                  <span
                    className="chip"
                    style={{ background: "var(--indigo)", color: "var(--porcelain)" }}
                  >
                    <Sparkles className="h-3 w-3" /> AI disclosed
                  </span>
                )}
              </div>
              <DialogTitle className="mt-4 font-display text-3xl font-normal leading-tight">
                {product.title}
              </DialogTitle>
              <DialogDescription>
                by {creator?.name} / {creator?.location}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 font-display text-3xl">{formatPrice(product.price)}</div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-4 text-xs">
              {[
                ["Type", product.kind],
                ["Dimensions", product.dimensions],
                ["Medium", product.medium],
                ["Framing", product.framed ? "Framed" : "Unframed"],
                ["Delivery", "Ships in 5–7 business days"],
                ["Disclosure", product.kind === "AI-assisted" ? "AI-assisted" : "Creator declared"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="eyebrow">{label}</dt>
                  <dd className="mt-1 text-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void onAddToCart()}
                disabled={busy === "cart"}
                className="btn-primary disabled:cursor-wait disabled:opacity-70"
              >
                {busy === "cart" ? "Adding…" : "Add to Cart"}
              </button>
              <Link to="/product/$slug" params={{ slug: product.slug }} className="btn-ghost">
                View Full Details
              </Link>
            </div>
            <button
              type="button"
              onClick={() => void onToggleWishlist()}
              disabled={busy === "wishlist"}
              className="btn-ghost mt-3 w-full disabled:cursor-wait disabled:opacity-70"
            >
              <Heart className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
              {saved ? "Saved" : "Wishlist"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
