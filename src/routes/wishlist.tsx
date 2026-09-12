import { createFileRoute } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/marketplace/auth";
import { formatPKR } from "@/marketplace/config";
import { CartService, WishlistService } from "@/marketplace/services";
import type { Artwork } from "@/marketplace/types";
import { PageLoading } from "@/components/site/PageLoading";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist - ArtDera" },
      {
        name: "description",
        content: "Save artworks, prints and decor you are considering on ArtDera.",
      },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = async () => {
    const result = await WishlistService.list();
    if (result.data) setItems(result.data);
    else setNotice(result.error?.message ?? "Your wishlist could not be loaded.");
    setLoading(false);
  };

  useEffect(() => {
    if (!ready) return;
    if (user) void load();
    else setLoading(false);
  }, [ready, user]);

  if (!ready) return <PageLoading label="Loading your wishlist" />;
  if (!user)
    return (
      <div className="container-editorial py-20 text-center">
        <Heart className="mx-auto h-10 w-10 text-[var(--oxblood)]" />
        <h1 className="mt-5 font-display text-5xl">Sign in to see your wishlist.</h1>
        <a href="/auth/login?redirect=/wishlist" className="btn-primary mt-6">
          Sign In
        </a>
      </div>
    );

  return (
    <div className="container-editorial py-16">
      <div className="eyebrow">Wishlist</div>
      <h1 className="mt-3 font-display text-5xl">Your walls are waiting.</h1>
      {notice && (
        <p className="mt-4 rounded-xl bg-[var(--porcelain)] p-4 text-sm" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading your saved works…</p>
      ) : items.length ? (
        <div className="mt-9 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {items.map((artwork) => (
            <article key={artwork.id} className="group">
              <a
                href={`/product/${artwork.slug}`}
                className="block overflow-hidden rounded-xl bg-[var(--porcelain)]"
              >
                <img
                  src={artwork.images[0]?.url}
                  alt={artwork.title}
                  className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />
              </a>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <a
                    href={`/product/${artwork.slug}`}
                    className="font-display text-xl hover:underline"
                  >
                    {artwork.title}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {artwork.creatorName} · {artwork.medium}
                  </p>
                  <strong className="mt-2 block text-sm">
                    {formatPKR(artwork.discountPrice ?? artwork.price)}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void (async () => {
                      const result = await WishlistService.remove(artwork.id);
                      if (result.error) setNotice(result.error.message);
                      else setItems((current) => current.filter((item) => item.id !== artwork.id));
                    })()
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full border"
                  aria-label={`Remove ${artwork.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    const result = await CartService.add(artwork.id);
                    setNotice(result.error?.message ?? "Added to your cart.");
                  })()
                }
                className="btn-ghost mt-3 w-full"
              >
                Add to Cart
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="mx-auto mt-12 max-w-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--porcelain)] shadow-[var(--shadow-soft)]">
            <Heart className="h-6 w-6 text-[var(--oxblood)]" />
          </div>
          <h2 className="mt-6 font-display text-4xl">No saved works yet.</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Save work while comparing scale, colour and placement.
          </p>
          <a href="/discover" className="btn-primary mt-7">
            Explore Art
          </a>
        </div>
      )}
    </div>
  );
}
