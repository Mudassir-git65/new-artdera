import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useAuth } from "@/marketplace/auth";
import { PLANS } from "@/marketplace/config";
import { SubscriptionService } from "@/marketplace/services";
import { PageLoading } from "@/components/site/PageLoading";

export const Route = createFileRoute("/artist/payment-failed")({
  head: () => ({
    meta: [
      { title: "Payment Could Not Be Completed — ArtDera" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentFailed,
});

function PaymentFailed() {
  const { user, ready } = useAuth();
  const selection = SubscriptionService.getSelection();
  if (!ready) return <PageLoading label="Checking your payment result" />;
  if (!user)
    return (
      <div className="container-editorial flex min-h-[70vh] items-center justify-center py-14">
        <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-[var(--oxblood)]" />
          <h1 className="mt-5 font-display text-4xl">Sign in to continue.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your selected plan is saved. Sign in to safely retry the payment.
          </p>
          <Link
            to="/auth/login"
            search={{ redirect: "/artist/payment-failed" }}
            className="btn-primary mt-6"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  return (
    <div className="container-editorial flex min-h-[70vh] items-center justify-center py-14">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-[var(--porcelain)] p-7 text-center shadow-[var(--shadow-soft)] md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-700">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="eyebrow mt-7">Payment failed</div>
        <h1 className="mt-3 font-display text-4xl">Payment could not be completed.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          You were not charged. Your {selection ? PLANS[selection.planId].name : "selected"} plan
          and account details are still saved.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href="/artist/checkout" className="btn-primary">
            <RotateCcw className="h-4 w-4" /> Try Again
          </a>
          <Link to="/sell/plans" className="btn-ghost">
            Change Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
