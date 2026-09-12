import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getProduct } from "@/lib/artdera";
import { useAuth } from "@/marketplace/auth";
import { useCurrency } from "@/marketplace/currency";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { ARTWORKS } from "@/marketplace/data";
import { ShippingQuoteService } from "@/marketplace/services";
import { PageLoading } from "@/components/site/PageLoading";

export const Route = createFileRoute("/request-quote")({
  component: RequestQuotePage,
});

function RequestQuotePage() {
  const search = Route.useSearch() as { artwork?: string };
  const product = search?.artwork ? getProduct(search.artwork) : null;
  const { user, ready } = useAuth();
  const { formatPrice, currency } = useCurrency();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || user || !product) return;
    const returnPath = `/request-quote?artwork=${encodeURIComponent(product.slug)}`;
    window.location.replace(`/auth/login?redirect=${encodeURIComponent(returnPath)}`);
  }, [product, ready, user]);

  if (!product) {
    return (
      <div className="container-editorial py-24 text-center">
        <h1 className="font-display text-4xl">Artwork not specified</h1>
        <Link to="/discover" className="btn-primary mt-6">
          Back to Discover
        </Link>
      </div>
    );
  }

  if (!ready || !user) return <PageLoading label="Opening the shipping quote request" />;

  const submitQuoteRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const artwork = ARTWORKS.find((item) => item.slug === product.slug);
    if (!artwork) return toast.error("This artwork is not available for a shipping quote.");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      artworkId: artwork.id,
      quantity: 1,
      shippingAddress: {
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        country: String(formData.get("country") ?? ""),
        province: String(formData.get("province") ?? ""),
        city: String(formData.get("city") ?? ""),
        postalCode: String(formData.get("postalCode") ?? "") || undefined,
        line1: String(formData.get("addressLine") ?? ""),
      },
    };

    const result = await ShippingQuoteService.request(payload);
    if (result.error) {
      toast.error(result.error.message);
      setLoading(false);
      return;
    }
    toast.success("Shipping quote requested successfully.");
    window.location.assign("/account/quotes");
  };

  return (
    <div className="container-editorial py-12 lg:py-16 max-w-4xl mx-auto">
      <div className="eyebrow">International Shipping</div>
      <h1 className="mt-3 font-display text-4xl md:text-5xl">Request a Delivery Quote</h1>
      <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
        For international orders, we calculate custom shipping rates based on the artwork's
        dimensions, framing, and your destination to ensure safe and fully-insured delivery.
      </p>

      <div className="mt-10 grid md:grid-cols-[1fr_320px] gap-10">
        <form
          onSubmit={submitQuoteRequest}
          className="space-y-6 bg-[var(--porcelain)] p-6 rounded-2xl border border-[var(--color-border)]"
        >
          <h2 className="font-display text-2xl">Delivery Destination</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow mb-2 block">Full name</span>
              <input
                required
                name="fullName"
                autoComplete="name"
                className="art-field"
                defaultValue={user?.fullName ?? ""}
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block">Mobile with country code</span>
              <input
                required
                name="phone"
                autoComplete="tel"
                className="art-field"
                defaultValue={user?.mobile ?? ""}
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block">Country</span>
              <input
                required
                name="country"
                className="art-field"
                placeholder="e.g. United States"
                defaultValue={user?.country ?? ""}
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block">State / Province</span>
              <input
                required
                name="province"
                className="art-field"
                defaultValue={user?.province ?? ""}
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block">City / State</span>
              <input required name="city" className="art-field" placeholder="e.g. New York, NY" />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block">Postal Code</span>
              <input required name="postalCode" className="art-field" />
            </label>
            <label className="block sm:col-span-2">
              <span className="eyebrow mb-2 block">Street Address</span>
              <input required name="addressLine" className="art-field" />
            </label>
          </div>

          <button disabled={loading} className="btn-primary w-full py-3.5 mt-4 disabled:opacity-50">
            {loading ? "Submitting..." : "Request Quote"}
          </button>
        </form>

        <aside className="bg-[var(--ivory)] p-5 rounded-2xl border border-[var(--color-border)] h-fit">
          <img
            src={product.images[0]}
            alt={product.title}
            className="w-full aspect-[4/5] object-cover rounded-xl"
          />
          <h3 className="mt-4 font-display text-2xl">{product.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.dimensions} · {product.framed ? "Framed" : "Unframed"}
          </p>
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="text-sm font-semibold">{formatPrice(product.price)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Artwork price ({currency})</div>
          </div>

          <div className="mt-5 bg-white/50 p-4 rounded-xl flex gap-3 text-xs text-muted-foreground leading-relaxed">
            <Globe className="w-4 h-4 text-[var(--oxblood)] shrink-0" />
            <div>
              <strong className="text-foreground block mb-1">What happens next?</strong>
              Our team will contact logistics partners and send you a fully inclusive quote within
              24-48 hours. You can review and accept it from your account dashboard.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
