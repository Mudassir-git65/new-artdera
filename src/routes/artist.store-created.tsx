import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Copy, Eye, ImagePlus, LayoutDashboard } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/marketplace/auth";
import { PLANS } from "@/marketplace/config";
import { StoreService, SubscriptionService } from "@/marketplace/services";
import { PageLoading } from "@/components/site/PageLoading";

export const Route = createFileRoute("/artist/store-created")({
  head: () => ({
    meta: [{ title: "Your ArtDera Store Is Ready" }, { name: "robots", content: "noindex" }],
  }),
  component: StoreCreated,
});

function StoreCreated() {
  const { user, ready, catalogReady } = useAuth();
  const flow = SubscriptionService.getFlow();
  const subscription = user ? SubscriptionService.getForUser(user.id) : undefined;
  const store = flow.storeId
    ? StoreService.list().find((item) => item.id === flow.storeId)
    : undefined;
  useEffect(() => {
    if (!ready || !catalogReady) return;
    if (!user) window.location.replace("/auth/login?redirect=/artist/store-created");
    else if (!["artist", "gallery"].includes(user.role)) window.location.replace("/account");
    else if (!flow.onboardingComplete || !store) window.location.replace("/artist/onboarding");
  }, [catalogReady, flow.onboardingComplete, ready, store, user]);
  if (!ready || !catalogReady || !user || !subscription || !store) return <Loading />;
  const plan = PLANS[subscription.planId];
  const storeUrl = `${window.location.origin}/store/${store.slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      toast.success("Store link copied");
    } catch {
      toast.error("Copy was blocked. Select the URL shown on screen instead.");
    }
  };
  return (
    <div className="container-editorial flex min-h-[75vh] items-center justify-center py-14">
      <div className="w-full max-w-3xl rounded-3xl bg-[var(--ink)] p-7 text-[var(--ivory)] shadow-[var(--shadow-lift)] md:p-11">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--terracotta)] text-[var(--ink)]">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="eyebrow mt-7 !text-white/50">Store created</div>
        <h1 className="mt-3 font-display text-5xl">Congratulations, {store.name} is ready.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
          Your artist account is signed in and your public store has been published. Identity and
          portfolio verification remain pending until an authorized admin completes review.
        </p>
        <dl className="mt-7 divide-y divide-white/10 rounded-2xl border border-white/12 px-5">
          {[
            ["Public store URL", `artdera.com/store/${store.slug}`],
            ["Subscription", plan.name],
            ["Listing limit", String(plan.listingLimit ?? "Fair-use unlimited")],
            ["Commission", `${plan.commission}%`],
            ["Verification", "Pending Review"],
            ["Store status", store.status],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 py-4 sm:grid-cols-[170px_1fr]">
              <dt className="text-xs text-white/45">{label}</dt>
              <dd className="break-all text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/artist/dashboard"
            className="btn-primary bg-[var(--terracotta)] !text-[var(--ink)]"
          >
            <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
          </a>
          <a href={`/store/${store.slug}`} className="btn-ghost !border-white/20 !text-white">
            <Eye className="h-4 w-4" /> View My Store
          </a>
          <a
            href="/artist/dashboard/artworks/new"
            className="btn-ghost !border-white/20 !text-white"
          >
            <ImagePlus className="h-4 w-4" /> Add Artwork
          </a>
          <button type="button" onClick={copy} className="btn-ghost !border-white/20 !text-white">
            <Copy className="h-4 w-4" /> Copy Store Link
          </button>
        </div>
        <a
          href="/artist/dashboard"
          className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white"
        >
          Open your plan-aware workspace <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function Loading() {
  return <PageLoading label="Opening your new ArtDera store" />;
}
