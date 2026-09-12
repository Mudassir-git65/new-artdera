import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, LoaderCircle, Smartphone, WalletCards } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/marketplace/auth";
import { formatPKR, PLANS } from "@/marketplace/config";
import { PaymentService, SubscriptionService } from "@/marketplace/services";
import type { PaymentMethod } from "@/marketplace/types";
import { PageLoading } from "@/components/site/PageLoading";

export const Route = createFileRoute("/artist/checkout")({
  head: () => ({
    meta: [
      { title: "Artist Subscription Checkout — ArtDera" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArtistCheckout,
});

const methods: Array<[PaymentMethod, string, typeof Smartphone]> = [
  ["easypaisa", "Easypaisa", Smartphone],
  ["jazzcash", "JazzCash", WalletCards],
];

function ArtistCheckout() {
  const { user, ready, catalogReady } = useAuth();
  const selection = SubscriptionService.getSelection();
  const [method, setMethod] = useState<PaymentMethod>("jazzcash");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const plan = selection ? PLANS[selection.planId] : undefined;

  useEffect(() => {
    if (!ready || !catalogReady) return;
    if (!user) window.location.replace("/auth/login?redirect=/artist/checkout");
    else if (!["artist", "gallery"].includes(user.role)) window.location.replace("/account");
    else if (!selection) window.location.replace("/sell/plans");
    else if (selection.planId === "free")
      window.location.replace("/artist/onboarding?activated=free");
  }, [catalogReady, ready, selection, user]);

  async function pay(event: FormEvent) {
    event.preventDefault();
    if (!user || !selection) return;
    setProcessing(true);
    setError("");
    const result = await PaymentService.process({ userId: user.id, method });
    setProcessing(false);
    if (result.error) return setError(result.error.message);
    if (result.data?.status === "Succeeded") window.location.assign("/artist/payment-success");
    else if (result.data?.status === "Failed") window.location.assign("/artist/payment-failed");
    else if (result.data) window.location.assign(`/payment/${encodeURIComponent(result.data.id)}`);
  }

  if (!ready || !catalogReady || !user || !selection || !plan || selection.planId === "free")
    return <PageLoading label="Preparing your plan checkout" />;

  return (
    <div className="container-editorial py-10 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow">Artist subscription</div>
            <h1 className="mt-2 font-display text-5xl">Complete secure checkout.</h1>
          </div>
          <Link to="/sell/plans" className="btn-ghost">
            Change Plan
          </Link>
        </div>
        <div className="grid gap-7 lg:grid-cols-[1.28fr_0.72fr]">
          <form
            onSubmit={pay}
            className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 sm:p-6 md:p-8"
          >
            <div className="eyebrow">Payment method</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {methods.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMethod(id);
                    setError("");
                  }}
                  className={`flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border px-2 text-center text-xs font-semibold ${method === id ? "border-[var(--oxblood)] bg-[var(--ivory)] ring-1 ring-[var(--oxblood)]" : "border-[var(--color-border)]"}`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-7 rounded-xl bg-[var(--ivory)] p-5 text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">
                Pay directly to ArtDera's receiving account.
              </strong>
              <p className="mt-2">
                The next screen shows the exact amount and account details. Upload the transfer
                screenshot and transaction ID; an administrator must verify it before the plan is
                activated. Never share a wallet PIN, OTP or password.
              </p>
            </div>
            {error && (
              <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}
            <button
              disabled={processing}
              className="btn-primary mt-6 min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-45"
            >
              {processing ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Creating secure payment…
                </>
              ) : (
                "View Payment Instructions"
              )}
            </button>
          </form>
          <aside className="h-fit rounded-2xl bg-[var(--ink)] p-6 text-[var(--ivory)] lg:sticky lg:top-28">
            <div className="eyebrow !text-white/50">Order summary</div>
            <h2 className="mt-3 font-display text-4xl">{plan.name}</h2>
            <p className="mt-1 text-xs capitalize text-white/55">
              {selection.billingCycle} billing
            </p>
            <div className="mt-6 font-display text-4xl">{formatPKR(selection.price)}</div>
            <dl className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10 px-4 text-sm">
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-white/55">Plan price</dt>
                <dd>{formatPKR(selection.price)}</dd>
              </div>
              <div className="flex justify-between gap-3 py-4 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatPKR(selection.price)}</dd>
              </div>
            </dl>
            <div className="mt-5 grid gap-2 text-xs text-white/65">
              <div className="flex justify-between">
                <span>Commission</span>
                <strong>{selection.commission}%</strong>
              </div>
              <div className="flex justify-between">
                <span>Listing limit</span>
                <strong>{selection.listingLimit ?? "Fair-use unlimited"}</strong>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {plan.features.slice(0, 5).map((feature) => (
                <li key={feature} className="flex gap-2 text-sm text-white/72">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--terracotta)]" />
                  {feature}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
