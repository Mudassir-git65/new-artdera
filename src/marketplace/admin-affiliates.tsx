import {
  AlertTriangle,
  BadgeDollarSign,
  Check,
  Download,
  Handshake,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Search,
  Settings,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatPKR } from "./config";
import {
  AdminAffiliateService,
  type AdminAffiliateRecord,
  type AffiliateAdminAnalytics,
  type AffiliateCommissionRecord,
  type AffiliatePayoutRecord,
} from "./services";

type SettingsValue = Awaited<ReturnType<typeof AdminAffiliateService.settings>>["data"];

export function AdminAffiliateManagement() {
  const [affiliates, setAffiliates] = useState<AdminAffiliateRecord[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommissionRecord[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayoutRecord[]>([]);
  const [activity, setActivity] = useState<Array<Record<string, any>>>([]);
  const [analytics, setAnalytics] = useState<AffiliateAdminAnalytics | null>(null);
  const [settings, setSettings] = useState<SettingsValue>();
  const [tab, setTab] = useState<
    "affiliates" | "commissions" | "payouts" | "activity" | "settings"
  >("affiliates");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [
      affiliateResult,
      commissionResult,
      payoutResult,
      activityResult,
      settingsResult,
      analyticsResult,
    ] = await Promise.all([
      AdminAffiliateService.affiliates(1, query, status),
      AdminAffiliateService.commissions(),
      AdminAffiliateService.payouts(),
      AdminAffiliateService.activity(),
      AdminAffiliateService.settings(),
      AdminAffiliateService.analytics(),
    ]);
    if (affiliateResult.data) setAffiliates(affiliateResult.data.items);
    if (commissionResult.data) setCommissions(commissionResult.data);
    if (payoutResult.data) setPayouts(payoutResult.data);
    if (activityResult.data) setActivity(activityResult.data);
    if (settingsResult.data) setSettings(settingsResult.data);
    if (analyticsResult.data) setAnalytics(analyticsResult.data);
    const firstError = [
      affiliateResult,
      commissionResult,
      payoutResult,
      activityResult,
      settingsResult,
      analyticsResult,
    ].find((result) => result.error)?.error;
    setError(firstError?.message ?? "");
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // Filters are submitted deliberately so typing never floods the admin API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function affiliateAction(id: string, action: "approve" | "reject" | "enable" | "disable") {
    const reason =
      action === "reject" ? window.prompt("Reason for rejection") || undefined : undefined;
    if (action === "reject" && !reason) return;
    setWorking(id);
    const result = await AdminAffiliateService.updateAffiliate(id, { action, reason });
    if (result.error) setError(result.error.message);
    else {
      toast.success(`Ambassador ${action}d`);
      await load();
    }
    setWorking("");
  }

  async function updateAffiliate(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(id);
    const result = await AdminAffiliateService.updateAffiliate(id, {
      action: "update",
      code: String(form.get("code") ?? ""),
      commissionRate: Number(form.get("commissionRate")),
      buyerDiscountRate: Number(form.get("buyerDiscountRate")),
    });
    if (result.error) setError(result.error.message);
    else {
      toast.success("Ambassador terms updated");
      await load();
    }
    setWorking("");
  }

  async function commissionAction(id: string, action: "approve" | "reject") {
    const reason =
      action === "reject" ? window.prompt("Reason for rejection") || undefined : undefined;
    if (action === "reject" && !reason) return;
    setWorking(id);
    const result = await AdminAffiliateService.updateCommission(id, action, reason);
    if (result.error) setError(result.error.message);
    else {
      toast.success(`Commission ${action}d`);
      await load();
    }
    setWorking("");
  }

  async function payoutAction(
    payout: AffiliatePayoutRecord,
    action: "approve" | "process" | "mark_paid" | "reject",
  ) {
    const transactionReference =
      action === "mark_paid" ? window.prompt("Transaction reference") || undefined : undefined;
    const reason =
      action === "reject" ? window.prompt("Reason for rejection") || undefined : undefined;
    if ((action === "mark_paid" && !transactionReference) || (action === "reject" && !reason))
      return;
    setWorking(payout.id);
    const result = await AdminAffiliateService.updatePayout(payout.id, action, {
      transactionReference,
      reason,
    });
    if (result.error) setError(result.error.message);
    else {
      toast.success("Payout updated");
      await load();
    }
    setWorking("");
  }

  const metrics = useMemo(
    () => ({
      affiliates: affiliates.length,
      pendingApplications: affiliates.filter((item) => item.status === "pending").length,
      clicks: affiliates.reduce((sum, item) => sum + item.metrics.clicks, 0),
      sales: affiliates.reduce((sum, item) => sum + item.metrics.generatedSales, 0),
      unpaid: commissions
        .filter((item) => ["pending", "approved"].includes(item.status))
        .reduce((sum, item) => sum + item.commissionAmount, 0),
      payoutRequests: payouts.filter((item) =>
        ["requested", "approved", "processing"].includes(item.status),
      ).length,
    }),
    [affiliates, commissions, payouts],
  );

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {error}
        </div>
      )}
      <section className="rounded-2xl bg-[var(--indigo)] p-6 text-[var(--ivory)] md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="eyebrow !text-white/45">Affiliate operations</div>
            <h2 className="mt-3 font-display text-4xl">Ambassador management</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
              Applications, protected attribution, commission eligibility and manual payouts are
              managed from one audited workspace.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/admin/affiliate/export.csv"
              className="btn-ghost !border-white/20 !text-white"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-ghost !border-white/20 !text-white"
              aria-label="Refresh affiliate data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {(
          [
            ["Affiliates", metrics.affiliates, Users],
            ["Pending applications", metrics.pendingApplications, Handshake],
            ["Referral clicks", metrics.clicks, MousePointerClick],
            ["Generated sales", formatPKR(metrics.sales), BadgeDollarSign],
            ["Unpaid commissions", formatPKR(metrics.unpaid), WalletCards],
            ["Payout requests", metrics.payoutRequests, AlertTriangle],
          ] as const
        ).map(([label, value, Icon]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4"
          >
            <Icon className="h-4 w-4 text-[var(--oxblood)]" />
            <div className="mt-3 font-display text-2xl">{String(value)}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{String(label)}</div>
          </div>
        ))}
      </section>

      {analytics && (analytics.topAffiliates.length > 0 || analytics.topArtworks.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5">
            <div className="eyebrow">Top affiliates</div>
            <div className="mt-4 divide-y divide-[var(--color-border)]">
              {analytics.topAffiliates.slice(0, 5).map((affiliate, index) => (
                <div
                  key={affiliate.affiliateId}
                  className="flex items-center justify-between gap-4 py-3 text-xs"
                >
                  <div>
                    <span className="mr-3 text-muted-foreground">#{index + 1}</span>
                    <strong>{affiliate.code}</strong>
                  </div>
                  <div className="text-right">
                    <div>{formatPKR(affiliate.revenue)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {affiliate.orders} orders
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5">
            <div className="eyebrow">Top converting artworks</div>
            <div className="mt-4 divide-y divide-[var(--color-border)]">
              {analytics.topArtworks.slice(0, 5).map((artwork, index) => (
                <div
                  key={artwork.artworkId}
                  className="flex items-center justify-between gap-4 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <span className="mr-3 text-muted-foreground">#{index + 1}</span>
                    <strong className="truncate">{artwork.title}</strong>
                  </div>
                  <div className="shrink-0 text-right">
                    <div>{artwork.orders} conversions</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatPKR(artwork.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <nav
        className="no-scrollbar flex gap-2 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-2"
        aria-label="Affiliate management sections"
      >
        {[
          ["affiliates", "Affiliates"],
          ["commissions", "Commissions"],
          ["payouts", "Payouts"],
          ["activity", "Suspicious Activity"],
          ["settings", "Global Settings"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => setTab(value as typeof tab)}
            className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold ${tab === value ? "bg-[var(--ink)] text-white" : "hover:bg-[var(--ivory)]"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] text-sm text-muted-foreground">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading affiliate operations…
        </div>
      ) : tab === "affiliates" ? (
        <AffiliateList
          affiliates={affiliates}
          query={query}
          status={status}
          working={working}
          onQuery={setQuery}
          onStatus={setStatus}
          onSearch={() => void load()}
          onAction={affiliateAction}
          onUpdate={updateAffiliate}
        />
      ) : tab === "commissions" ? (
        <CommissionList commissions={commissions} working={working} onAction={commissionAction} />
      ) : tab === "payouts" ? (
        <PayoutList payouts={payouts} working={working} onAction={payoutAction} />
      ) : tab === "activity" ? (
        <ActivityList activity={activity} />
      ) : settings ? (
        <AffiliateSettings settings={settings} onSaved={load} />
      ) : null}
    </div>
  );
}

function AffiliateList({
  affiliates,
  query,
  status,
  working,
  onQuery,
  onStatus,
  onSearch,
  onAction,
  onUpdate,
}: {
  affiliates: AdminAffiliateRecord[];
  query: string;
  status: string;
  working: string;
  onQuery: (value: string) => void;
  onStatus: (value: string) => void;
  onSearch: () => void;
  onAction: (id: string, action: "approve" | "reject" | "enable" | "disable") => void;
  onUpdate: (event: FormEvent<HTMLFormElement>, id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            className="art-field pl-10"
            placeholder="Search name, email or code"
          />
        </div>
        <select
          value={status}
          onChange={(event) => onStatus(event.target.value)}
          className="art-field lg:w-48"
          aria-label="Filter affiliate status"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="disabled">Disabled</option>
          <option value="rejected">Rejected</option>
        </select>
        <button type="button" onClick={onSearch} className="btn-primary">
          Search
        </button>
      </div>
      <div className="mt-5 space-y-4">
        {affiliates.map((affiliate) => (
          <form
            key={affiliate.id}
            onSubmit={(event) => onUpdate(event, affiliate.id)}
            className="rounded-xl border border-[var(--color-border)] p-4 md:p-5"
          >
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
              <div className="min-w-52">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{affiliate.user?.fullName ?? "Unknown user"}</strong>
                  <Status status={affiliate.status} />
                  {affiliate.suspiciousActivityCount > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-800">
                      {affiliate.suspiciousActivityCount} flags
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{affiliate.user?.email}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                  <span>{affiliate.metrics.clicks} clicks</span>
                  <span>{affiliate.metrics.orders} orders</span>
                  <span>{formatPKR(affiliate.metrics.generatedSales)} sales</span>
                </div>
              </div>
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Code
                  <input
                    name="code"
                    defaultValue={affiliate.code}
                    className="art-field mt-1 uppercase"
                    pattern="[A-Za-z0-9]{5,20}"
                  />
                </label>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Commission %
                  <input
                    name="commissionRate"
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    defaultValue={affiliate.commissionRate}
                    className="art-field mt-1"
                  />
                </label>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Buyer discount %
                  <input
                    name="buyerDiscountRate"
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    defaultValue={affiliate.buyerDiscountRate}
                    className="art-field mt-1"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={working === affiliate.id} className="btn-ghost px-4">
                  Save
                </button>
                {affiliate.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onAction(affiliate.id, "approve")}
                      className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
                    >
                      <Check className="mr-1 inline h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction(affiliate.id, "reject")}
                      className="rounded-full bg-red-700 px-4 py-2 text-xs font-semibold text-white"
                    >
                      <X className="mr-1 inline h-3.5 w-3.5" />
                      Reject
                    </button>
                  </>
                )}
                {affiliate.status === "approved" ? (
                  <button
                    type="button"
                    onClick={() => onAction(affiliate.id, "disable")}
                    className="btn-ghost px-4"
                  >
                    Disable
                  </button>
                ) : affiliate.status !== "pending" ? (
                  <button
                    type="button"
                    onClick={() => onAction(affiliate.id, "enable")}
                    className="btn-ghost px-4"
                  >
                    Enable
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        ))}
        {!affiliates.length && (
          <p className="rounded-xl bg-[var(--ivory)] p-5 text-sm text-muted-foreground">
            No affiliates match these filters.
          </p>
        )}
      </div>
    </section>
  );
}

function CommissionList({
  commissions,
  working,
  onAction,
}: {
  commissions: AffiliateCommissionRecord[];
  working: string;
  onAction: (id: string, action: "approve" | "reject") => void;
}) {
  return (
    <AdminTable
      headings={[
        "Affiliate",
        "Order",
        "Artwork",
        "Eligible sale",
        "Commission",
        "Status",
        "Actions",
      ]}
    >
      {commissions.map((commission) => (
        <tr key={commission.id} className="border-b border-[var(--color-border)] last:border-0">
          <td className="px-3 py-4 font-semibold">{commission.affiliateCode ?? "—"}</td>
          <td className="px-3 py-4">{commission.orderReference}</td>
          <td className="max-w-56 truncate px-3 py-4">{commission.artwork}</td>
          <td className="px-3 py-4">{formatPKR(commission.eligibleSaleAmount)}</td>
          <td className="px-3 py-4 font-semibold">{formatPKR(commission.commissionAmount)}</td>
          <td className="px-3 py-4">
            <Status status={commission.status} />
          </td>
          <td className="px-3 py-4">
            {commission.status !== "paid" && (
              <div className="flex gap-2">
                <button
                  disabled={working === commission.id}
                  onClick={() => onAction(commission.id, "approve")}
                  className="text-xs font-semibold text-emerald-700"
                >
                  Approve
                </button>
                <button
                  disabled={working === commission.id}
                  onClick={() => onAction(commission.id, "reject")}
                  className="text-xs font-semibold text-red-700"
                >
                  Reject
                </button>
              </div>
            )}
          </td>
        </tr>
      ))}
    </AdminTable>
  );
}

function PayoutList({
  payouts,
  working,
  onAction,
}: {
  payouts: AffiliatePayoutRecord[];
  working: string;
  onAction: (
    payout: AffiliatePayoutRecord,
    action: "approve" | "process" | "mark_paid" | "reject",
  ) => void;
}) {
  return (
    <AdminTable
      headings={["Affiliate", "Requested", "Amount", "Method", "Reference", "Status", "Actions"]}
    >
      {payouts.map((payout) => (
        <tr key={payout.id} className="border-b border-[var(--color-border)] last:border-0">
          <td className="px-3 py-4 font-semibold">{payout.affiliateCode ?? "—"}</td>
          <td className="px-3 py-4">{dateLabel(payout.requestedAt)}</td>
          <td className="px-3 py-4 font-semibold">{formatPKR(payout.amount)}</td>
          <td className="px-3 py-4">{payout.payoutMethod}</td>
          <td className="px-3 py-4">{payout.transactionReference ?? "—"}</td>
          <td className="px-3 py-4">
            <Status status={payout.status} />
          </td>
          <td className="px-3 py-4">
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              {payout.status === "requested" && (
                <button
                  disabled={working === payout.id}
                  onClick={() => onAction(payout, "approve")}
                  className="text-emerald-700"
                >
                  Approve
                </button>
              )}
              {payout.status === "approved" && (
                <button
                  disabled={working === payout.id}
                  onClick={() => onAction(payout, "process")}
                  className="text-amber-700"
                >
                  Processing
                </button>
              )}
              {["approved", "processing"].includes(payout.status) && (
                <button
                  disabled={working === payout.id}
                  onClick={() => onAction(payout, "mark_paid")}
                  className="text-emerald-700"
                >
                  Mark paid
                </button>
              )}
              {["requested", "approved", "processing"].includes(payout.status) && (
                <button
                  disabled={working === payout.id}
                  onClick={() => onAction(payout, "reject")}
                  className="text-red-700"
                >
                  Reject
                </button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </AdminTable>
  );
}

function ActivityList({ activity }: { activity: Array<Record<string, any>> }) {
  return (
    <AdminTable headings={["Affiliate", "Type", "Severity", "Details", "Detected"]}>
      {activity.map((item) => (
        <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
          <td className="px-3 py-4 font-semibold">{item.affiliateCode ?? "—"}</td>
          <td className="px-3 py-4 capitalize">{String(item.type).replaceAll("_", " ")}</td>
          <td className="px-3 py-4">
            <Status status={String(item.severity)} />
          </td>
          <td className="max-w-72 truncate px-3 py-4 text-muted-foreground">
            {Object.entries(item.metadata ?? {})
              .map(([key, value]) => `${key}: ${String(value)}`)
              .join(" · ") || "Protected server-side signal"}
          </td>
          <td className="px-3 py-4">{dateLabel(item.createdAt)}</td>
        </tr>
      ))}
    </AdminTable>
  );
}

function AffiliateSettings({
  settings,
  onSaved,
}: {
  settings: NonNullable<SettingsValue>;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const result = await AdminAffiliateService.updateSettings({
      enabled: form.get("enabled") === "on",
      defaultCommissionRate: Number(form.get("defaultCommissionRate")),
      defaultBuyerDiscountRate: Number(form.get("defaultBuyerDiscountRate")),
      attributionDays: Number(form.get("attributionDays")),
      minimumPayoutUsd: Number(form.get("minimumPayoutUsd")),
      usdToPkrRate: Number(form.get("usdToPkrRate")),
      autoApproveApplications: form.get("autoApproveApplications") === "on",
      allowDiscountStacking: form.get("allowDiscountStacking") === "on",
    });
    if (result.error) toast.error(result.error.message);
    else {
      toast.success("Affiliate settings saved");
      await onSaved();
    }
    setSaving(false);
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-8"
    >
      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-[var(--oxblood)]" />
        <h3 className="font-display text-3xl">Global affiliate settings</h3>
      </div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <NumberSetting
          name="defaultCommissionRate"
          label="Default commission %"
          value={settings.defaultCommissionRate}
          min={0}
          max={20}
          step={0.1}
        />
        <NumberSetting
          name="defaultBuyerDiscountRate"
          label="Default buyer discount %"
          value={settings.defaultBuyerDiscountRate}
          min={0}
          max={20}
          step={0.1}
        />
        <NumberSetting
          name="attributionDays"
          label="Referral cookie days"
          value={settings.attributionDays}
          min={1}
          max={365}
        />
        <NumberSetting
          name="minimumPayoutUsd"
          label="Minimum payout (USD equivalent)"
          value={settings.minimumPayoutUsd}
          min={1}
          max={10000}
        />
        <NumberSetting
          name="usdToPkrRate"
          label="Administrative USD → PKR rate"
          value={settings.usdToPkrRate}
          min={1}
          max={10000}
          step={0.01}
        />
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Toggle
          name="enabled"
          label="Affiliate program enabled"
          defaultChecked={settings.enabled}
        />
        <Toggle
          name="autoApproveApplications"
          label="Auto-approve applications"
          defaultChecked={settings.autoApproveApplications}
        />
        <Toggle
          name="allowDiscountStacking"
          label="Allow discount stacking"
          defaultChecked={settings.allowDiscountStacking}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Affiliate discounts do not stack with a separate promotional code unless this setting is
        enabled. Server pricing never trusts this form alone.
      </p>
      <button disabled={saving} className="btn-primary mt-7 disabled:opacity-45">
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </form>
  );
}

function AdminTable({ headings, children }: { headings: string[]; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="border-b border-[var(--color-border)] bg-[var(--ivory)]">
            <tr>
              {headings.map((heading) => (
                <th key={heading} className="px-3 py-3 font-medium text-muted-foreground">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function NumberSetting({
  name,
  label,
  value,
  min,
  max,
  step = 1,
}: {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <input
        name={name}
        type="number"
        required
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        className="art-field mt-2"
      />
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-4 text-sm font-semibold">
      <span>{label}</span>
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-[var(--oxblood)]"
      />
    </label>
  );
}

function Status({ status }: { status: string }) {
  const tone = ["approved", "paid", "low"].includes(status)
    ? "bg-emerald-100 text-emerald-800"
    : ["pending", "requested", "processing", "medium"].includes(status)
      ? "bg-amber-100 text-amber-900"
      : "bg-red-100 text-red-800";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${tone}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
