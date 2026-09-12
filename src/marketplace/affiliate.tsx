import {
  BadgeDollarSign,
  Check,
  Copy,
  ExternalLink,
  Handshake,
  Loader2,
  MousePointerClick,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatPKR } from "./config";
import {
  AffiliateService,
  type AffiliateCommissionRecord,
  type AffiliateDashboardData,
} from "./services";

export function AffiliateDashboard() {
  const [data, setData] = useState<AffiliateDashboardData | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function load() {
    const result = await AffiliateService.dashboard();
    if (result.data) {
      setData(result.data);
      setError("");
    } else setError(result.error?.message ?? "Your ambassador dashboard could not be loaded.");
  }

  useEffect(() => {
    void load();
  }, []);

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    const form = new FormData(event.currentTarget);
    const requestedCode = String(form.get("requestedCode") ?? "").trim();
    const result = await AffiliateService.apply(requestedCode || undefined);
    if (result.error) setError(result.error.message);
    else {
      toast.success("Ambassador application submitted");
      await load();
    }
    setWorking(false);
  }

  async function changeCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    setWorking(true);
    const result = await AffiliateService.changeCode(code);
    if (result.error) setError(result.error.message);
    else {
      toast.success("Ambassador code updated");
      await load();
    }
    setWorking(false);
  }

  async function requestPayout() {
    if (working) return;
    setWorking(true);
    const result = await AffiliateService.requestPayout();
    if (result.error) setError(result.error.message);
    else {
      toast.success("Payout request sent for manual approval");
      await load();
    }
    setWorking(false);
  }

  async function copy(value: string, key: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error("Copy was blocked by your browser");
    }
  }

  const filteredCommissions = useMemo(
    () =>
      data?.commissions.filter(
        (commission) => statusFilter === "all" || commission.status === statusFilter,
      ) ?? [],
    [data?.commissions, statusFilter],
  );

  if (!data)
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)]">
        <div className="text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
          Loading ambassador program…
        </div>
      </div>
    );

  if (!data.affiliate)
    return (
      <div className="space-y-6">
        {error && <AffiliateAlert message={error} />}
        <section className="overflow-hidden rounded-2xl bg-[var(--indigo)] p-7 text-[var(--ivory)] md:p-10">
          <Handshake className="h-9 w-9 text-[var(--terracotta)]" />
          <div className="eyebrow mt-6 !text-white/45">ArtDera Ambassador Program</div>
          <h2 className="mt-3 max-w-2xl font-display text-4xl md:text-5xl">
            Share Art You Love. Earn When It Sells.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/68">
            Receive a personal referral link and code. Collectors receive{" "}
            {data.settings.defaultBuyerDiscountRate}% off eligible artwork, and you earn{" "}
            {data.settings.defaultCommissionRate}% from the eligible sale amount.
          </p>
        </section>
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-8">
          <h3 className="font-display text-3xl">Join the program</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Applications are intentionally simple. Choose an optional readable code, or let ArtDera
            generate one for you.
          </p>
          <form onSubmit={apply} className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input
              name="requestedCode"
              className="art-field uppercase"
              maxLength={20}
              pattern="[A-Za-z0-9]{5,20}"
              placeholder="Preferred code (optional)"
              aria-label="Preferred ambassador code"
            />
            <button
              disabled={working || !data.settings.enabled}
              className="btn-primary shrink-0 disabled:opacity-45"
            >
              {working
                ? "Submitting…"
                : data.settings.enabled
                  ? "Join the Program"
                  : "Program Paused"}
            </button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Referral attribution lasts {data.settings.attributionDays} days. Self-referrals are not
            eligible.
          </p>
        </section>
      </div>
    );

  const affiliate = data.affiliate;
  const approved = affiliate.status === "approved";
  return (
    <div className="space-y-6">
      {error && <AffiliateAlert message={error} />}
      <section className="overflow-hidden rounded-2xl bg-[var(--indigo)] p-6 text-[var(--ivory)] md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="eyebrow !text-white/45">ArtDera Ambassador</div>
              <StatusPill status={affiliate.status} dark />
            </div>
            <h2 className="mt-3 font-display text-4xl">Your art-sharing workspace.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
              {approved
                ? `Collectors receive ${affiliate.buyerDiscountRate}% off eligible artwork, and your commission is ${affiliate.commissionRate}% of the final eligible artwork price.`
                : affiliate.status === "pending"
                  ? "Your application is being reviewed. Your sharing tools will activate after approval."
                  : affiliate.rejectionReason || "Your ambassador account is not currently active."}
            </p>
          </div>
          <div className="min-w-64 rounded-2xl bg-white/8 p-5">
            <div className="text-[10px] uppercase tracking-[.16em] text-white/45">
              Available balance
            </div>
            <div className="mt-2 font-display text-4xl">
              {formatPKR(data.metrics.availableBalance)}
            </div>
            <button
              type="button"
              onClick={() => void requestPayout()}
              disabled={
                working ||
                !approved ||
                data.metrics.availableBalance < data.settings.minimumPayoutPkr
              }
              className="mt-4 w-full rounded-full bg-[var(--terracotta)] px-4 py-2.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-45"
            >
              Request payout
            </button>
            <p className="mt-2 text-[10px] leading-relaxed text-white/45">
              Minimum ${data.settings.minimumPayoutUsd} USD equivalent (
              {formatPKR(data.settings.minimumPayoutPkr)} at the admin-set payout rate).
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Referral clicks", data.metrics.totalClicks, MousePointerClick],
            ["Successful orders", data.metrics.successfulOrders, ReceiptText],
            ["Conversion rate", `${data.metrics.conversionRate}%`, TrendingUp],
            ["Total earnings", formatPKR(data.metrics.totalEarnings), BadgeDollarSign],
            ["Pending commissions", formatPKR(data.metrics.pendingCommissions), WalletCards],
            ["Approved commissions", formatPKR(data.metrics.approvedCommissions), Check],
            ["Paid commissions", formatPKR(data.metrics.paidCommissions), BadgeDollarSign],
            ["Generated revenue", formatPKR(data.metrics.generatedRevenue), TrendingUp],
          ] as const
        ).map(([label, value, Icon]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5"
          >
            <Icon className="h-4 w-4 text-[var(--oxblood)]" />
            <div className="mt-4 font-display text-3xl">{String(value)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{String(label)}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="eyebrow">Referral code</div>
            <div className="mt-3 flex gap-2">
              <code className="flex min-h-11 flex-1 items-center rounded-xl bg-[var(--ivory)] px-4 text-sm font-semibold tracking-[.12em]">
                {affiliate.code}
              </code>
              <button
                type="button"
                onClick={() => void copy(affiliate.code, "code")}
                aria-label="Copy ambassador code"
                className="btn-ghost px-4"
              >
                {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <form onSubmit={changeCode} className="mt-3 flex gap-2">
              <input
                name="code"
                className="art-field uppercase"
                defaultValue={affiliate.code}
                pattern="[A-Za-z0-9]{5,20}"
                maxLength={20}
                aria-label="Customize ambassador code"
              />
              <button disabled={working} className="btn-ghost shrink-0 px-4 disabled:opacity-45">
                Update
              </button>
            </form>
          </div>
          <div>
            <div className="eyebrow">Referral link</div>
            <div className="mt-3 flex gap-2">
              <input className="art-field min-w-0 flex-1" readOnly value={affiliate.referralLink} />
              <button
                type="button"
                onClick={() => void copy(affiliate.referralLink, "link")}
                aria-label="Copy ambassador link"
                className="btn-ghost px-4"
              >
                {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <a
                href={affiliate.referralLink}
                target="_blank"
                rel="noreferrer"
                aria-label="Open ambassador link"
                className="btn-ghost px-4"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              The first valid referral is protected for {data.settings.attributionDays} days.
            </p>
          </div>
        </div>
      </section>

      <AffiliateTable title="Recent referred orders" records={data.recentOrders} />

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="eyebrow">Commission history</div>
            <h3 className="mt-2 font-display text-3xl">Every attributed sale</h3>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="art-field w-full sm:w-44"
            aria-label="Filter commissions"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <CommissionRows records={filteredCommissions} />
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-6">
        <div className="eyebrow">Payout history</div>
        <h3 className="mt-2 font-display text-3xl">Manual payout requests</h3>
        {data.payouts.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="border-b border-[var(--color-border)] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Requested</th>
                  <th className="px-3 py-3 font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Method</th>
                  <th className="px-3 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="px-3 py-4">{dateLabel(payout.requestedAt)}</td>
                    <td className="px-3 py-4 font-semibold">{formatPKR(payout.amount)}</td>
                    <td className="px-3 py-4">{payout.payoutMethod}</td>
                    <td className="px-3 py-4">{payout.transactionReference ?? "—"}</td>
                    <td className="px-3 py-4">
                      <StatusPill status={payout.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-[var(--ivory)] p-5 text-sm text-muted-foreground">
            No payout requests yet.
          </p>
        )}
      </section>
    </div>
  );
}

function AffiliateTable({
  title,
  records,
}: {
  title: string;
  records: AffiliateCommissionRecord[];
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-6">
      <div className="eyebrow">{title}</div>
      <CommissionRows records={records} />
    </section>
  );
}

function CommissionRows({ records }: { records: AffiliateCommissionRecord[] }) {
  if (!records.length)
    return (
      <p className="mt-5 rounded-xl bg-[var(--ivory)] p-5 text-sm text-muted-foreground">
        No matching referred orders.
      </p>
    );
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="border-b border-[var(--color-border)] text-muted-foreground">
          <tr>
            <th className="px-3 py-3 font-medium">Reference</th>
            <th className="px-3 py-3 font-medium">Date</th>
            <th className="px-3 py-3 font-medium">Artwork</th>
            <th className="px-3 py-3 font-medium">Eligible sale</th>
            <th className="px-3 py-3 font-medium">Commission</th>
            <th className="px-3 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {records.map((record) => (
            <tr key={record.id}>
              <td className="px-3 py-4 font-semibold">{record.orderReference}</td>
              <td className="px-3 py-4">{dateLabel(record.createdAt)}</td>
              <td className="max-w-64 truncate px-3 py-4">{record.artwork}</td>
              <td className="px-3 py-4">{formatPKR(record.eligibleSaleAmount)}</td>
              <td className="px-3 py-4 font-semibold">{formatPKR(record.commissionAmount)}</td>
              <td className="px-3 py-4">
                <StatusPill status={record.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status, dark = false }: { status: string; dark?: boolean }) {
  const color =
    status === "approved" || status === "paid"
      ? dark
        ? "bg-emerald-300/15 text-emerald-200"
        : "bg-emerald-100 text-emerald-800"
      : status === "pending" || status === "requested" || status === "processing"
        ? dark
          ? "bg-amber-300/15 text-amber-200"
          : "bg-amber-100 text-amber-900"
        : dark
          ? "bg-red-300/15 text-red-200"
          : "bg-red-100 text-red-800";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${color}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function AffiliateAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
    >
      {message}
    </div>
  );
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
