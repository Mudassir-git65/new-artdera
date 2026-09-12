import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/marketplace/auth";
import { useCurrency } from "@/marketplace/currency";
import { CartService, WishlistService, type CartEntry } from "@/marketplace/services";
import { PageLoading } from "@/components/site/PageLoading";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [{ title: "Your Cart — ArtDera" }, { name: "robots", content: "noindex" }],
  }),
  component: Cart,
});

function Cart() {
  const { user, ready } = useAuth();
  const { formatPrice } = useCurrency();
  const [items, setItems] = useState<CartEntry[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState("");
  const [notice, setNotice] = useState("");

  const loadCart = async () => {
    setLoading(true);
    const result = await CartService.get();
    if (result.data) {
      setItems(result.data.items);
      setSubtotal(result.data.subtotal);
      setNotice("");
    } else {
      setNotice(result.error?.message ?? "Your cart could not be loaded.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!ready) return;
    if (user) void loadCart();
    else setLoading(false);
  }, [ready, user]);

  const setQuantity = async (entry: CartEntry, quantity: number) => {
    if (quantity < 1 || quantity > entry.artwork.quantity) return;
    setPendingId(entry.artwork.id);
    const result = await CartService.add(entry.artwork.id, quantity);
    if (result.error) setNotice(result.error.message);
    else await loadCart();
    setPendingId("");
  };

  const remove = async (artworkId: string) => {
    setPendingId(artworkId);
    const result = await CartService.remove(artworkId);
    if (result.error) setNotice(result.error.message);
    else await loadCart();
    setPendingId("");
  };

  const saveForLater = async (artworkId: string) => {
    setPendingId(artworkId);
    const result = await WishlistService.save(artworkId);
    if (result.error) setNotice(result.error.message);
    else {
      await CartService.remove(artworkId);
      setNotice("Saved to your wishlist.");
      await loadCart();
    }
    setPendingId("");
  };

  if (!ready) return <PageLoading label="Loading your cart" />;
  if (!user)
    return (
      <div className="container-editorial flex min-h-[60vh] items-center justify-center py-14 text-center">
        <div>
          <ShoppingBag className="mx-auto h-10 w-10 text-[var(--oxblood)]" />
          <h1 className="mt-5 font-display text-5xl">Sign in to view your cart.</h1>
          <Link to="/auth/login" search={{ redirect: "/cart" }} className="btn-primary mt-6">
            Sign In
          </Link>
        </div>
      </div>
    );

  return (
    <div className="container-editorial py-12 lg:py-16">
      <div className="eyebrow">Your cart</div>
      <h1 className="mt-3 font-display text-5xl">Art chosen for your space.</h1>
      {notice && (
        <div
          className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4 text-sm"
          role="status"
        >
          {notice}
        </div>
      )}
      <div className="mt-9 grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <main>
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading your saved cart…
            </div>
          ) : items.length ? (
            <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {items.map(({ artwork, quantity, priceChanged, available }) => {
                const unitPrice = artwork.discountPrice ?? artwork.price;
                const pending = pendingId === artwork.id;
                return (
                  <article
                    key={artwork.id}
                    className="grid gap-5 py-6 sm:grid-cols-[120px_1fr_auto]"
                  >
                    <a href={`/product/${artwork.slug}`}>
                      <img
                        src={artwork.images[0]?.url}
                        alt={artwork.title}
                        className="aspect-[4/5] w-full rounded-xl object-cover"
                      />
                    </a>
                    <div>
                      <a
                        href={`/product/${artwork.slug}`}
                        className="font-display text-2xl hover:underline"
                      >
                        {artwork.title}
                      </a>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {artwork.creatorName} · {artwork.medium}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {artwork.dimensions} · {artwork.framed ? "Framed" : "Unframed"}
                      </div>
                      {priceChanged && (
                        <p className="mt-2 text-xs text-[var(--destructive)]">
                          The price changed since this work was added.
                        </p>
                      )}
                      {!available && (
                        <p className="mt-2 text-xs text-[var(--destructive)]">
                          This work is currently unavailable.
                        </p>
                      )}
                      <div className="mt-4 inline-flex items-center rounded-full border border-[var(--color-border-strong)]">
                        <button
                          type="button"
                          disabled={pending || quantity <= 1}
                          onClick={() =>
                            void setQuantity(
                              { artwork, quantity, priceChanged, available },
                              quantity - 1,
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center disabled:opacity-35"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-8 text-center text-sm">{quantity}</span>
                        <button
                          type="button"
                          disabled={pending || quantity >= artwork.quantity}
                          onClick={() =>
                            void setQuantity(
                              { artwork, quantity, priceChanged, available },
                              quantity + 1,
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center disabled:opacity-35"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-row items-start justify-between gap-4 sm:flex-col sm:items-end">
                      <strong>{formatPrice(unitPrice * quantity)}</strong>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void saveForLater(artwork.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border disabled:opacity-35"
                          aria-label="Save for later"
                        >
                          <Heart className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void remove(artwork.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border text-[var(--destructive)] disabled:opacity-35"
                          aria-label={`Remove ${artwork.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-12 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-[var(--oxblood)]" />
              <h2 className="mt-5 font-display text-4xl">Your cart is empty.</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Explore original work, prints and carefully chosen decor.
              </p>
              <Link to="/discover" className="btn-primary mt-6">
                Explore Art
              </Link>
            </div>
          )}
          <div className="mt-6 flex gap-3 rounded-xl bg-[var(--porcelain)] p-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--indigo)]" />
            Seller contact details remain protected before a paid order. Availability and current
            prices are verified by the server.
          </div>
        </main>
        <aside className="h-fit rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 lg:sticky lg:top-28">
          <div className="font-display text-3xl">Order summary</div>
          <dl className="mt-6 divide-y divide-[var(--color-border)] text-sm">
            <div className="flex justify-between py-3">
              <dt>Painting price</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
          </dl>
          <div className="flex justify-between border-t-2 border-[var(--ink)] pt-4 font-display text-2xl">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <Link
            to="/checkout"
            className={`btn-primary mt-6 w-full ${!items.length || items.some((entry) => !entry.available || entry.priceChanged) ? "pointer-events-none opacity-45" : ""}`}
          >
            Continue to Checkout
          </Link>
          <p className="mt-5 text-xs text-muted-foreground">
            No shipping, packaging or processing fee is added at checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}
