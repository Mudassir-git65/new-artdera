import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { PLANS } from "@/marketplace/config";
import { FeatureAccessService } from "@/marketplace/services";
import type { PlanId } from "@/marketplace/types";

export function PlanFeatureGate({
  requiredPlan,
  currentPlan,
  featureName,
  upgradeDescription,
  upgradeTarget,
  module,
  forceLocked = false,
  children,
}: {
  requiredPlan: PlanId;
  currentPlan: PlanId;
  featureName: string;
  upgradeDescription: string;
  upgradeTarget: PlanId;
  module: string;
  forceLocked?: boolean;
  children: ReactNode;
}) {
  if (!forceLocked && FeatureAccessService.canAccess(currentPlan, module)) return <>{children}</>;
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ivory)] text-[var(--oxblood)]">
        <LockKeyhole className="h-5 w-5" />
      </div>
      <div className="eyebrow mt-6">{PLANS[requiredPlan].name} feature</div>
      <h2 className="mt-3 font-display text-4xl">{featureName}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {upgradeDescription}
      </p>
      <a
        href={`/artist/dashboard/subscription?upgrade=${upgradeTarget}`}
        className="btn-primary mt-6"
      >
        Explore {PLANS[upgradeTarget].name}
      </a>
    </section>
  );
}
