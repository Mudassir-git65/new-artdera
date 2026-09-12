import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  GalleryHorizontalEnd,
  Gavel,
  Image,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  MailWarning,
  Menu,
  MessageCircle,
  Package,
  Palette,
  Pencil,
  Loader2,
  ReceiptText,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Truck,
  UserRoundCheck,
  Users,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth";
import { ADMIN_METRICS, ARTWORKS, AUDIT_LOG, PROMOTIONS, STORES } from "./data";
import { formatPKR, PLAN_ORDER, PLANS, PROMOTION_PLACEMENTS } from "./config";
import type { SubscriptionPlan, User } from "./types";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AdminService, UserService, UploadService } from "./services";
import { PageLoading } from "@/components/site/PageLoading";
import { AdminAffiliateManagement } from "./admin-affiliates";

const adminNavigation = [
  ["Overview", "overview", LayoutDashboard],
  ["Users", "users", Users],
  ["Artists", "artists", Palette],
  ["Galleries", "galleries", Building2],
  ["Buyers", "buyers", UserRoundCheck],
  ["Stores", "stores", Store],
  ["Artworks", "artworks", Image],
  ["Verification", "verification", BadgeCheck],
  ["Payment Verification", "payment-verification", ShieldCheck],
  ["Orders", "orders", ShoppingBag],
  ["Disputes", "disputes", Gavel],
  ["Returns", "returns", RotateCcw],
  ["Refunds", "refunds", ReceiptText],
  ["Promotions", "promotions", Sparkles],
  ["Sponsored Placements", "sponsored", Tag],
  ["Plans", "plans", CreditCard],
  ["Subscriptions", "subscriptions", ClipboardList],
  ["Payouts", "payouts", Banknote],
  ["Affiliates", "affiliates", Users],
  ["Shipping Setup", "shipping", Truck],
  ["International Quotes", "international-quotes", Globe],
  ["Reviews", "reviews", Star],
  ["Messages & Reports", "messages-reports", MailWarning],
  ["Categories", "categories", Boxes],
  ["Collections", "collections", GalleryHorizontalEnd],
  ["Exhibitions", "exhibitions", BookOpen],
  ["Corporate Leads", "corporate-leads", Users],
  ["Content Management", "content", FileText],
  ["Notifications", "notifications", Bell],
  ["Support Tickets", "support", LifeBuoy],
  ["Analytics", "analytics", Activity],
  ["Audit Log", "audit-log", ShieldCheck],
  ["Settings", "settings", Settings],
] as const;

const adminResourceMap: Record<string, string> = {
  "messages-reports": "conversations",
  categories: "categories",
  collections: "collections",
  exhibitions: "exhibitions",
  "corporate-leads": "leads",
  content: "content",
  notifications: "notifications",
  support: "support",
  analytics: "analytics",
  stores: "stores",
};

export function AdminDashboard({ section = "overview" }: { section?: string }) {
  const { user, ready, logout } = useAuth();
  if (!ready) return <PageLoading label="Loading the ArtDera admin workspace" />;
  if (!user || user.role !== "admin")
    return (
      <div className="container-editorial flex min-h-[65vh] items-center justify-center py-14">
        <div className="max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-8 text-center">
          <LockKeyhole className="mx-auto h-9 w-9 text-[var(--oxblood)]" />
          <h1 className="mt-5 font-display text-4xl">Admin access required.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            This workspace requires an authenticated admin session. Every operation is authorized
            again by the API and recorded in the audit trail.
          </p>
          {user ? (
            <Link to="/account" className="btn-primary mt-6">
              Return to your account
            </Link>
          ) : (
            <Link to="/auth/login" search={{ redirect: "/admin" }} className="btn-primary mt-6">
              Sign in
            </Link>
          )}
        </div>
      </div>
    );
  const title = adminNavigation.find((item) => item[1] === section)?.[0] ?? "Overview";
  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-[#eeebe5]">
      <div className="container-editorial py-5">
        <div className="mb-5 flex items-center justify-between rounded-xl bg-[var(--ink)] p-3 text-[var(--ivory)] xl:hidden">
          <div>
            <div className="text-[10px] uppercase tracking-[.16em] text-white/40">
              ArtDera admin
            </div>
            <div className="font-semibold">{title}</div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15"
                aria-label="Open admin navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] bg-[var(--ink)] p-0 text-white">
              <SheetHeader className="sr-only">
                <SheetTitle>Admin navigation</SheetTitle>
              </SheetHeader>
              <AdminNavigation section={section} logout={logout} />
            </SheetContent>
          </Sheet>
        </div>
        <div className="grid gap-5 xl:grid-cols-[270px_1fr]">
          <aside className="sticky top-[calc(var(--header-height)+1.25rem)] hidden h-[calc(100vh-var(--header-height)-2.5rem)] overflow-hidden rounded-2xl bg-[var(--ink)] text-[var(--ivory)] xl:block">
            <AdminNavigation section={section} logout={logout} />
          </aside>
          <main className="min-w-0">
            <div className="mb-6">
              <div className="eyebrow">Operations workspace · MongoDB connected</div>
              <h1 className="mt-2 font-display text-5xl">{title}</h1>
            </div>
            <AdminSection section={section} />
          </main>
        </div>
      </div>
    </div>
  );
}
function AdminNavigation({ section, logout }: { section: string; logout: () => Promise<void> }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 p-5">
        <div className="eyebrow !text-white/35">ArtDera operations</div>
        <div className="mt-2 font-display text-2xl">Admin console</div>
        <div className="mt-1 text-[11px] text-amber-200/60">
          Role protected · audited API actions
        </div>
      </div>
      <nav className="no-scrollbar flex-1 overflow-y-auto p-3" aria-label="Admin dashboard">
        <div className="grid gap-0.5">
          {adminNavigation.map(([label, slug, Icon]) => (
            <a
              key={slug}
              href={slug === "overview" ? "/admin" : `/admin/${slug}`}
              className={`flex min-h-9 items-center gap-3 rounded-lg px-3 text-[11px] font-semibold ${section === slug ? "bg-[var(--terracotta)] text-[var(--ink)]" : "text-white/58 hover:bg-white/8 hover:text-white"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </a>
          ))}
        </div>
      </nav>
      <button
        onClick={() => {
          void logout().finally(() => window.location.assign("/"));
        }}
        className="m-3 flex min-h-10 items-center gap-3 rounded-xl border-t border-white/10 px-3 text-xs text-white/55"
      >
        <LockKeyhole className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
function AdminSection({ section }: { section: string }) {
  switch (section) {
    case "overview":
      return <AdminOverview />;
    case "users":
    case "artists":
    case "galleries":
    case "buyers":
      return <UserManagement type={section} />;
    case "stores":
      return <GenericAdminSection section={section} />;
    case "artworks":
      return <ArtworkModeration />;
    case "verification":
      return <VerificationQueue />;
    case "payment-verification":
      return <PaymentVerificationQueue />;
    case "promotions":
    case "sponsored":
      return <PromotionModeration />;
    case "plans":
      return <PlansManagement />;
    case "orders":
    case "disputes":
    case "returns":
    case "refunds":
      return <OrderOperations section={section} />;
    case "payouts":
    case "shipping":
    case "subscriptions":
      return <FinancialOperations section={section} />;
    case "affiliates":
      return <AdminAffiliateManagement />;
    case "international-quotes":
      return <AdminShippingQuotes />;
    case "audit-log":
      return <AuditLog />;
    case "settings":
      return <AdminSecurity />;
    default:
      return <GenericAdminSection section={section} />;
  }
}
function AdminOverview() {
  const metrics = [
    ["Total users", ADMIN_METRICS.totalUsers, Users],
    ["Active artists", ADMIN_METRICS.activeArtists, Palette],
    ["Galleries", ADMIN_METRICS.galleries, Building2],
    ["Buyers", ADMIN_METRICS.buyers, UserRoundCheck],
    ["Published artworks", ADMIN_METRICS.publishedArtworks, Image],
    ["Pending artworks", ADMIN_METRICS.pendingArtworks, AlertTriangle],
    ["Verification requests", ADMIN_METRICS.pendingVerification, BadgeCheck],
    ["Orders", ADMIN_METRICS.orders, ShoppingBag],
    ["Open disputes", ADMIN_METRICS.openDisputes, Gavel],
    ["Pending payouts", ADMIN_METRICS.pendingPayouts, Banknote],
  ] as const;
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[var(--indigo)] p-6 text-[var(--ivory)] md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="eyebrow !text-white/40">Today in ArtDera</div>
            <h2 className="mt-3 font-display text-4xl">
              Review the queues that protect marketplace trust.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/62">
              Review moderation, verification, payment and fulfilment records. Mutations are
              authorized by the API and recorded in the audit trail.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["GMV", ADMIN_METRICS.gmv],
              ["Subscription revenue", ADMIN_METRICS.subscriptionRevenue],
              ["Commission revenue", ADMIN_METRICS.commissionRevenue],
              ["Promotion revenue", ADMIN_METRICS.promotionRevenue],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-white/8 p-4">
                <div className="text-[10px] text-white/45">{label}</div>
                <div className="mt-2 font-display text-xl">{formatPKR(Number(value))}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(([label, value, Icon]) => (
          <AdminPanel key={label} compact>
            <div className="flex justify-between">
              <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
              <Icon className="h-4 w-4 text-[var(--oxblood)]" />
            </div>
            <div className="mt-3 font-display text-3xl">{Number(value).toLocaleString()}</div>
          </AdminPanel>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel>
          <div className="eyebrow">Moderation queue</div>
          <div className="mt-5 space-y-3">
            {[
              ["Artwork review", ADMIN_METRICS.pendingArtworks, "/admin/artworks"],
              ["Verification", ADMIN_METRICS.pendingVerification, "/admin/verification"],
              ["All promotions", PROMOTIONS.length, "/admin/promotions"],
              ["Open disputes", ADMIN_METRICS.openDisputes, "/admin/disputes"],
            ].map(([label, count, href]) => (
              <a
                key={label as string}
                href={href as string}
                className="flex min-h-14 items-center justify-between rounded-xl bg-[var(--ivory)] px-4"
              >
                <div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Loaded from the operations database
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl">{count}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </a>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel>
          <div className="eyebrow">Recent actions</div>
          <div className="mt-5 space-y-4">
            {AUDIT_LOG.map((log) => (
              <div key={log.id} className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--indigo)]" />
                <div>
                  <div className="text-sm font-semibold capitalize">
                    {log.action.replace(/_/g, " ")} {log.entityType}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {log.summary}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
function UserManagement({ type }: { type: string }) {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const role =
    type === "artists"
      ? "artist"
      : type === "buyers"
        ? "buyer"
        : type === "galleries"
          ? "gallery"
          : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    const timer = window.setTimeout(() => {
      void AdminService.resource("users", page, query, { role, limit: 50 }).then((result) => {
        if (cancelled) return;
        if (result.data) {
          setRows(result.data.items as User[]);
          setTotal(result.data.total);
          setPages(Math.max(result.data.pages, 1));
        } else {
          setRows([]);
          setTotal(0);
          setPages(1);
          setLoadError(result.error?.message ?? "Accounts could not be loaded");
        }
        setLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, query, role]);

  const statusLabel = (status: User["status"]) =>
    String(status ?? "active")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <AdminPanel>
      <div className="flex flex-col justify-between gap-4 lg:flex-row">
        <div>
          <div className="eyebrow">Account directory</div>
          <h2 className="mt-2 font-display text-3xl">
            {total.toLocaleString()} {type}
          </h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            className="art-field pl-10"
            placeholder="Search accounts"
          />
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="p-3">Account</th>
              <th className="p-3">Role</th>
              <th className="p-3">Location</th>
              <th className="p-3">Created</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  Loading accounts…
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-[var(--destructive)]">
                  {loadError}
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="p-3">
                    <strong>{user.fullName}</strong>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="p-3 capitalize">{user.role}</td>
                  <td className="p-3">{user.city}</td>
                  <td className="p-3">{new Date(user.createdAt).toLocaleDateString("en-PK")}</td>
                  <td className="p-3">
                    <AdminStatus status={statusLabel(user.status)} />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          void (async () => {
                            const next = user.status === "active" ? "suspended" : "active";
                            const result = await AdminService.userStatus(user.id, next);
                            if (result.error) return toast.error(result.error.message);
                            setRows((current) =>
                              current.map((item) =>
                                item.id === user.id
                                  ? (result.data ?? { ...item, status: next })
                                  : item,
                              ),
                            );
                            toast.success(
                              `Account ${next === "active" ? "reactivated" : "suspended"}`,
                            );
                          })()
                        }
                        className="admin-action disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={user.id === currentUser?.id}
                      >
                        {user.id === currentUser?.id
                          ? "Current session"
                          : user.status === "active"
                            ? "Suspend"
                            : "Reactivate"}
                      </button>
                      <button onClick={() => setPasswordModalUser(user)} className="admin-action">
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  No matching accounts were found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="admin-action disabled:opacity-45"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="admin-action disabled:opacity-45"
              disabled={page >= pages || loading}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Dialog
        open={!!passwordModalUser}
        onOpenChange={(open) => !open && setPasswordModalUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change User Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{passwordModalUser?.fullName}</strong> (
              {passwordModalUser?.email}). This will immediately revoke all their active sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              New Password
            </label>
            <input
              type="password"
              className="art-field w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setPasswordModalUser(null)}
              className="btn-ghost"
              disabled={isSubmittingPassword}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (newPassword.length < 8) {
                  return toast.error("Password must be at least 8 characters long.");
                }
                setIsSubmittingPassword(true);
                AdminService.changeUserPassword(passwordModalUser!.id, newPassword)
                  .then((res) => {
                    if (res.error) toast.error(res.error.message);
                    else {
                      toast.success("Password updated successfully");
                      setPasswordModalUser(null);
                      setNewPassword("");
                    }
                  })
                  .finally(() => setIsSubmittingPassword(false));
              }}
              className="btn-primary"
              disabled={isSubmittingPassword}
            >
              {isSubmittingPassword ? "Saving..." : "Save Password"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPanel>
  );
}
function ArtworkModeration() {
  const [states, setStates] = useState<Record<string, string>>(
    Object.fromEntries(ARTWORKS.map((item) => [item.id, item.status])),
  );
  const [active, setActive] = useState(
    ARTWORKS.find((item) => item.status === "Pending Review") ?? ARTWORKS[0],
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  async function act(status: string) {
    const decision = status === "Published" ? "approve" : "reject";
    const reason =
      decision === "reject"
        ? window.prompt("Reason for this moderation decision")?.trim()
        : undefined;
    if (decision === "reject" && !reason) return;
    const result = await AdminService.moderateArtwork(active.id, decision, reason);
    if (result.error) return toast.error(result.error.message);
    setStates((current) => ({ ...current, [active.id]: status }));
    toast.success(`${active.title}: ${status}`, {
      description: "The decision was saved and added to the audit log.",
    });
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <AdminPanel>
        <div className="eyebrow">Review queue</div>
        <div className="mt-4 space-y-2">
          {ARTWORKS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item)}
              className={`flex w-full gap-3 rounded-xl p-3 text-left ${active.id === item.id ? "bg-[var(--ivory)]" : "border border-[var(--color-border)]"}`}
            >
              <img src={item.images[0].url} alt="" className="h-14 w-12 rounded object-cover" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.creatorName}</div>
                <div className="mt-1">
                  <AdminStatus status={states[item.id]} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </AdminPanel>
      <AdminPanel>
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <div className="relative group">
            <img
              src={active.images[0].url}
              alt={active.title}
              className="aspect-[4/5] w-full rounded-xl object-cover"
            />
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer">
              {isUploadingImage ? (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              ) : (
                <div className="flex flex-col items-center text-white">
                  <Pencil className="h-6 w-6 mb-2" />
                  <span className="text-sm font-semibold">Edit Image</span>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                disabled={isUploadingImage}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsUploadingImage(true);
                  try {
                    const uploadResult = await UploadService.upload(file, "artwork");
                    if (uploadResult.error) {
                      toast.error(uploadResult.error.message);
                      return;
                    }
                    const url = uploadResult.data!.url;
                    const updateResult = await AdminService.updateArtworkImage(active.id, url);
                    if (updateResult.error) {
                      toast.error(updateResult.error.message);
                      return;
                    }
                    setActive((prev) => ({ ...prev, images: [{ ...prev.images[0], url }] }));
                    const artworkInList = ARTWORKS.find((a) => a.id === active.id);
                    if (artworkInList) {
                      artworkInList.images[0].url = url;
                    }
                    toast.success("Artwork image updated successfully");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to upload image");
                  } finally {
                    setIsUploadingImage(false);
                  }
                }}
              />
            </label>
          </div>
          <div>
            <div className="eyebrow">Artwork review</div>
            <h2 className="mt-2 font-display text-4xl">{active.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {active.description}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
              {[
                ["Artist", active.creatorName],
                ["Category", active.category],
                ["Medium", active.medium],
                ["Price", formatPKR(active.price)],
                ["Dimensions", active.dimensions],
                ["Certificate", active.certificate ? "Declared" : "No"],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-xl bg-[var(--ivory)] p-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={() => void act("Published")} className="btn-primary">
                Approve
              </button>
              <button onClick={() => void act("Rejected")} className="btn-ghost">
                Reject
              </button>
            </div>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
function VerificationQueue() {
  const [requests, setRequests] = useState<Array<Record<string, any>>>([]);
  const [active, setActive] = useState<Record<string, any> | undefined>();

  useEffect(() => {
    void AdminService.resource("verifications").then((result) => {
      if (result.data) {
        setRequests(result.data.items);
        setActive(result.data.items[0]);
      }
    });
  }, []);

  const decide = async (decision: "approve" | "reject" | "request_changes" | "remove") => {
    if (!active) return;
    const reason =
      decision === "approve" || decision === "remove"
        ? undefined
        : window.prompt("Reason for this decision")?.trim();
    if ((decision === "reject" || decision === "request_changes") && !reason) return;
    const result = await AdminService.verification(active.id, decision, reason);
    if (result.error) return toast.error(result.error.message);
    const status =
      decision === "approve"
        ? "approved"
        : decision === "request_changes"
          ? "changes_requested"
          : decision === "remove"
            ? "not_submitted"
            : "rejected";
    setActive({ ...active, status });
    setRequests((items) =>
      items.map((item) => (item.id === active.id ? { ...item, status } : item)),
    );
    toast.success("Verification decision saved");
  };

  if (!active)
    return (
      <AdminPanel>
        <div className="eyebrow">Verification queue</div>
        <p className="mt-4 text-sm text-muted-foreground">
          No verification requests are waiting for review.
        </p>
      </AdminPanel>
    );

  const sub = active.submittedData ?? {};
  const user = active.user ?? {};
  const store = active.store ?? {};
  const docs = active.documents ?? [];

  const cnicVal = sub.cnicNumber || sub.idNumber || "Not provided";
  const fullNameVal = sub.fullName || user.fullName || "Not provided";
  const phoneVal = sub.phoneNumber || user.mobile || "Not provided";
  const emailVal = user.email || "Not provided";
  const portfolioVal = sub.portfolioUrl;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      {/* Left panel: Verification Requests List */}
      <AdminPanel>
        <div className="flex items-center justify-between">
          <div className="eyebrow">{requests.length} verification requests</div>
        </div>
        <div className="mt-4 space-y-2">
          {requests.map((request) => {
            const reqSub = request.submittedData ?? {};
            const reqUser = request.user ?? {};
            const reqCnic = reqSub.cnicNumber || reqSub.idNumber;
            const isSelected = active.id === request.id;
            return (
              <button
                key={request.id}
                onClick={() => setActive(request)}
                className={`w-full rounded-xl p-4 text-left transition-all ${
                  isSelected
                    ? "bg-[var(--ivory)] border-2 border-[var(--oxblood)]"
                    : "border border-[var(--color-border)] hover:bg-[var(--ivory)]/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-sm font-semibold">
                      {reqSub.fullName || reqUser.fullName || `${request.type ?? "Seller"} Request`}
                    </strong>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {request.type === "gallery" ? "Gallery" : "Artist"} ·{" "}
                      {reqUser.email || `Account ${String(request.userId ?? "").slice(-6)}`}
                    </div>
                  </div>
                  <AdminStatus
                    status={String(request.status ?? "Pending Review").replaceAll("_", " ")}
                  />
                </div>
                {reqCnic && (
                  <div className="mt-2 text-[11px] font-mono font-medium text-[var(--oxblood)]">
                    CNIC: {reqCnic}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </AdminPanel>

      {/* Right panel: Complete Seller CNIC & Verification Details */}
      <div className="space-y-5">
        <AdminPanel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Seller Verification Review</div>
              <h2 className="mt-1 font-display text-3xl">{fullNameVal}</h2>
              <div className="mt-1 text-xs text-muted-foreground">
                Request ID: <span className="font-mono">{active.id}</span> · Submitted:{" "}
                {active.createdAt ? new Date(active.createdAt).toLocaleString() : "Not available"}
              </div>
            </div>
            <AdminStatus status={String(active.status ?? "pending").replaceAll("_", " ")} />
          </div>

          {/* Seller Account & Store summary */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-4 text-xs">
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Account Details
              </div>
              <div className="mt-2 space-y-1">
                <div>
                  <strong>Full Name:</strong> {fullNameVal}
                </div>
                <div>
                  <strong>Email:</strong> {emailVal}
                </div>
                <div>
                  <strong>Phone:</strong> {phoneVal}
                </div>
                <div>
                  <strong>City / Location:</strong> {user.city || "Not specified"}
                </div>
                <div>
                  <strong>Account Role:</strong>{" "}
                  <span className="capitalize">{user.role || active.type || "artist"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-4 text-xs">
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Store Information
              </div>
              <div className="mt-2 space-y-1">
                <div>
                  <strong>Store Name:</strong> {store.name || "Store created"}
                </div>
                {store.slug && (
                  <div>
                    <strong>Store Link: </strong>
                    <a
                      href={`/store/${store.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--oxblood)] underline"
                    >
                      /store/{store.slug}
                    </a>
                  </div>
                )}
                {sub.businessName && (
                  <div>
                    <strong>Business Name:</strong> {sub.businessName}
                  </div>
                )}
                {sub.galleryRegistrationNumber && (
                  <div>
                    <strong>Gallery Reg #:</strong> {sub.galleryRegistrationNumber}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prominent CNIC & Identity Section */}
          <div className="mt-5 rounded-2xl border-2 border-[var(--oxblood)]/20 bg-amber-50/40 p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--oxblood)]">
                Submitted Identity & CNIC Data
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                {sub.idType || "CNIC"}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white p-3.5 shadow-sm border border-amber-200">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  CNIC / ID Number
                </div>
                <div className="mt-1 font-mono text-xl font-bold tracking-wider text-slate-900 select-all">
                  {cnicVal}
                </div>
              </div>

              <div className="rounded-xl bg-white p-3.5 shadow-sm border border-amber-200">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Submitted Legal Name
                </div>
                <div className="mt-1 font-display text-lg font-semibold text-slate-900">
                  {fullNameVal}
                </div>
              </div>

              <div className="rounded-xl bg-white p-3.5 shadow-sm border border-amber-200">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Contact Phone
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{phoneVal}</div>
              </div>

              <div className="rounded-xl bg-white p-3.5 shadow-sm border border-amber-200">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Ownership Declaration
                </div>
                <div className="mt-1 text-sm font-semibold text-emerald-700">
                  {sub.ownershipDeclared ? "Confirmed by Seller" : "Not confirmed"}
                </div>
              </div>
            </div>

            {portfolioVal && (
              <div className="mt-3 rounded-xl bg-white p-3.5 shadow-sm border border-amber-200 text-xs">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Portfolio / Website
                </div>
                <a
                  href={portfolioVal.startsWith("http") ? portfolioVal : `https://${portfolioVal}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block font-semibold text-[var(--oxblood)] underline break-all"
                >
                  {portfolioVal}
                </a>
              </div>
            )}

            {sub.additionalNotes && (
              <div className="mt-3 rounded-xl bg-white p-3.5 shadow-sm border border-amber-200 text-xs">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Seller Notes
                </div>
                <p className="mt-1 leading-relaxed text-slate-800">{sub.additionalNotes}</p>
              </div>
            )}
          </div>

          {/* Uploaded CNIC & Identity Documents */}
          <div className="mt-5">
            <div className="eyebrow">Uploaded Identity Documents / CNIC Attachments</div>
            {docs.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {docs.map((doc: any, index: number) => {
                  const isImage = doc.mimeType?.startsWith("image/");
                  const downloadUrl = doc.downloadUrl || doc.url;
                  return (
                    <div
                      key={doc.id || index}
                      className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-4"
                    >
                      {isImage && (
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block mb-3"
                        >
                          <img
                            src={downloadUrl}
                            alt="CNIC / ID Document Preview"
                            className="max-h-48 w-full rounded-lg object-contain bg-white border border-[var(--color-border)] p-1"
                          />
                        </a>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold">
                            {doc.originalName || `Document ${index + 1}`}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {doc.mimeType || "Document"}{" "}
                            {doc.size ? `· ${Math.round(doc.size / 1024)} KB` : ""}
                          </div>
                        </div>
                        {downloadUrl && (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-[var(--oxblood)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
                          >
                            View / Download
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : sub.identityDocumentName ? (
              <div className="mt-3 rounded-xl bg-[var(--ivory)] p-4 text-xs">
                <strong>Attached Document Name:</strong> {sub.identityDocumentName}
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-[var(--ivory)] p-4 text-xs text-muted-foreground">
                No identity document file attached for this request.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-[var(--color-border)]">
            <button onClick={() => void decide("approve")} className="btn-primary">
              Approve verification
            </button>
            <button onClick={() => void decide("request_changes")} className="btn-ghost">
              Request changes
            </button>
            <button onClick={() => void decide("reject")} className="btn-ghost">
              Reject
            </button>
            <button onClick={() => void decide("remove")} className="btn-ghost">
              Remove badge
            </button>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
function PromotionModeration() {
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(PROMOTIONS.map((item) => [item.id, item.status])),
  );
  const decide = async (id: string, decision: "approve" | "reject" | "cancel") => {
    const reason =
      decision === "approve" ? undefined : window.prompt("Reason for this decision")?.trim();
    if (decision !== "approve" && !reason) return;
    const result = await AdminService.promotion(id, decision, reason);
    if (result.error) return toast.error(result.error.message);
    setStatuses((current) => ({
      ...current,
      [id]: decision === "approve" ? "Scheduled" : decision === "reject" ? "Rejected" : "Cancelled",
    }));
    toast.success("Promotion decision saved");
  };
  return (
    <AdminPanel>
      <div className="eyebrow">Sponsored placement requests</div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {PROMOTIONS.map((promotion) => {
          const artwork = ARTWORKS.find((item) => item.id === promotion.artworkId);
          const placement = PROMOTION_PLACEMENTS.find((item) => item.id === promotion.placementId);
          return (
            <article
              key={promotion.id}
              className="rounded-xl border border-[var(--color-border)] p-4"
            >
              <div className="flex gap-3">
                <img
                  src={artwork?.images[0].url}
                  alt=""
                  className="h-20 w-16 rounded object-cover"
                />
                <div>
                  <div className="text-sm font-semibold">{placement?.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{artwork?.title}</div>
                  <div className="mt-2">
                    <AdminStatus status={statuses[promotion.id]} />
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                {[
                  ["Price", formatPKR(promotion.price)],
                  ["Start", promotion.startDate],
                  ["End", promotion.endDate],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-[var(--ivory)] p-3">
                    <div className="text-[9px] text-muted-foreground">{label}</div>
                    <div className="mt-1 font-semibold">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void decide(promotion.id, "approve")}
                  className="admin-action"
                >
                  Approve
                </button>
                <button
                  onClick={() => void decide(promotion.id, "reject")}
                  className="admin-action"
                >
                  Reject
                </button>
                <button
                  onClick={() => void decide(promotion.id, "cancel")}
                  className="admin-action"
                >
                  Cancel
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-5 flex gap-3 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Marketplace display rule: maximum 20% sponsored results and no more than one sponsored
        artwork in every five cards.
      </div>
    </AdminPanel>
  );
}
function PlansManagement() {
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan>>(PLANS);
  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-xs text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Plan configuration is loaded from MongoDB. Changes affect new selections and are recorded in
        the admin audit trail; existing subscriptions retain their stored snapshot.
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {PLAN_ORDER.map((id) => {
          const plan = plans[id];
          return (
            <AdminPanel key={id}>
              <div className="flex justify-between">
                <div>
                  <div className="eyebrow">Plan configuration</div>
                  <h2 className="mt-2 font-display text-3xl">{plan.name}</h2>
                </div>
                {plan.recommended && <span className="chip">Recommended</span>}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <AdminField label="Plan name (fixed)">
                  <input className="art-field" value={plan.name} readOnly />
                </AdminField>
                <AdminField label="Monthly price">
                  <input
                    type="number"
                    className="art-field"
                    value={plan.monthlyPrice}
                    onChange={(event) =>
                      setPlans((current) => ({
                        ...current,
                        [id]: { ...plan, monthlyPrice: Number(event.target.value) },
                      }))
                    }
                  />
                </AdminField>
                <AdminField label="Annual price">
                  <input
                    type="number"
                    className="art-field"
                    value={plan.annualPrice ?? 0}
                    onChange={(event) =>
                      setPlans((current) => ({
                        ...current,
                        [id]: { ...plan, annualPrice: Number(event.target.value) || undefined },
                      }))
                    }
                  />
                </AdminField>
                <AdminField label="Listing limit">
                  <input
                    type="number"
                    className="art-field"
                    value={plan.listingLimit ?? 0}
                    onChange={(event) =>
                      setPlans((current) => ({
                        ...current,
                        [id]: { ...plan, listingLimit: Number(event.target.value) || null },
                      }))
                    }
                  />
                </AdminField>
                <AdminField label="Commission %">
                  <input
                    type="number"
                    step="0.5"
                    className="art-field"
                    value={plan.commission}
                    onChange={(event) =>
                      setPlans((current) => ({
                        ...current,
                        [id]: { ...plan, commission: Number(event.target.value) },
                      }))
                    }
                  />
                </AdminField>
                <AdminField label="Payout time (plan policy)">
                  <input className="art-field" value={plan.payoutTime} readOnly />
                </AdminField>
              </div>
              <button
                onClick={() =>
                  void (async () => {
                    const result = await AdminService.plan(plan.id, {
                      monthlyPrice: plan.monthlyPrice,
                      annualPrice: plan.annualPrice ?? null,
                      listingLimit: plan.listingLimit,
                      commissionRate: plan.commission,
                      features: plan.features,
                      permissions: plan.allowedModules,
                    });
                    result.error
                      ? toast.error(result.error.message)
                      : toast.success(`${plan.name} plan saved`);
                  })()
                }
                className="btn-primary mt-5"
              >
                Save plan
              </button>
            </AdminPanel>
          );
        })}
      </div>
    </div>
  );
}
type PaymentProofDecision = {
  id: string;
  action: "reject" | "request_information";
};

function PaymentVerificationQueue() {
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [reviewing, setReviewing] = useState("");
  const [decision, setDecision] = useState<PaymentProofDecision | null>(null);
  const [reason, setReason] = useState("");

  function load(nextStatus = status) {
    setLoading(true);
    void AdminService.paymentProofs(nextStatus || undefined).then((result) => {
      if (result.data) setRecords(result.data);
      else toast.error(result.error?.message ?? "Payment proofs could not be loaded");
      setLoading(false);
    });
  }

  useEffect(() => {
    setLoading(true);
    void AdminService.paymentProofs(status || undefined).then((result) => {
      if (result.data) setRecords(result.data);
      else toast.error(result.error?.message ?? "Payment proofs could not be loaded");
      setLoading(false);
    });
  }, [status]);

  async function review(
    id: string,
    action: "approve" | "reject" | "request_information",
    reviewReason?: string,
  ) {
    if (reviewing) return;
    setReviewing(id);
    const result = await AdminService.reviewPaymentProof(id, action, reviewReason);
    setReviewing("");
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      action === "approve"
        ? "Payment approved"
        : action === "reject"
          ? "Payment rejected"
          : "More information requested",
    );
    setDecision(null);
    setReason("");
    load();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "Pending verification",
            records.filter((record) => record.status === "pending_verification").length,
          ],
          ["Loaded records", records.length],
          [
            "Needs customer response",
            records.filter((record) => record.status === "information_requested").length,
          ],
        ].map(([label, value]) => (
          <AdminPanel key={label} compact>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-3 font-display text-3xl">{value}</div>
          </AdminPanel>
        ))}
      </div>
      <AdminPanel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="eyebrow">Manual payment review</div>
            <h2 className="mt-2 font-display text-3xl">Payment verification queue</h2>
          </div>
          <label className="text-xs">
            <span className="sr-only">Filter payment proofs</span>
            <select
              className="art-field !w-auto min-w-48"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All submissions</option>
              <option value="pending_verification">Pending verification</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="information_requested">Information requested</option>
            </select>
          </label>
        </div>
        <div className="mt-6 space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading payment proofs…</p>
          ) : records.length ? (
            records.map((record) => {
              const pending = record.status === "pending_verification";
              const activeDecision = decision?.id === record.id ? decision : null;
              return (
                <article
                  key={record.id}
                  className="overflow-hidden rounded-2xl border border-[var(--color-border)]"
                >
                  <div className="grid lg:grid-cols-[280px_1fr]">
                    <a
                      href={record.screenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-64 items-center justify-center bg-[var(--ink)]/5 p-3"
                      aria-label={`Open payment screenshot for ${record.referenceLabel}`}
                    >
                      {record.screenshotUrl ? (
                        <img
                          src={record.screenshotUrl}
                          alt={`Payment screenshot for ${record.referenceLabel}`}
                          className="max-h-80 w-full rounded-xl object-contain"
                        />
                      ) : (
                        <div className="text-center text-sm text-muted-foreground">
                          Screenshot unavailable
                        </div>
                      )}
                    </a>
                    <div className="p-5 md:p-6">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row">
                        <div>
                          <div className="eyebrow">
                            {record.method === "jazzcash" ? "JazzCash" : "Easypaisa"} · Attempt{" "}
                            {record.attempt}
                          </div>
                          <h3 className="mt-2 font-display text-3xl">{record.referenceLabel}</h3>
                        </div>
                        <AdminStatus status={String(record.status).replaceAll("_", " ")} />
                      </div>
                      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          ["Customer name", record.customerName],
                          [
                            "Payment type",
                            String(record.paymentType ?? "order").replaceAll("_", " "),
                          ],
                          ["Amount", formatPKR(Number(record.amount ?? 0))],
                          ["Mobile number", record.mobileNumber],
                          ["Transaction ID", record.transactionId],
                          [
                            "Submitted",
                            record.submittedAt
                              ? new Date(record.submittedAt).toLocaleString()
                              : "Unknown",
                          ],
                          ["Submission ID", String(record.id).slice(-10)],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                              {label}
                            </dt>
                            <dd className="mt-1 break-words font-semibold">
                              {value || "Not provided"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {record.note && (
                        <div className="mt-5 rounded-xl bg-[var(--ivory)] p-4 text-sm">
                          <div className="eyebrow">Customer note</div>
                          <p className="mt-2 leading-relaxed">{record.note}</p>
                        </div>
                      )}
                      {record.reviewReason && (
                        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                          <strong>Review note:</strong> {record.reviewReason}
                        </div>
                      )}
                      {pending && !activeDecision && (
                        <div className="mt-6 flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={reviewing === record.id}
                            onClick={() => review(record.id, "approve")}
                            className="btn-primary disabled:opacity-45"
                          >
                            {reviewing === record.id ? "Updating…" : "Approve Payment"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReason("");
                              setDecision({ id: record.id, action: "reject" });
                            }}
                            className="btn-ghost"
                          >
                            Reject Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReason("");
                              setDecision({ id: record.id, action: "request_information" });
                            }}
                            className="btn-ghost"
                          >
                            Request More Information
                          </button>
                        </div>
                      )}
                      {activeDecision && (
                        <form
                          className="mt-6 rounded-xl bg-[var(--ivory)] p-4"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void review(record.id, activeDecision.action, reason);
                          }}
                        >
                          <label>
                            <span className="eyebrow mb-2 block">
                              {activeDecision.action === "reject"
                                ? "Rejection reason"
                                : "Information needed"}
                            </span>
                            <textarea
                              required
                              minLength={3}
                              maxLength={1000}
                              value={reason}
                              onChange={(event) => setReason(event.target.value)}
                              className="art-field min-h-24 resize-y"
                              placeholder="Explain clearly what the customer should correct or provide"
                            />
                          </label>
                          <div className="mt-3 flex flex-wrap gap-3">
                            <button
                              disabled={reason.trim().length < 3 || reviewing === record.id}
                              className="btn-primary disabled:opacity-45"
                            >
                              {reviewing === record.id
                                ? "Updating…"
                                : activeDecision.action === "reject"
                                  ? "Confirm Rejection"
                                  : "Send Request"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDecision(null);
                                setReason("");
                              }}
                              className="btn-ghost"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl bg-[var(--ivory)] p-8 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-[var(--oxblood)]" />
              <h3 className="mt-4 font-display text-3xl">No payment proofs in this view.</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                New JazzCash and Easypaisa submissions will appear here automatically.
              </p>
            </div>
          )}
        </div>
      </AdminPanel>
    </div>
  );
}

function OrderOperations({ section }: { section: string }) {
  const [data, setData] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const resource = section === "disputes" ? "disputes" : "orders";
    void AdminService.resource(resource).then((result) => {
      let items = result.data?.items ?? [];
      if (section === "returns")
        items = items.filter((item) =>
          ["return_requested", "returned"].includes(String(item.status)),
        );
      if (section === "refunds")
        items = items.filter(
          (item) => String(item.status) === "refunded" || String(item.paymentStatus) === "refunded",
        );
      setData(items);
      if (result.error) toast.error(result.error.message);
      setLoading(false);
    });
  }, [section]);
  return (
    <AdminPanel>
      <div className="flex justify-between">
        <div>
          <div className="eyebrow">{section} queue</div>
          <h2 className="mt-2 font-display text-3xl">{data.length} records</h2>
        </div>
        <select className="art-field !w-auto">
          <option>All statuses</option>
          <option>Needs attention</option>
        </select>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3">Order</th>
              <th className="p-3">Artwork</th>
              <th className="p-3">Buyer</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Record ID</th>
            </tr>
          </thead>
          <tbody>
            {data.map((order) => (
              <tr key={order.id} className="border-b">
                <td className="p-3 font-semibold">
                  {order.orderNumber ?? order.caseNumber ?? order.id}
                </td>
                <td className="p-3">{order.items?.[0]?.title ?? order.reason ?? "—"}</td>
                <td className="p-3">
                  Buyer {String(order.buyerId ?? order.openedBy ?? "").slice(-6)}
                </td>
                <td className="p-3">{formatPKR(Number(order.total ?? order.buyerTotal ?? 0))}</td>
                <td className="p-3">
                  <AdminStatus status={section === "disputes" ? "Open dispute" : order.status} />
                </td>
                <td className="p-3 text-xs text-muted-foreground">{String(order.id).slice(-8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <p className="mt-5 text-sm text-muted-foreground">Loading records…</p>}
    </AdminPanel>
  );
}
function FinancialOperations({ section }: { section: string }) {
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const resource = section === "shipping" ? "shipments" : section;
    void AdminService.resource(resource).then((result) => {
      if (result.data) {
        setRecords(result.data.items);
        setTotal(result.data.total);
      } else if (result.error) toast.error(result.error.message);
    });
  }, [section]);
  const grouped = Object.entries(
    records.reduce<Record<string, number>>((counts, record) => {
      const key = String(record.status ?? "stored").replaceAll("_", " ");
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
  ).slice(0, 4);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([["Total", total], ...grouped] as Array<[string, number]>)
          .slice(0, 4)
          .map(([label, value]) => (
            <AdminPanel key={label} compact>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-3 font-display text-3xl">{value}</div>
            </AdminPanel>
          ))}
      </div>
      <AdminPanel>
        <div className="eyebrow">{section} operations</div>
        <div className="mt-5 space-y-3">
          {records.map((record, index) => (
            <div
              key={String(record.id ?? index)}
              className="flex items-center justify-between rounded-xl bg-[var(--ivory)] p-4"
            >
              <div>
                <div className="text-sm font-semibold">
                  {record.orderNumber ??
                    record.trackingNumber ??
                    record.providerReference ??
                    record.planId ??
                    `${section} ${String(record.id ?? "").slice(-8)}`}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {record.updatedAt
                    ? new Date(record.updatedAt).toLocaleString()
                    : `Record ${index + 1}`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AdminStatus status={String(record.status ?? "stored").replaceAll("_", " ")} />
              </div>
            </div>
          ))}
          {!records.length && (
            <p className="text-sm text-muted-foreground">No {section} records found.</p>
          )}
        </div>
      </AdminPanel>
    </div>
  );
}
function AuditLog() {
  return (
    <AdminPanel>
      <div className="flex justify-between">
        <div>
          <div className="eyebrow">Admin audit trail</div>
          <h2 className="mt-2 font-display text-3xl">Recent persisted actions</h2>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {AUDIT_LOG.map((log) => (
          <div
            key={log.id}
            className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:grid-cols-[160px_1fr_auto]"
          >
            <div>
              <AdminStatus status={log.action.replace(/_/g, " ")} />
              <div className="mt-2 text-[10px] text-muted-foreground">
                {new Date(log.createdAt).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold">
                {log.entityType} · {log.entityId}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{log.summary}</div>
            </div>
            <div className="text-xs text-muted-foreground">{log.actorId}</div>
          </div>
        ))}
      </div>
    </AdminPanel>
  );
}
function AdminSecurity() {
  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-900">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Admin access is enforced by the API. Sessions are stored as hashed tokens and authorized
        actions are recorded in the audit trail.
      </div>
      <AdminPanel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="eyebrow">Current session</div>
            <p className="mt-2 text-sm text-muted-foreground">
              This browser is authenticated with an HTTP-only cookie.
            </p>
          </div>
          <button
            onClick={() =>
              void UserService.revokeOtherSessions().then((result) =>
                result.error
                  ? toast.error(result.error.message)
                  : toast.success(`${result.data?.revoked ?? 0} other sessions signed out`),
              )
            }
            className="btn-ghost"
          >
            Sign out other sessions
          </button>
        </div>
      </AdminPanel>
      <GenericAdminSection section="settings" />
    </div>
  );
}
function GenericAdminSection({ section }: { section: string }) {
  const label = adminNavigation.find((item) => item[1] === section)?.[0] ?? section;
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const resource = adminResourceMap[section] ?? section;
  useEffect(() => {
    setLoading(true);
    void AdminService.resource(resource).then((result) => {
      if (result.data) {
        setRecords(result.data.items);
        setTotal(result.data.total);
      } else toast.error(result.error?.message ?? `${label} could not be loaded`);
      setLoading(false);
    });
  }, [label, resource]);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Database records", total.toLocaleString()],
          ["Loaded on this page", records.length.toLocaleString()],
          ["Page size", "50"],
        ].map(([title, value]) => (
          <AdminPanel key={title} compact>
            <div className="text-xs text-muted-foreground">{title}</div>
            <div className="mt-3 font-display text-3xl">{value}</div>
          </AdminPanel>
        ))}
      </div>
      <AdminPanel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="eyebrow">{label}</div>
            <h2 className="mt-2 font-display text-3xl">Manage {label.toLowerCase()}</h2>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading records…</p>
          ) : records.length ? (
            records.map((record, index) => (
              <div
                key={String(record.id ?? index)}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-4"
              >
                <div>
                  <div className="text-sm font-semibold">
                    {record.name ??
                      record.title ??
                      record.subject ??
                      record.ticketNumber ??
                      record.slug ??
                      record.action ??
                      `${label} record ${index + 1}`}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {record.status
                      ? String(record.status).replaceAll("_", " ")
                      : `ID ${String(record.id ?? "").slice(-8)}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AdminStatus
                    status={record.status ? String(record.status).replaceAll("_", " ") : "Stored"}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No {label.toLowerCase()} records were found.
            </p>
          )}
        </div>
      </AdminPanel>
    </div>
  );
}
function AdminPanel({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <section
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] ${compact ? "p-5" : "p-5 md:p-6"}`}
    >
      {children}
    </section>
  );
}
function AdminStatus({ status }: { status: string }) {
  const positive = /Active|Approved|Published|Verified|Current|schedule|Completed|Unlocked/i.test(
    status,
  );
  const warning = /Pending|Review|Requested|Preparing|Invited|Not connected|Needs|Open/i.test(
    status,
  );
  const negative = /Rejected|Suspended|Failed|Past due|Dispute/i.test(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${positive ? "bg-emerald-50 text-emerald-800" : warning ? "bg-amber-50 text-amber-900" : negative ? "bg-red-50 text-red-800" : "bg-[var(--ivory)] text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
function AdminField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function AdminShippingQuotes() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void AdminService.shippingQuotes().then((result) => {
      if (result.data) setQuotes(result.data.items);
      else toast.error(result.error?.message ?? "Failed to load shipping quotes.");
      setLoading(false);
    });
  }, []);

  const respondQuote = async (
    id: string,
    quotedShippingCost: number,
    quotedPackagingCost: number,
    estimatedDeliveryTime?: string,
  ) => {
    const result = await AdminService.quoteShipping(id, {
      quotedShippingCost,
      quotedPackagingCost,
      estimatedDeliveryTime,
    });
    if (result.error) return toast.error(result.error.message);
    toast.success("Quote sent successfully.");
    setQuotes((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "quote_provided",
              quotedShippingCost,
              quotedPackagingCost,
              estimatedDeliveryTime,
            }
          : item,
      ),
    );
  };

  if (loading) {
    return (
      <AdminPanel>
        <div className="py-10 text-center">Loading international quotes...</div>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel>
      <div className="eyebrow">International Operations</div>
      <h2 className="mt-2 font-display text-3xl">Shipping Quote Requests</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Review quote requests from international buyers, check logistics rates, and send shipping
        fee quotes.
      </p>

      <div className="mt-6 space-y-4">
        {quotes.map((quote) => (
          <article
            key={quote.id}
            className="grid gap-5 rounded-2xl border border-[var(--color-border)] p-5 md:grid-cols-[1fr_auto]"
          >
            <div>
              <div className="font-display text-2xl">Delivery to {quote.country}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                <strong>Artwork ID:</strong> {quote.artworkId}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                <strong>Destination:</strong> {quote.shippingAddress}, {quote.city}
                {quote.province ? `, ${quote.province}` : ""}, {quote.postalCode}, {quote.country}
              </div>
              <div className="mt-4 text-sm font-semibold">
                Status: <span className="uppercase text-[var(--oxblood)]">{quote.status}</span>
              </div>
              {quote.quotedShippingCost !== undefined && (
                <div className="mt-2 text-sm">
                  Shipping: <strong>{formatPKR(quote.quotedShippingCost)}</strong> · Packaging:{" "}
                  <strong>{formatPKR(quote.quotedPackagingCost ?? 0)}</strong>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-end">
              {["new_request", "calculating_shipping"].includes(quote.status) && (
                <button
                  onClick={() => {
                    const shipping = window.prompt("Shipping cost in PKR (for example 15000):");
                    if (!shipping) return;
                    const packaging = window.prompt("Packaging cost in PKR (enter 0 if included):");
                    if (packaging === null) return;
                    const shippingCost = Number(shipping);
                    const packagingCost = Number(packaging);
                    if (
                      !Number.isFinite(shippingCost) ||
                      shippingCost < 0 ||
                      !Number.isFinite(packagingCost) ||
                      packagingCost < 0
                    )
                      return toast.error("Enter valid non-negative quote amounts.");
                    const deliveryTime =
                      window
                        .prompt("Estimated delivery time (optional, e.g. 10–14 working days):")
                        ?.trim() || undefined;
                    void respondQuote(quote.id, shippingCost, packagingCost, deliveryTime);
                  }}
                  className="btn-primary"
                >
                  Send Quote Amount
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!quotes.length && (
        <div className="py-14 text-center border-t border-[var(--color-border)] mt-8">
          <Globe className="mx-auto h-8 w-8 text-[var(--oxblood)]" />
          <h2 className="mt-4 font-display text-3xl">No requests pending.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            When international buyers request a shipping quote, it will appear here.
          </p>
        </div>
      )}
    </AdminPanel>
  );
}
