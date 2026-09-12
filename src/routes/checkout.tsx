import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  Copy,
  ImageUp,
  Info,
  Landmark,
  ShieldCheck,
  Smartphone,
  Tag,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatPKR } from "@/marketplace/config";
import { useAuth } from "@/marketplace/auth";
import { useCurrency } from "@/marketplace/currency";
import {
  CartService,
  AffiliateService,
  CheckoutService,
  ShippingQuoteService,
  UploadService,
  type CartEntry,
  type CheckoutAddress,
  type AffiliateCheckoutPreview,
  type ManualPaymentDetails,
  type PaymentProof,
  type ShippingQuote,
} from "@/marketplace/services";
import type { PaymentMethod } from "@/marketplace/types";
import { ARTWORKS } from "@/marketplace/data";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Secure Checkout — ArtDera" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: Checkout,
});

const methods: Array<{
  icon: typeof Smartphone;
  label: "JazzCash" | "Easypaisa" | "HBL (Bank Transfer)";
  value: "jazzcash" | "easypaisa" | "hbl";
  description: string;
}> = [
  {
    icon: Smartphone,
    label: "JazzCash",
    value: "jazzcash",
    description: "Send from any JazzCash mobile account",
  },
  {
    icon: WalletCards,
    label: "Easypaisa",
    value: "easypaisa",
    description: "Send from any Easypaisa mobile account",
  },
  {
    icon: Landmark,
    label: "HBL (Bank Transfer)",
    value: "hbl",
    description: "International wire or local transfer to HBL",
  },
];

function Checkout() {
  const search = Route.useSearch() as {
    paymentId?: string;
    paymentIds?: string;
    shippingQuoteId?: string;
    ref?: string;
  };
  const { user, ready } = useAuth();
  const { formatPrice } = useCurrency();
  const [items, setItems] = useState<CartEntry[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [method, setMethod] = useState<"jazzcash" | "easypaisa" | "hbl">("jazzcash");
  const [same, setSame] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState<ManualPaymentDetails[]>([]);
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [completed, setCompleted] = useState<{ orderId: string; paymentId: string } | null>(null);
  const [affiliateCode, setAffiliateCode] = useState(
    typeof search.ref === "string" ? search.ref.toUpperCase() : "",
  );
  const [affiliatePreview, setAffiliatePreview] = useState<AffiliateCheckoutPreview | null>(null);
  const [affiliateMessage, setAffiliateMessage] = useState("");
  const [applyingAffiliate, setApplyingAffiliate] = useState(false);
  const initialAffiliateCode = useRef(affiliateCode);
  const checkoutKey = useRef<string | null>(null);
  const paymentIdsParam =
    typeof search.paymentIds === "string"
      ? search.paymentIds
      : typeof search.paymentId === "string"
        ? search.paymentId
        : "";
  const shippingQuoteId =
    typeof search.shippingQuoteId === "string" ? search.shippingQuoteId : null;

  const refreshAffiliatePricing = useCallback(async (code: string, quoteId?: string) => {
    const result = await AffiliateService.checkoutPreview(code.trim() || undefined, quoteId);
    if (result.data) {
      setAffiliatePreview(result.data);
      if (result.data.attribution) setAffiliateMessage(result.data.attribution.message);
      else if (code.trim()) setAffiliateMessage("No ambassador discount is active.");
      return true;
    }
    if (code.trim())
      setAffiliateMessage(result.error?.message ?? "This code could not be applied.");
    return false;
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const requestedPaymentIds = [
      ...new Set(
        paymentIdsParam
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].slice(0, 20);
    if (requestedPaymentIds.length) {
      void Promise.all(requestedPaymentIds.map((id) => CheckoutService.getManual(id))).then(
        (results) => {
          const available = results.flatMap((result) => (result.data ? [result.data] : []));
          if (available.length) setPayments(available);
          if (available.length !== requestedPaymentIds.length)
            setError(
              results.find((result) => result.error)?.error?.message ??
                "Some payment details could not be loaded.",
            );
          setLoading(false);
        },
      );
      return;
    }
    if (shippingQuoteId) {
      void ShippingQuoteService.list().then((result) => {
        const quote = result.data?.find((item) => item.id === shippingQuoteId);
        if (!quote) {
          setError(result.error?.message ?? "This shipping quote could not be loaded.");
          setLoading(false);
          return;
        }
        if (quote.status !== "accepted") {
          setError("Accept this shipping quote before continuing to checkout.");
          setLoading(false);
          return;
        }
        const artwork = ARTWORKS.find((item) => item.id === quote.artworkId);
        if (!artwork) {
          setError("The artwork attached to this quote is no longer available.");
          setLoading(false);
          return;
        }
        setShippingQuote(quote);
        setItems([
          {
            artwork,
            quantity: quote.quantity,
            priceChanged: false,
            available: true,
          },
        ]);
        setSubtotal((artwork.discountPrice ?? artwork.price) * quote.quantity);
        void refreshAffiliatePricing(initialAffiliateCode.current, quote.id);
        setLoading(false);
      });
      return;
    }
    void CartService.get().then((result) => {
      if (result.data) {
        setItems(result.data.items);
        setSubtotal(result.data.subtotal);
        void refreshAffiliatePricing(initialAffiliateCode.current);
      } else setError(result.error?.message ?? "Your cart could not be loaded.");
      setLoading(false);
    });
  }, [paymentIdsParam, ready, refreshAffiliatePricing, shippingQuoteId, user]);

  async function applyAffiliateCode() {
    if (!affiliateCode.trim() || applyingAffiliate) return;
    setApplyingAffiliate(true);
    setAffiliateMessage("");
    await refreshAffiliatePricing(affiliateCode, shippingQuoteId ?? undefined);
    setApplyingAffiliate(false);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreed || !items.length || submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const shippingAddress: CheckoutAddress = {
      fullName: String(form.get("fullName") ?? ""),
      line1: String(form.get("line1") ?? ""),
      line2: String(form.get("line2") ?? "") || undefined,
      city: String(form.get("city") ?? ""),
      province: String(form.get("province") ?? ""),
      postalCode: String(form.get("postalCode") ?? "") || undefined,
      country: String(form.get("country") ?? "Pakistan"),
      phone: String(form.get("phone") ?? ""),
    };
    const billingAddress = same
      ? undefined
      : { ...shippingAddress, line1: String(form.get("billingLine1") ?? "") };
    const result = await CheckoutService.create({
      shippingAddress,
      billingAddress,
      method: method as PaymentMethod,
      shippingQuoteId: shippingQuote?.id,
      affiliateCode: affiliatePreview?.attribution?.applied
        ? affiliatePreview.attribution.code
        : undefined,
      idempotencyKey: (checkoutKey.current ??= crypto.randomUUID()),
    });
    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }
    const manualPayments = result
      .data!.orders.filter((entry) => entry.paymentInstructions)
      .map((entry) => ({
        order: entry.order,
        payment: entry.payment,
        paymentInstructions: entry.paymentInstructions!,
        canSubmit: true,
      }));
    if (!manualPayments.length) {
      setError("Payment instructions could not be prepared. Please contact ArtDera support.");
      setSubmitting(false);
      return;
    }
    setPayments(manualPayments);
    const paymentIds = manualPayments.map((entry) => entry.payment.id).join(",");
    window.history.replaceState(
      window.history.state,
      "",
      `/checkout?paymentIds=${encodeURIComponent(paymentIds)}`,
    );
    setSubmitting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitted(paymentId: string, proof: PaymentProof, orderId: string) {
    setPayments((current) =>
      current.map((entry) =>
        entry.payment.id === paymentId ? { ...entry, latestProof: proof, canSubmit: false } : entry,
      ),
    );
    setCompleted({ orderId, paymentId });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!ready || loading)
    return (
      <div className="container-editorial py-20 text-center">
        <p className="text-sm text-muted-foreground">Preparing your checkout…</p>
      </div>
    );
  if (!user)
    return (
      <div className="container-editorial py-20 text-center">
        <h1 className="font-display text-5xl">Sign in to checkout.</h1>
        <a href="/auth/login?redirect=/checkout" className="btn-primary mt-6">
          Sign In
        </a>
      </div>
    );
  if (completed) {
    const remaining = payments.some(
      (entry) => entry.payment.id !== completed.paymentId && entry.canSubmit,
    );
    return (
      <div className="container-editorial flex min-h-[70vh] items-center justify-center py-14">
        <div className="max-w-2xl rounded-3xl bg-[var(--ink)] p-8 text-center text-[var(--ivory)] md:p-12">
          <CheckCircle2 className="mx-auto h-16 w-16 text-[var(--terracotta)]" />
          <div className="eyebrow mt-7 !text-white/45">Pending Verification</div>
          <h1 className="mt-3 font-display text-5xl">Payment proof received.</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/65">
            Order <strong className="text-white">{completed.orderId}</strong> is now Awaiting
            Payment Approval. Verification may take some time, and the order has not been marked as
            paid.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {remaining && (
              <button
                type="button"
                onClick={() => setCompleted(null)}
                className="btn-primary bg-[var(--terracotta)] !text-[var(--ink)]"
              >
                Submit Remaining Proof
              </button>
            )}
            <a
              href="/account/orders"
              className={
                remaining
                  ? "btn-ghost !border-white/20 !text-white"
                  : "btn-primary bg-[var(--terracotta)] !text-[var(--ink)]"
              }
            >
              View Order
            </a>
          </div>
        </div>
      </div>
    );
  }
  if (payments.length)
    return (
      <PaymentStage
        payments={payments}
        customerName={user.fullName}
        customerMobile={user.mobile ?? ""}
        error={error}
        onSubmitted={submitted}
      />
    );

  const unavailable = items.some((entry) => !entry.available || entry.priceChanged);

  return (
    <form onSubmit={submitOrder} className="container-editorial py-12 lg:py-16">
      {error && <CheckoutError message={error} />}
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <main className="space-y-6">
          <CheckoutSection title="Contact details">
            <div className="grid gap-4 sm:grid-cols-2">
              <CheckoutField label="Full name">
                <input
                  required
                  name="fullName"
                  autoComplete="name"
                  className="art-field"
                  defaultValue={user.fullName}
                />
              </CheckoutField>
              <CheckoutField label="Email">
                <input
                  readOnly
                  type="email"
                  className="art-field bg-[var(--ivory)]"
                  value={user.email}
                />
              </CheckoutField>
              <CheckoutField label="Mobile with country code">
                <input
                  required
                  name="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  className="art-field"
                  defaultValue={user.mobile ?? ""}
                />
              </CheckoutField>
            </div>
          </CheckoutSection>
          <CheckoutSection title="Delivery address">
            <div className="grid gap-4 sm:grid-cols-2">
              <CheckoutField label="Address line" wide>
                <input
                  required
                  name="line1"
                  autoComplete="address-line1"
                  className="art-field"
                  defaultValue={shippingQuote?.shippingAddress ?? ""}
                />
              </CheckoutField>
              <CheckoutField label="Apartment, suite or landmark" wide>
                <input name="line2" autoComplete="address-line2" className="art-field" />
              </CheckoutField>
              <CheckoutField label="City">
                <input
                  required
                  name="city"
                  autoComplete="address-level2"
                  className="art-field"
                  defaultValue={shippingQuote?.city ?? user.city}
                />
              </CheckoutField>
              <CheckoutField label="Province">
                <input
                  required
                  name="province"
                  autoComplete="address-level1"
                  className="art-field"
                  defaultValue={shippingQuote?.province ?? user.province ?? ""}
                />
              </CheckoutField>
              <CheckoutField label="Postal code">
                <input
                  name="postalCode"
                  autoComplete="postal-code"
                  className="art-field"
                  defaultValue={shippingQuote?.postalCode ?? ""}
                />
              </CheckoutField>
              <CheckoutField label="Country">
                <input
                  required
                  name="country"
                  autoComplete="country-name"
                  className="art-field"
                  defaultValue={shippingQuote?.country ?? user.country ?? "Pakistan"}
                />
              </CheckoutField>
            </div>
            <label className="mt-5 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={same}
                onChange={(event) => setSame(event.target.checked)}
                className="accent-[var(--oxblood)]"
              />
              Billing address is the same
            </label>
            {!same && (
              <div className="mt-4 rounded-xl bg-[var(--ivory)] p-4">
                <CheckoutField label="Billing address">
                  <input
                    required
                    name="billingLine1"
                    autoComplete="billing street-address"
                    className="art-field"
                  />
                </CheckoutField>
              </div>
            )}
          </CheckoutSection>
          <CheckoutSection title="Payment method">
            <div className="grid gap-3 sm:grid-cols-2">
              {methods.map(({ icon: Icon, label, value, description }) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={method === value}
                  onClick={() => setMethod(value)}
                  className={`flex min-h-24 gap-3 rounded-xl border p-4 text-left transition-colors ${
                    method === value
                      ? "border-[var(--oxblood)] bg-[var(--ivory)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0 text-[var(--indigo)]" />
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{description}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-3 rounded-xl bg-[var(--ivory)] p-4 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              ArtDera will never ask for your banking PIN, OTP or password.
            </div>
          </CheckoutSection>
        </main>
        <aside className="h-fit rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 lg:sticky lg:top-28">
          <div className="eyebrow">Your order</div>
          {items.length ? (
            items.map(({ artwork, quantity }) => (
              <div
                key={artwork.id}
                className="mt-5 flex gap-4 border-b border-[var(--color-border)] pb-5"
              >
                <img
                  src={artwork.images[0]?.url}
                  alt={artwork.title}
                  className="h-28 w-24 rounded-xl object-cover"
                />
                <div>
                  <h2 className="font-display text-2xl">{artwork.title}</h2>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {artwork.creatorName} · Qty {quantity}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {artwork.dimensions} · {artwork.medium}
                  </div>
                  <div className="mt-3 text-sm font-semibold">
                    {formatPrice((artwork.discountPrice ?? artwork.price) * quantity)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="mt-5 rounded-xl bg-[var(--ivory)] p-4 text-sm text-muted-foreground">
              Your cart is empty.{" "}
              <Link to="/discover" className="font-semibold text-[var(--oxblood)]">
                Discover artworks
              </Link>
              .
            </div>
          )}
          <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-4">
            <label
              htmlFor="affiliate-code"
              className="flex items-center gap-2 text-xs font-semibold"
            >
              <Tag className="h-4 w-4 text-[var(--oxblood)]" />
              Affiliate / Promo Code
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="affiliate-code"
                value={affiliateCode}
                onChange={(event) => {
                  setAffiliateCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                  setAffiliatePreview(null);
                  setAffiliateMessage("");
                }}
                maxLength={20}
                autoComplete="off"
                className="art-field min-w-0 flex-1 uppercase"
                placeholder="E.g. AYESHA5"
              />
              <button
                type="button"
                onClick={() => void applyAffiliateCode()}
                disabled={applyingAffiliate || affiliateCode.length < 5}
                className="btn-ghost shrink-0 px-4 disabled:opacity-45"
              >
                {applyingAffiliate ? "Checking…" : "Apply"}
              </button>
            </div>
            {affiliateMessage && (
              <p
                className={`mt-2 text-xs ${affiliatePreview?.attribution?.applied ? "text-emerald-700" : "text-muted-foreground"}`}
              >
                {affiliateMessage}
              </p>
            )}
          </div>
          <dl className="mt-6 divide-y divide-[var(--color-border)] text-sm">
            <div className="flex justify-between py-3">
              <dt>Original artwork price</dt>
              <dd>{formatPrice(affiliatePreview?.originalArtworkPrice ?? subtotal)}</dd>
            </div>
            <div className="flex justify-between py-3 text-emerald-700">
              <dt>Affiliate discount</dt>
              <dd>−{formatPrice(affiliatePreview?.affiliateDiscount ?? 0)}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt>Final artwork price</dt>
              <dd>{formatPrice(affiliatePreview?.finalArtworkPrice ?? subtotal)}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt>Shipping</dt>
              <dd>
                {formatPrice(affiliatePreview?.shipping ?? shippingQuote?.quotedShippingCost ?? 0)}
              </dd>
            </div>
            {(affiliatePreview?.packaging ?? shippingQuote?.quotedPackagingCost ?? 0) > 0 && (
              <div className="flex justify-between py-3">
                <dt>Art-safe packaging</dt>
                <dd>
                  {formatPrice(
                    affiliatePreview?.packaging ?? shippingQuote?.quotedPackagingCost ?? 0,
                  )}
                </dd>
              </div>
            )}
            <div className="flex justify-between py-3">
              <dt>Taxes / customs</dt>
              <dd>{formatPrice(affiliatePreview?.taxes ?? 0)}</dd>
            </div>
            <div className="flex justify-between py-3 font-semibold">
              <dt>Final total</dt>
              <dd>
                {formatPrice(
                  affiliatePreview?.total ??
                    subtotal +
                      (shippingQuote?.quotedShippingCost ?? 0) +
                      (shippingQuote?.quotedPackagingCost ?? 0),
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {shippingQuote
              ? `This total includes your approved international quote${shippingQuote.estimatedDeliveryTime ? ` (${shippingQuote.estimatedDeliveryTime})` : ""}.`
              : "This is the exact amount to pay. No shipping, packaging or processing fee is added."}
          </p>
          <label className="mt-6 flex items-start gap-3 text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 accent-[var(--oxblood)]"
            />
            <span>I agree to the order terms, return information and buyer protection policy.</span>
          </label>
          <button
            disabled={!agreed || !items.length || unavailable || submitting}
            className="btn-primary mt-5 w-full disabled:opacity-45"
          >
            {submitting
              ? "Preparing payment…"
              : `Continue with ${method === "jazzcash" ? "JazzCash" : method === "easypaisa" ? "Easypaisa" : "HBL"}`}
          </button>
          {unavailable && (
            <p className="mt-3 text-xs text-[var(--destructive)]">
              Review price or availability changes in your cart before continuing.
            </p>
          )}
        </aside>
      </div>
    </form>
  );
}

function PaymentStage({
  payments,
  customerName,
  customerMobile,
  error,
  onSubmitted,
}: {
  payments: ManualPaymentDetails[];
  customerName: string;
  customerMobile: string;
  error: string;
  onSubmitted: (paymentId: string, proof: PaymentProof, orderId: string) => void;
}) {
  return (
    <div className="container-editorial py-10 lg:py-14">
      <div className="max-w-3xl">
        <div className="eyebrow">Manual payment</div>
        <h1 className="mt-2 font-display text-5xl">Complete your payment.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Use the secure account details shown for each order. No PIN, OTP or wallet password is
          collected by ArtDera.
        </p>
      </div>
      {error && (
        <div className="mt-6">
          <CheckoutError message={error} />
        </div>
      )}
      <div className="mt-8 space-y-8">
        {payments.map((payment) => (
          <ManualPaymentCard
            key={payment.payment.id}
            details={payment}
            customerName={customerName}
            customerMobile={customerMobile}
            onSubmitted={(proof) =>
              onSubmitted(payment.payment.id, proof, payment.paymentInstructions.orderId)
            }
          />
        ))}
      </div>
    </div>
  );
}

function ManualPaymentCard({
  details,
  customerName,
  customerMobile,
  onSubmitted,
}: {
  details: ManualPaymentDetails;
  customerName: string;
  customerMobile: string;
  onSubmitted: (proof: PaymentProof) => void;
}) {
  const { paymentInstructions: instructions, latestProof, canSubmit } = details;
  const [copied, setCopied] = useState<"account" | "amount" | "iban" | null>(null);

  async function copy(value: string, key: "account" | "amount" | "iban") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)]">
      <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
        <div className="bg-[var(--ink)] p-6 text-[var(--ivory)] md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="eyebrow !text-white/45">Selected method</div>
              <h2 className="mt-2 font-display text-4xl">{instructions.label}</h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              {instructions.method === "hbl" ? (
                <Landmark className="h-5 w-5 text-[var(--terracotta)]" />
              ) : (
                <Smartphone className="h-5 w-5 text-[var(--terracotta)]" />
              )}
            </div>
          </div>
          <dl className="mt-7 divide-y divide-white/10 text-sm">
            <PaymentDetail label="Account title" value={instructions.accountTitle} />
            <PaymentDetail
              label={instructions.iban ? "Account number" : "Mobile account number"}
              value={instructions.accountNumber}
            >
              <CopyButton
                label="Copy account number"
                copied={copied === "account"}
                onClick={() => copy(instructions.accountNumber, "account")}
              />
            </PaymentDetail>
            {instructions.iban && (
              <PaymentDetail label="IBAN" value={instructions.iban}>
                <CopyButton
                  label="Copy IBAN"
                  copied={copied === "iban"}
                  onClick={() => copy(instructions.iban!, "iban")}
                />
              </PaymentDetail>
            )}
            <PaymentDetail label="Payment amount" value={formatPKR(instructions.amount)}>
              <CopyButton
                label="Copy amount"
                copied={copied === "amount"}
                onClick={() => copy(String(instructions.amount), "amount")}
              />
            </PaymentDetail>
            <PaymentDetail label="Order ID" value={instructions.orderId} />
          </dl>
          {instructions.qrCode && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl bg-white/5 p-4 text-center">
              <span className="eyebrow mb-3 block !text-white/60">Scan to pay</span>
              <img
                src={instructions.qrCode}
                alt="Payment QR Code"
                className="w-40 h-40 rounded-lg bg-white p-1"
              />
            </div>
          )}
          <div className="mt-6 flex gap-3 rounded-xl bg-white/8 p-4 text-xs leading-relaxed text-white/70">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--terracotta)]" />
            <strong>{instructions.instruction}</strong>
          </div>
        </div>
        <div className="p-5 md:p-8">
          {latestProof && (
            <div
              className={`mb-6 rounded-xl border p-4 text-sm ${
                latestProof.status === "Rejected"
                  ? "border-red-200 bg-red-50 text-red-950"
                  : latestProof.status === "More Information Requested"
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-emerald-200 bg-emerald-50 text-emerald-950"
              }`}
            >
              <strong>{latestProof.status}</strong>
              {latestProof.rejectionReason && (
                <p className="mt-1 text-xs leading-relaxed">{latestProof.rejectionReason}</p>
              )}
            </div>
          )}
          {canSubmit ? (
            <PaymentProofForm
              paymentId={instructions.paymentId}
              defaultName={customerName}
              defaultMobile={customerMobile}
              onSubmitted={onSubmitted}
            />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl bg-[var(--ivory)] p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-[var(--oxblood)]" />
              <h3 className="mt-4 font-display text-3xl">Proof submitted.</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                This payment remains pending until ArtDera verifies it. Please do not submit the
                same payment again.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PaymentProofForm({
  paymentId,
  defaultName,
  defaultMobile,
  onSubmitted,
}: {
  paymentId: string;
  defaultName: string;
  defaultMobile: string;
  onSubmitted: (proof: PaymentProof) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(next: File | undefined, input: HTMLInputElement) {
    setError("");
    if (!next) {
      setFile(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setError("Use a JPG, JPEG, PNG or WebP screenshot.");
      input.value = "";
      setFile(null);
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError("The screenshot must be 5 MB or smaller.");
      input.value = "";
      setFile(null);
      return;
    }
    setFile(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const upload = await UploadService.upload(file, "payment_proof");
    if (upload.error) {
      setError(upload.error.message);
      setSubmitting(false);
      return;
    }
    const result = await CheckoutService.submitProof(paymentId, {
      fullName: String(form.get("fullName") ?? ""),
      mobileNumber: String(form.get("mobileNumber") ?? ""),
      transactionId: String(form.get("transactionId") ?? ""),
      screenshotId: upload.data!.id,
      note: String(form.get("note") ?? "") || undefined,
    });
    if (result.error) {
      await UploadService.remove(upload.data!.publicId);
      setError(result.error.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSubmitted(result.data!.proof);
  }

  return (
    <form onSubmit={submit}>
      <div className="eyebrow">Payment proof</div>
      <h3 className="mt-2 font-display text-3xl">Submit your transfer details.</h3>
      {error && (
        <div className="mt-4">
          <CheckoutError message={error} />
        </div>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <CheckoutField label="Full name">
          <input
            required
            name="fullName"
            autoComplete="name"
            className="art-field"
            defaultValue={defaultName}
          />
        </CheckoutField>
        <CheckoutField label="Mobile used for payment">
          <input
            required
            name="mobileNumber"
            inputMode="tel"
            autoComplete="tel"
            className="art-field"
            defaultValue={defaultMobile}
          />
        </CheckoutField>
        <CheckoutField label="Transaction ID" wide>
          <input
            required
            name="transactionId"
            autoComplete="off"
            className="art-field"
            placeholder="Enter the wallet transaction ID"
          />
        </CheckoutField>
        <CheckoutField label="Payment screenshot" wide>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--ivory)] p-4 text-center">
            <ImageUp className="h-6 w-6 text-[var(--oxblood)]" />
            <span className="mt-2 text-sm font-semibold">
              {file ? file.name : "Choose payment screenshot"}
            </span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              JPG, JPEG, PNG or WebP · maximum 5 MB
            </span>
            <input
              required
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0], event.currentTarget)}
            />
          </label>
          {preview && (
            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-2">
              <img
                src={preview}
                alt="Payment screenshot preview"
                className="max-h-72 w-full rounded-lg object-contain"
              />
            </div>
          )}
        </CheckoutField>
        <CheckoutField label="Note (optional)" wide>
          <textarea
            name="note"
            className="art-field min-h-24 resize-y"
            placeholder="Add any information that may help ArtDera verify the transfer"
            maxLength={1000}
          />
        </CheckoutField>
      </div>
      <div className="mt-5 flex gap-3 rounded-xl bg-[var(--ivory)] p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Do not enter or upload your banking PIN, OTP or password.
      </div>
      <button
        disabled={!file || submitting}
        className="btn-primary mt-5 w-full disabled:opacity-45"
      >
        {submitting ? "Submitting securely…" : "Submit Payment Proof"}
      </button>
    </form>
  );
}

function PaymentDetail({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-4">
      <dt className="text-[10px] uppercase tracking-[.15em] text-white/40">{label}</dt>
      <dd className="mt-1 break-words text-base font-semibold">{value}</dd>
      {children}
    </div>
  );
}

function CopyButton({
  label,
  copied,
  onClick,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 px-3 text-[11px] font-semibold text-white/75"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <div
      className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
      role="alert"
    >
      {message}
    </div>
  );
}

function CheckoutSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-6">
      <h2 className="font-display text-3xl">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function CheckoutField({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
    </label>
  );
}
