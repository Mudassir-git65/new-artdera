import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileText } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/marketplace/auth";
import { formatPKR, PLANS } from "@/marketplace/config";
import { InvoiceService, PaymentService, SubscriptionService } from "@/marketplace/services";
import { PageLoading } from "@/components/site/PageLoading";

export const Route = createFileRoute("/artist/payment-success")({
  head: () => ({
    meta: [{ title: "Payment Successful — ArtDera" }, { name: "robots", content: "noindex" }],
  }),
  component: PaymentSuccess,
});

function PaymentSuccess() {
  const { user, ready, catalogReady } = useAuth();
  const selection = SubscriptionService.getSelection();
  const subscription = user ? SubscriptionService.getForUser(user.id) : undefined;
  const payment = user ? PaymentService.listFor(user.id)[0] : undefined;
  const invoice = user ? InvoiceService.listFor(user.id)[0] : undefined;
  useEffect(() => {
    if (!ready || !catalogReady) return;
    if (!user) window.location.replace("/auth/login?redirect=/artist/payment-success");
    else if (!selection || selection.planId === "free" || !payment)
      window.location.replace("/artist/checkout");
  }, [catalogReady, payment, ready, selection, user]);
  if (!ready || !catalogReady || !user || !selection || !subscription || !payment)
    return <Loading />;
  const pending = payment.status === "Pending Review";
  return (
    <div className="container-editorial flex min-h-[75vh] items-center justify-center py-14">
      <div className="w-full max-w-2xl rounded-3xl bg-[var(--ink)] p-7 text-[var(--ivory)] shadow-[var(--shadow-lift)] md:p-11">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--terracotta)] text-[var(--ink)]">
          {pending ? <FileText className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
        </div>
        <div className="eyebrow mt-7 !text-white/50">
          {pending ? "Payment review" : "Payment successful"}
        </div>
        <h1 className="mt-3 font-display text-5xl">
          {pending
            ? "Your transfer is pending review."
            : `${PLANS[selection.planId].name} is active.`}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/65">
          {pending
            ? "Payment remains pending until it is confirmed by the configured provider."
            : "Your invoice and active subscription are stored in your account. Continue directly to build your store."}
        </p>
        <dl className="mt-7 divide-y divide-white/10 rounded-2xl border border-white/12 px-5">
          {[
            ["Selected plan", PLANS[selection.planId].name],
            ["Billing cycle", selection.billingCycle],
            ["Amount paid", formatPKR(selection.price)],
            ["Invoice", invoice?.id ?? payment.reference],
            ["Subscription status", subscription.status],
            [
              "Next billing date",
              subscription.renewsAt
                ? new Date(subscription.renewsAt).toLocaleDateString("en-PK")
                : "Not applicable",
            ],
            ["Commission", `${selection.commission}%`],
            ["Listing limit", String(selection.listingLimit ?? "Fair-use unlimited")],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 py-4 sm:grid-cols-[170px_1fr]">
              <dt className="text-xs text-white/45">{label}</dt>
              <dd className="break-words text-sm font-semibold capitalize">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-7 flex flex-wrap gap-3">
          {pending ? (
            <a
              href="/artist/checkout"
              className="btn-primary bg-[var(--terracotta)] !text-[var(--ink)]"
            >
              Return to Checkout
            </a>
          ) : (
            <a
              href="/artist/onboarding"
              className="btn-primary bg-[var(--terracotta)] !text-[var(--ink)]"
            >
              Continue to Create Your Store <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
function Loading() {
  return <PageLoading label="Confirming your subscription payment" />;
}
