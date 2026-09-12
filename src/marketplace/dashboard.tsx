import { Link } from "@tanstack/react-router";
import { ProBadge } from "@/components/ui/ProBadge";
import {
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Eye,
  FileText,
  GalleryHorizontalEnd,
  Grid2X2,
  Heart,
  HelpCircle,
  ImagePlus,
  LayoutDashboard,
  List,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Package,
  PackageCheck,
  Palette,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  UserRoundCheck,
  Users,
  Video,
  WalletCards,
  X,
  Info,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageLoading } from "@/components/site/PageLoading";
import { CATEGORIES_LIST, STYLES_LIST, SUBJECTS_LIST } from "@/lib/taxonomy";
import { useAuth } from "./auth";
import {
  ARTWORKS,
  CONVERSATIONS,
  MESSAGES,
  NOTIFICATIONS,
  ORDERS,
  PAYOUTS,
  PROMOTIONS,
  REVIEWS,
  SHIPMENTS,
  STORES,
} from "./data";
import {
  ARTWORK_STATUSES,
  ORDER_STATUSES,
  type Artwork,
  type ArtworkStatus,
  type OrderStatus,
  type PlanId,
} from "./types";
import {
  ArtistService,
  AnalyticsService,
  ArtworkDraftService,
  ArtworkService,
  CustomerService,
  containsProtectedContact,
  FeatureAccessService,
  GalleryService,
  InvoiceService,
  MessageService,
  NotificationService,
  OrderService,
  PromotionService,
  ReviewService,
  SupportService,
  StoreService,
  SubscriptionService,
  UploadService,
  UserService,
  VerificationService,
} from "./services";
import { DEMO_PAYMENT_MODE, formatPKR, PLAN_ORDER, PLANS, PROMOTION_PLACEMENTS } from "./config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IMAGES } from "@/lib/artdera";
import { PlanFeatureGate } from "@/components/marketplace/PlanFeatureGate";

const artistNavigation: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      ["Overview", "overview", LayoutDashboard],
      ["My Store", "store", Store],
      ["Artworks", "artworks", Palette],
      ["Add Artwork", "add-artwork", ImagePlus],
    ],
  },
  {
    label: "Sell",
    items: [
      ["Orders", "orders", ShoppingBag],
      ["Messages", "messages", MessageCircle],
      ["Customers", "customers", Users],
      ["Promotions", "promotions", Sparkles],
    ],
  },
  {
    label: "Business",
    items: [
      ["Analytics", "analytics", BarChart3],
      ["Shipping", "shipping", Truck],
      ["Payouts", "payouts", Banknote],
      ["Reviews", "reviews", Star],
    ],
  },
  {
    label: "Growth tools",
    items: [
      ["International Selling", "international-tools", Truck],
      ["Premium Store URL", "premium-url", Store],
    ],
  },
  {
    label: "Account",
    items: [
      ["Verification", "verification", BadgeCheck],
      ["Subscription & Billing", "billing", CreditCard],
      ["Support", "support", HelpCircle],
      ["Settings", "settings", Settings],
    ],
  },
];

const galleryNavigation: NavGroup = {
  label: "Gallery",
  items: [
    ["Managed Artists", "managed-artists", Users],
    ["Add Artist", "add-artist", Plus],
    ["Staff Accounts", "staff", UserRoundCheck],
    ["Staff Permissions", "staff-permissions", LockKeyhole],
    ["Inventory", "inventory", Boxes],
    ["Exhibitions", "exhibitions", GalleryHorizontalEnd],
    ["Gallery CRM", "gallery-crm", ClipboardCheck],
    ["Reports", "reports", FileText],
  ],
};
type NavItem = readonly [string, string, LucideIcon];
type NavGroup = { label: string; items: NavItem[] };

export function SellerDashboard({ section = "overview" }: { section?: string }) {
  const { user, ready, catalogReady, logout } = useAuth();
  // Wait for catalogReady so onboardingCompleted is fully populated from bootstrap
  // before we evaluate the recoveryRoute. Using `ready` alone causes a race where
  // onboardingCompleted is still false and the user gets wrongly redirected to /artist/onboarding.
  const recoveryRoute = catalogReady && user ? SubscriptionService.destinationFor(user) : null;

  useEffect(() => {
    if (recoveryRoute && recoveryRoute !== "/artist/dashboard") {
      window.location.replace(recoveryRoute);
    }
  }, [recoveryRoute]);

  if (!ready) return <DashboardLoading />;
  if (!user || !["artist", "gallery"].includes(user.role))
    return <DashboardAccess signedIn={Boolean(user)} />;
  if (!catalogReady || recoveryRoute !== "/artist/dashboard") return <DashboardLoading />;
  const sellerRole = user.role as "artist" | "gallery";
  const groups =
    sellerRole === "gallery" ? [...artistNavigation, galleryNavigation] : artistNavigation;
  const store = ArtistService.getStoreForUser(user.id);
  const planId = SubscriptionService.planForUser(user);
  const subscription = SubscriptionService.getForUser(user.id);
  const title =
    groups.flatMap((group) => group.items).find((item) => item[1] === section)?.[0] ?? "Overview";
  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-[#f2ede4]">
      <div className="container-editorial py-5 lg:py-7">
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] px-4 py-3 lg:hidden">
          <div>
            <div className="text-xs text-muted-foreground">Seller dashboard</div>
            <div className="font-semibold">{title}</div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full border"
                aria-label="Open dashboard navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] bg-[var(--ink)] p-0 text-[var(--ivory)]">
              <SheetHeader className="sr-only">
                <SheetTitle>Seller dashboard navigation</SheetTitle>
              </SheetHeader>
              <DashboardNavigation
                groups={groups}
                section={section}
                userName={user.fullName}
                storeName={store?.name ?? "Your store"}
                logout={logout}
                planId={planId}
                subscriptionStatus={subscription?.status ?? "Active"}
              />
            </SheetContent>
          </Sheet>
        </div>
        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="sticky top-[calc(var(--header-height)+1.5rem)] hidden h-[calc(100vh-var(--header-height)-3rem)] overflow-hidden rounded-2xl bg-[var(--ink)] text-[var(--ivory)] lg:block">
            <DashboardNavigation
              groups={groups}
              section={section}
              userName={user.fullName}
              storeName={store?.name ?? "Your store"}
              logout={logout}
              planId={planId}
              subscriptionStatus={subscription?.status ?? "Active"}
            />
          </aside>
          <main className="min-w-0">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="eyebrow">
                  {sellerRole === "gallery" ? "Gallery workspace" : "Artist workspace"}
                </div>
                <h1 className="mt-2 font-display text-4xl md:text-5xl">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/artist/dashboard/subscription"
                  className="chip min-h-11 !px-4 flex items-center gap-2"
                >
                  <span>{PLANS[planId].name} Plan</span>
                  {planId === "professional" && <ProBadge size="sm" />}
                </a>
                <a
                  href={store ? `/store/${store.slug}` : "/artist/onboarding"}
                  className="btn-ghost"
                >
                  <Eye className="h-4 w-4" /> {store ? "View Store" : "Create Store"}
                </a>
                <NotificationBell userId={user.id} />
              </div>
            </div>
            <DashboardSection
              section={section}
              userId={user.id}
              role={sellerRole}
              storeId={store?.id ?? `unpublished-${user.id}`}
              storeSlug={store?.slug ?? "unpublished-store"}
              planId={planId}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

function DashboardNavigation({
  groups,
  section,
  userName,
  storeName,
  logout,
  planId,
  subscriptionStatus,
}: {
  groups: NavGroup[];
  section: string;
  userName: string;
  storeName: string;
  logout: () => Promise<void>;
  planId: PlanId;
  subscriptionStatus: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 p-5">
        <div className="eyebrow !text-white/42">Seller centre</div>
        <div className="mt-2 truncate font-display text-2xl">{storeName}</div>
        <div className="mt-1 truncate text-xs text-white/45">{userName}</div>
        <a
          href="/artist/dashboard/subscription"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-bold text-white/90"
        >
          <span>{PLANS[planId].name} Plan</span>
          {planId === "professional" && <ProBadge size="sm" />}
        </a>
      </div>
      <nav
        className="no-scrollbar flex-1 space-y-6 overflow-y-auto p-3"
        aria-label="Seller dashboard"
      >
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
              {group.label}
            </div>
            <div className="grid gap-0.5">
              {group.items.map(([label, slug, Icon]) => {
                const accessModule = slug === "billing" ? "subscription" : slug;
                const locked = !FeatureAccessService.canAccess(planId, accessModule);
                const required = locked
                  ? FeatureAccessService.requiredPlan(accessModule)
                  : undefined;
                const href =
                  slug === "overview"
                    ? "/artist/dashboard"
                    : slug === "add-artwork"
                      ? "/artist/dashboard/artworks/new"
                      : slug === "billing"
                        ? "/artist/dashboard/subscription"
                        : `/artist/dashboard/${slug}`;
                return (
                  <a
                    key={slug}
                    href={href}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold transition ${section === slug ? "bg-[var(--terracotta)] text-[var(--ink)]" : "text-white/66 hover:bg-white/8 hover:text-white"}`}
                  >
                    {locked ? <LockKeyhole className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {required && (
                      <span className="text-[9px] opacity-65">{PLANS[required].name}</span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => {
            void logout().finally(() => window.location.assign("/"));
          }}
          className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-xs font-semibold text-white/60 hover:bg-white/8 hover:text-white"
        >
          <LockKeyhole className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  );
}

function DashboardSection(props: {
  section: string;
  userId: string;
  role: "artist" | "gallery";
  storeId: string;
  storeSlug: string;
  planId: PlanId;
}) {
  switch (props.section) {
    case "overview":
      return <Overview {...props} />;
    case "store":
      return <StoreManager storeId={props.storeId} storeSlug={props.storeSlug} />;
    case "artworks":
      return <ArtworkManager storeId={props.storeId} planId={props.planId} />;
    case "inventory":
      return (
        <GalleryFeatureGate {...props} module="inventory" featureName="Gallery inventory">
          <ArtworkManager storeId={props.storeId} planId={props.planId} />
        </GalleryFeatureGate>
      );
    case "add-artwork":
      return <AddArtwork storeId={props.storeId} planId={props.planId} />;
    case "orders":
      return <OrdersManager userId={props.userId} />;
    case "messages":
      return <MessageCenter />;
    case "customers":
      return (
        <PlanFeatureGate
          requiredPlan="professional"
          currentPlan={props.planId}
          featureName="Customer-management tools"
          upgradeDescription="Organise collectors, consent-aware follow-ups and completed-order relationships with Professional customer tools."
          upgradeTarget="professional"
          module="customers"
        >
          <Customers planId={props.planId} />
        </PlanFeatureGate>
      );
    case "gallery-crm":
      return (
        <GalleryFeatureGate {...props} module="gallery-crm" featureName="Gallery CRM">
          <Customers planId={props.planId} />
        </GalleryFeatureGate>
      );
    case "analytics":
      return <Analytics planId={props.planId} />;
    case "international-tools":
      return (
        <PlanFeatureGate
          requiredPlan="professional"
          currentPlan={props.planId}
          featureName="International selling tools"
          upgradeDescription="Professional adds international buyer enquiries, region-aware shipping settings and cross-border sales preparation."
          upgradeTarget="professional"
          module="international-tools"
        >
          <UnlockedGrowthTool
            title="International selling tools"
            body="Configure international enquiry regions, customs notes and cross-border shipping preparation from this workspace."
          />
        </PlanFeatureGate>
      );
    case "premium-url":
      return (
        <PlanFeatureGate
          requiredPlan="professional"
          currentPlan={props.planId}
          featureName="Professional artist store URL"
          upgradeDescription="Professional unlocks professional store URL controls alongside detailed analytics and customer-management tools."
          upgradeTarget="professional"
          module="premium-url"
        >
          <UnlockedGrowthTool
            title="Professional store URL"
            body={`Your professional URL can be configured for artdera.com/store/${props.storeSlug}. Domain connection remains a backend integration.`}
          />
        </PlanFeatureGate>
      );
    case "promotions":
      return <Promotions />;
    case "shipping":
      return <Shipping />;
    case "payouts":
      return <Payouts planId={props.planId} />;
    case "reviews":
      return <Reviews userId={props.userId} />;
    case "verification":
      return <Verification />;
    case "billing":
      return <Billing planId={props.planId} userId={props.userId} role={props.role} />;
    case "support":
      return <Support planId={props.planId} />;
    case "settings":
      return <SettingsPage />;
    case "managed-artists":
    case "add-artist":
      return (
        <GalleryFeatureGate {...props} module={props.section} featureName="Artist management">
          <ManagedArtists />
        </GalleryFeatureGate>
      );
    case "staff":
    case "staff-permissions":
      return (
        <GalleryFeatureGate {...props} module={props.section} featureName="Gallery staff accounts">
          <StaffAccounts />
        </GalleryFeatureGate>
      );
    case "exhibitions":
      return (
        <GalleryFeatureGate {...props} module="exhibitions" featureName="Exhibition pages">
          <Exhibitions />
        </GalleryFeatureGate>
      );
    case "reports":
      return (
        <GalleryFeatureGate {...props} module="reports" featureName="Gallery reports">
          <GalleryReports />
        </GalleryFeatureGate>
      );
    default:
      return <Overview {...props} />;
  }
}

function GalleryFeatureGate({
  role,
  planId,
  module,
  featureName,
  children,
}: {
  role: "artist" | "gallery";
  planId: PlanId;
  module: string;
  featureName: string;
  children: ReactNode;
}) {
  return (
    <PlanFeatureGate
      requiredPlan="gallery"
      currentPlan={planId}
      featureName={featureName}
      upgradeDescription="Gallery adds staff permissions, managed artists, fair-use inventory, exhibition pages, CRM and advanced gallery reporting."
      upgradeTarget="gallery"
      module={module}
      forceLocked={role !== "gallery"}
    >
      {children}
    </PlanFeatureGate>
  );
}

function Overview({
  role,
  userId,
  storeId,
  storeSlug,
  planId,
}: {
  role: "artist" | "gallery";
  userId: string;
  storeId: string;
  storeSlug: string;
  planId: PlanId;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [activity, setActivity] = useState<Record<string, number>>({});
  const [activitySeries, setActivitySeries] = useState<Array<Record<string, string | number>>>([]);
  useEffect(() => {
    void AnalyticsService.get("7d").then((result) => {
      if (!result.data) return;
      setActivity(result.data.metrics);
      const byDate = new Map<string, Record<string, string | number>>();
      for (const point of result.data.series) {
        const row = byDate.get(point._id.date) ?? {
          date: point._id.date,
          storeViews: 0,
          artworkViews: 0,
        };
        if (point._id.type === "store_view") row.storeViews = point.count;
        if (point._id.type === "artwork_view") row.artworkViews = point.count;
        byDate.set(point._id.date, row);
      }
      setActivitySeries([...byDate.values()]);
    });
  }, []);
  const subscription = SubscriptionService.getForUser(userId);
  const currentStore = ArtistService.getStoreForUser(userId);
  const usage = FeatureAccessService.usage(userId, storeId);
  const storeArtworks = ArtworkService.forStore(storeId);
  const published = storeArtworks.filter((item) => item.status === "Published").length;
  const drafts = storeArtworks.filter((item) => item.status === "Draft").length;
  const sold = storeArtworks.filter((item) => item.status === "Sold").length;
  const sellerOrders = ORDERS.filter((order) => order.sellerId === userId);
  const activePromotions = PROMOTIONS.filter((promotion) =>
    ["Active", "Scheduled", "Pending"].includes(promotion.status),
  );
  const pendingPayout = PAYOUTS.filter(
    (payout) => payout.sellerId === userId && payout.status !== "Paid",
  ).reduce((sum, payout) => sum + payout.net, 0);
  const metrics = [
    [
      "Total artworks",
      String(storeArtworks.length),
      `${published} published · ${drafts} drafts · ${sold} sold`,
      Palette,
    ],
    [
      "Orders",
      String(sellerOrders.length),
      `${sellerOrders.filter((order) => ["Paid", "Seller Confirmed", "Preparing"].includes(order.status)).length} need attention`,
      ShoppingBag,
    ],
    ["Store views", String(activity.storeViews ?? 0), "Last 7 days", Eye],
    ["Wishlist saves", String(activity.saves ?? 0), "Last 7 days", Heart],
    [
      "Messages",
      String(activity.messages ?? 0),
      `${CONVERSATIONS.filter((conversation) => conversation.sellerId === userId).reduce((sum, conversation) => sum + conversation.unreadCount, 0)} unread`,
      MessageCircle,
    ],
    [
      "Estimated earnings",
      formatPKR(activity.estimatedPayout ?? 0),
      `${formatPKR(pendingPayout)} pending`,
      Banknote,
    ],
    [
      "Active promotions",
      String(activePromotions.length),
      `${activePromotions.reduce((sum, promotion) => sum + promotion.impressions, 0).toLocaleString()} impressions`,
      Sparkles,
    ],
    [
      "Listing usage",
      role === "gallery"
        ? String(usage.activeListings)
        : `${usage.activeListings} / ${PLANS[planId].listingLimit}`,
      role === "gallery"
        ? "Fair-use active"
        : `${Math.round((usage.activeListings / (PLANS[planId].listingLimit || 1)) * 100)}% used`,
      Boxes,
    ],
  ] as const;
  const checklist = [
    ["profile", "Add profile picture", true],
    ["bio", "Complete biography", true],
    ["artwork", "Add first artwork", true],
    ["shipping", "Set shipping preferences", true],
    ["verification", "Submit verification", true],
    ["publish", "Publish store", true],
  ] as const;
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-[var(--indigo)] p-6 text-[var(--ivory)] md:p-8">
        <div className="grid gap-7 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="eyebrow !text-white/45">Welcome back</div>
            <h2 className="mt-3 font-display text-4xl">
              Your {PLANS[planId].name} workspace is ready.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/62">
              {PLANS[planId].listingLimit === null
                ? "Manage artists, staff, inventory and exhibitions from one gallery workspace with 0% ArtDera sales commission."
                : `You can publish ${PLANS[planId].listingLimit} active artworks with ${PLANS[planId].commission}% ArtDera sales commission.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/artist/dashboard/artworks/new"
              className="btn-primary bg-[var(--terracotta)] !text-[var(--ink)]"
            >
              <Plus className="h-4 w-4" /> Add Artwork
            </a>
            <a href={`/store/${storeSlug}`} className="btn-ghost !border-white/20 !text-white">
              View Store
            </a>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-3 py-2">
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-300" /> Store published
          </span>
          {currentStore?.verified ||
          (currentStore as Record<string, any>)?.verificationStatus === "Approved" ||
          (currentStore as Record<string, any>)?.verificationStatus === "approved" ? (
            <span className="rounded-full bg-[var(--indigo)] text-white px-3 py-2 font-bold inline-flex items-center gap-1 shadow-sm">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified Artist ✓
            </span>
          ) : null}
          {planId === "professional" && <ProBadge size="md" />}
          <span className="rounded-full bg-white/10 px-3 py-2">
            {PLANS[planId].name} Plan · {subscription?.status ?? "Active"}
          </span>
          {subscription?.renewsAt && (
            <span className="rounded-full bg-white/10 px-3 py-2">
              Active until:{" "}
              {new Date(subscription.renewsAt).toLocaleDateString("en-PK", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          <span className="rounded-full bg-white/10 px-3 py-2">
            Payout: {PLANS[planId].payoutTime}
          </span>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, detail, Icon], index) => (
          <article
            key={label}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5"
          >
            <div className="flex items-start justify-between">
              <div className="text-xs font-semibold text-muted-foreground">{label}</div>
              <Icon className="h-4 w-4 text-[var(--oxblood)]" />
            </div>
            <div className="mt-3 font-display text-3xl">{value}</div>
            <div
              className={`mt-1 flex items-center gap-1 text-xs ${index === 2 || index === 3 ? "text-[var(--success)]" : "text-muted-foreground"}`}
            >
              {index === 2 || index === 3 ? <ArrowUpRight className="h-3 w-3" /> : null}
              {detail}
            </div>
          </article>
        ))}
      </section>
      {role === "gallery" && (
        <section className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Active artworks", usage.activeListings],
            ["Managed artists", usage.managedArtists],
            ["Staff accounts used", `${usage.staffAccounts} / 10`],
            ["Exhibition pages", usage.exhibitionPages],
            ["Storage usage", `${(usage.storageUsedMb / 1024).toFixed(1)} GB`],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl bg-[var(--ivory)] p-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-2 font-display text-2xl">{value}</div>
            </div>
          ))}
        </section>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Store activity</div>
              <h3 className="mt-2 font-display text-3xl">Views this week</h3>
            </div>
            <a href="/artist/dashboard/analytics" className="text-xs font-semibold underline">
              Full analytics
            </a>
          </div>
          <div className="mt-5 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activitySeries}>
                <defs>
                  <linearGradient id="dashboardViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6e2334" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6e2334" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ddd4c7" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => value.slice(8)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} width={35} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="storeViews"
                  stroke="#6e2334"
                  strokeWidth={2}
                  fill="url(#dashboardViews)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-6">
          <div className="eyebrow">Setup checklist</div>
          <h3 className="mt-2 font-display text-3xl">Your store is complete.</h3>
          <div className="mt-5 space-y-2">
            {checklist
              .filter(([id]) => !dismissed.includes(id))
              .map(([id, label, done]) => (
                <div
                  key={id}
                  className="flex min-h-11 items-center gap-3 rounded-xl bg-[var(--ivory)] px-3 text-sm"
                >
                  <CheckCircle2
                    className={`h-4 w-4 ${done ? "text-[var(--success)]" : "text-muted-foreground"}`}
                  />
                  <span className="flex-1">{label}</span>
                  <button
                    type="button"
                    onClick={() => setDismissed((values) => [...values, id])}
                    aria-label={`Dismiss ${label}`}
                    className="p-2 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </section>
      </div>
      <section className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 sm:grid-cols-2 xl:grid-cols-7">
        {[
          ["Add Artwork", "/artist/dashboard/artworks/new", ImagePlus],
          ["View Store", `/store/${storeSlug}`, Eye],
          ["Edit Store", "/artist/dashboard/store", Pencil],
          ["Promote Artwork", "/artist/dashboard/promotions", Sparkles],
          ["View Messages", "/artist/dashboard/messages", MessageCircle],
          ["View Orders", "/artist/dashboard/orders", ShoppingBag],
          ["Manage Subscription", "/artist/dashboard/subscription", CreditCard],
        ].map(([label, href, Icon]) => {
          const ActionIcon = Icon as LucideIcon;
          return (
            <a
              key={label as string}
              href={href as string}
              className="flex min-h-20 flex-col justify-between rounded-xl bg-[var(--ivory)] p-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-sm"
            >
              <ActionIcon className="h-5 w-5 text-[var(--oxblood)]" />
              {label as string}
            </a>
          );
        })}
      </section>
      <PlanUpgradeCard planId={planId} role={role} />
    </div>
  );
}

function UnlockedGrowthTool({ title, body }: { title: string; body: string }) {
  return (
    <Panel>
      <div className="eyebrow">Unlocked with your plan</div>
      <h2 className="mt-3 font-display text-4xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{body}</p>
      <a href="/artist/dashboard/store" className="btn-primary mt-6">
        Configure store settings
      </a>
    </Panel>
  );
}

function PlanUpgradeCard({ planId, role }: { planId: PlanId; role: "artist" | "gallery" }) {
  const content =
    planId === "free"
      ? {
          title: "Upgrade to ArtDera Professional",
          body: "Get 200 listings, detailed analytics, promotional tools, a professional profile and more for only PKR 500/year.",
          action: "Upgrade for PKR 500/year",
          target: "professional",
        }
      : planId === "professional"
        ? {
            title: "Managing multiple artists and staff?",
            body: "Explore the Gallery Plan for managed artists, staff permissions, inventory, exhibitions, CRM and gallery reports. Your account is never converted automatically.",
            action: "Compare Gallery Plan",
            target: "gallery",
          }
        : {
            title: "Enterprise gallery support",
            body: "If your gallery reaches a fair-use or staff limit, contact ArtDera for an Enterprise Gallery Plan tailored to your programme.",
            action: "Request Enterprise Plan",
            target: "enterprise",
          };
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-8">
      <div className="eyebrow">{role === "gallery" ? "Gallery growth" : "Plan guidance"}</div>
      <h2 className="mt-3 font-display text-4xl">{content.title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{content.body}</p>
      <a
        href={
          content.target === "enterprise"
            ? "/artist/dashboard/support?topic=enterprise"
            : `/artist/dashboard/subscription?upgrade=${content.target}`
        }
        className="btn-primary mt-6"
      >
        {content.action}
      </a>
    </section>
  );
}

function ArtworkManager({ storeId, planId }: { storeId: string; planId: PlanId }) {
  const [editingArtwork, setEditingArtwork] = useState<Artwork | null>(null);
  const [items, setItems] = useState(() =>
    ArtworkService.forStore(storeId).length
      ? ArtworkService.forStore(storeId)
      : ARTWORKS.slice(0, 4),
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("Newest");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const filtered = useMemo(
    () =>
      items
        .filter(
          (item) =>
            (!query ||
              `${item.title} ${item.category} ${item.medium}`
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (status === "All" || item.status === status),
        )
        .sort((a, b) =>
          sort === "Price: high"
            ? b.price - a.price
            : sort === "Price: low"
              ? a.price - b.price
              : b.year - a.year,
        ),
    [items, query, sort, status],
  );
  const pageItems = filtered.slice((page - 1) * 6, page * 6);
  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  async function bulk(nextStatus: ArtworkStatus) {
    if (!selected.length) return toast.error("Select at least one artwork.");
    const result = await ArtworkService.updateMany(selected, nextStatus);
    if (result.error) return toast.error(result.error.message);
    const relevant = (result.data ?? []).filter((item) => item.storeId === storeId);
    setItems(
      relevant.length
        ? relevant
        : items.map((item) =>
            selected.includes(item.id) ? { ...item, status: nextStatus } : item,
          ),
    );
    setSelected([]);
    toast.success(`${selected.length} artwork${selected.length === 1 ? "" : "s"} updated`);
  }
  async function remove() {
    const result = await ArtworkService.deleteMany(selected);
    if (result.error) return toast.error(result.error.message);
    setItems((values) => values.filter((item) => !selected.includes(item.id)));
    setSelected([]);
    setConfirmDelete(false);
    toast.success("Artwork removed");
  }

  async function updateStatus(id: string, nextStatus: ArtworkStatus) {
    const result = await ArtworkService.updateMany([id], nextStatus);
    if (result.error) return toast.error(result.error.message);
    const relevant = (result.data ?? []).filter((item) => item.storeId === storeId);
    setItems(
      relevant.length
        ? relevant
        : items.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)),
    );
    toast.success("Artwork updated");
  }

  async function removeSingle(id: string) {
    const result = await ArtworkService.deleteMany([id]);
    if (result.error) return toast.error(result.error.message);
    setItems((values) => values.filter((item) => item.id !== id));
    toast.success("Artwork removed");
  }

  if (editingArtwork) {
    return (
      <AddArtwork
        storeId={storeId}
        planId={planId}
        initialArtwork={editingArtwork}
        onComplete={() => setEditingArtwork(null)}
      />
    );
  }

  return (
    <Panel>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search title, category or medium"
              className="art-field pl-11"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="art-field !w-auto"
            >
              {["All", ...ARTWORK_STATUSES].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="art-field !w-auto"
            >
              <option>Newest</option>
              <option>Price: high</option>
              <option>Price: low</option>
            </select>
            <div className="flex rounded-full border border-[var(--color-border)] p-1">
              <button
                onClick={() => setView("grid")}
                className={`rounded-full p-2 ${view === "grid" ? "bg-[var(--ink)] text-white" : ""}`}
                aria-label="Grid view"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("table")}
                className={`rounded-full p-2 ${view === "table" ? "bg-[var(--ink)] text-white" : ""}`}
                aria-label="Table view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--ivory)] p-3 text-xs">
            <strong className="mr-2">{selected.length} selected</strong>
            <button onClick={() => bulk("Published")} className="chip">
              Publish
            </button>
            <button onClick={() => bulk("Draft")} className="chip">
              Unpublish
            </button>
            <button onClick={() => bulk("Archived")} className="chip">
              Archive
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="chip !bg-red-50 !text-red-800"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                pageItems.length > 0 && pageItems.every((item) => selected.includes(item.id))
              }
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...new Set([...selected, ...pageItems.map((item) => item.id)])]
                    : selected.filter((id) => !pageItems.some((item) => item.id === id)),
                )
              }
              className="accent-[var(--oxblood)]"
            />{" "}
            Select this page
          </label>
          <span>{filtered.length} artworks</span>
        </div>
        {pageItems.length === 0 ? (
          <EmptyState
            icon={Palette}
            title="No artworks match those filters."
            body="Clear a filter or add a new artwork to your store."
            action={["Add Artwork", "/artist/dashboard/artworks/new"]}
          />
        ) : view === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((item) => (
              <ArtworkCard
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                onSelect={(checked) =>
                  setSelected((values) =>
                    checked ? [...values, item.id] : values.filter((id) => id !== item.id),
                  )
                }
                onEdit={() => setEditingArtwork(item)}
                onStatusChange={(status) => updateStatus(item.id, status)}
                onDelete={() => removeSingle(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-muted-foreground">
                  <th className="p-3">Select</th>
                  <th className="p-3">Artwork</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">Saves</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-border)]">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={(event) =>
                          setSelected((values) =>
                            event.target.checked
                              ? [...values, item.id]
                              : values.filter((id) => id !== item.id),
                          )
                        }
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.images[0].url}
                          alt=""
                          className="h-14 w-12 rounded object-cover"
                        />
                        <div>
                          <div className="font-semibold">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.medium}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{formatPKR(item.price)}</td>
                    <td className="p-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="p-3">{item.views}</td>
                    <td className="p-3">{item.saves}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditingArtwork(item)} className="btn-ghost px-3">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex h-9 w-9 items-center justify-center rounded border"
                              aria-label="More artwork actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.status === "Published" ? (
                              <DropdownMenuItem onClick={() => updateStatus(item.id, "Draft")}>
                                Unpublish
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => updateStatus(item.id, "Published")}>
                                Publish
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => updateStatus(item.id, "Archived")}>
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:bg-red-50 focus:text-red-600"
                              onClick={() => removeSingle(item.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="btn-ghost px-3 disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <button
            disabled={page === pages}
            onClick={() => setPage((value) => Math.min(pages, value + 1))}
            className="btn-ghost px-3 disabled:opacity-35"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="bg-[var(--porcelain)]">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">Delete selected artwork?</DialogTitle>
            <DialogDescription>
              This permanently removes {selected.length} draft record
              {selected.length === 1 ? "" : "s"}. Published artwork is archived by the API instead
              of being deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost">
              Cancel
            </button>
            <button onClick={remove} className="btn-primary !bg-[var(--destructive)]">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function ArtworkCard({
  item,
  selected,
  onSelect,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  item: Artwork;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit?: () => void;
  onStatusChange?: (status: ArtworkStatus) => void;
  onDelete?: () => void;
}) {
  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-[var(--porcelain)] ${selected ? "border-[var(--oxblood)] ring-1 ring-[var(--oxblood)]" : "border-[var(--color-border)]"}`}
    >
      <div className="relative">
        <img
          src={item.images[0].url}
          alt={item.images[0].alt}
          className="aspect-[4/3] w-full object-cover"
        />
        {item.sponsored && (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--porcelain)] px-2 py-1 text-[10px] font-bold">
            Sponsored
          </span>
        )}
        <label className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--porcelain)] shadow-sm">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
            className="accent-[var(--oxblood)]"
          />
          <span className="sr-only">Select {item.title}</span>
        </label>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl">{item.title}</h3>
            <div className="mt-1 text-xs text-muted-foreground">{formatPKR(item.price)}</div>
          </div>
          <StatusBadge status={item.status} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          {item.story?.text ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Story Added
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/70">
              + Add Story
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
          <span>
            <Eye className="mr-1 inline h-3 w-3" />
            {item.views}
          </span>
          <span>
            <Heart className="mr-1 inline h-3 w-3" />
            {item.saves}
          </span>
          <span>
            <MessageCircle className="mr-1 inline h-3 w-3" />
            {item.messages}
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onEdit} className="btn-ghost flex-1 px-3">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <a href={`/product/${item.slug}`} className="btn-ghost flex-1 px-3">
            <Eye className="h-3.5 w-3.5" /> Preview
          </a>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-11 w-11 items-center justify-center rounded-full border"
                aria-label="More artwork actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.status === "Published" ? (
                <DropdownMenuItem onClick={() => onStatusChange?.("Draft")}>
                  Unpublish
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onStatusChange?.("Published")}>
                  Publish
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onStatusChange?.("Archived")}>
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:bg-red-50 focus:text-red-600"
                onClick={onDelete}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}

function AddArtwork({
  storeId,
  planId,
  initialArtwork,
  onComplete,
}: {
  storeId: string;
  planId: PlanId;
  initialArtwork?: Artwork;
  onComplete?: () => void;
}) {
  const listingCount = ArtworkService.forStore(storeId).filter((item) =>
    ["Published", "Pending Review", "Reserved"].includes(item.status),
  ).length;
  const limit = PLANS[planId].listingLimit;
  const atLimit = limit !== null && listingCount >= limit;
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState("Not saved yet");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingLabel, setSubmittingLabel] = useState("");
  const [showPrompts, setShowPrompts] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [form, setForm] = useState(() =>
    initialArtwork
      ? {
          title: initialArtwork.title,
          description: initialArtwork.description,
          storyText: initialArtwork.story?.text ?? "",
          category: initialArtwork.category,
          medium: initialArtwork.medium,
          style: initialArtwork.style ?? "Contemporary",
          subject: initialArtwork.subject ?? "Abstract",
          year: String(initialArtwork.year),
          kind: initialArtwork.kind,
          price: String(initialArtwork.price),
          discount: initialArtwork.discountPrice ? String(initialArtwork.discountPrice) : "",
          quantity: String(initialArtwork.quantity),
          width: String(initialArtwork.dimensions.split(" × ")[0] || "60"),
          height: String(initialArtwork.dimensions.split(" × ")[1] || "76"),
          depth: String(initialArtwork.dimensions.split(" × ")[2] || "3"),
          weight: String(initialArtwork.weightKg || "2.5"),
          framed: initialArtwork.framed,
          domestic: initialArtwork.domesticShipping,
          international: initialArtwork.internationalShipping,
          certificate: initialArtwork.certificate,
          tags: initialArtwork.tags.join(", "),
          status: initialArtwork.status,
          imageUrl: initialArtwork.images[0]?.url ?? "",
        }
      : ArtworkDraftService.read({
          title: "",
          description: "",
          storyText: "",
          category: "Painting",
          medium: "Acrylic on canvas",
          style: "Contemporary",
          subject: "Landscape",
          year: "2026",
          kind: "Original" as Artwork["kind"],
          price: "",
          discount: "",
          quantity: "1",
          width: "60",
          height: "76",
          depth: "3",
          weight: "2.5",
          framed: false,
          domestic: true,
          international: false,
          certificate: true,
          tags: "abstract, contemporary",
          status: "Draft" as ArtworkStatus,
          imageUrl: "",
        }),
  );
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      if (!initialArtwork) ArtworkDraftService.save(form);
      setSaved(
        `Autosaved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      );
    }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, form, initialArtwork]);
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }
  async function submit(event: FormEvent, status: ArtworkStatus) {
    event.preventDefault();
    if (submitting) return;
    if (atLimit && status !== "Draft" && !initialArtwork)
      return toast.error(
        `You have used all ${limit} active listings included in the ${PLANS[planId].name} Plan. Save as draft, manage existing artworks or upgrade your plan.`,
      );
    if (!form.title || !Number(form.price))
      return toast.error("Add a title and valid price before saving.");
    if (status !== "Draft" && !form.imageUrl)
      return toast.error("Upload a main artwork image before submitting for review.");
    setSubmitting(true);
    setSubmittingLabel(
      status === "Draft"
        ? `Saving ${form.title || "artwork"} as a draft`
        : `Publishing ${form.title || "artwork"} for review`,
    );
    const artwork: Artwork = {
      id: initialArtwork ? initialArtwork.id : `art-${Date.now()}`,
      storeId,
      creatorName: initialArtwork?.creatorName ?? "Your Studio",
      slug:
        initialArtwork?.slug ??
        form.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      title: form.title,
      description: form.description,
      story: form.storyText.trim()
        ? { text: form.storyText.trim(), updatedAt: new Date().toISOString() }
        : undefined,
      category: form.category,
      medium: form.medium,
      style: form.style,
      subject: form.subject,
      year: Number(form.year),
      kind: form.kind,
      price: Number(form.price),
      discountPrice: form.discount ? Number(form.discount) : undefined,
      dimensions: `${form.width} × ${form.height} × ${form.depth} inches`,
      weightKg: Number(form.weight),
      framed: form.framed,
      orientation: Number(form.width) > Number(form.height) ? "Landscape" : "Portrait",
      images: form.imageUrl
        ? [{ id: `image-${Date.now()}`, url: form.imageUrl, alt: form.title, isPrimary: true }]
        : [],
      status,
      quantity: Number(form.quantity),
      domesticShipping: form.domestic,
      internationalShipping: form.international,
      certificate: form.certificate,
      tags: form.tags
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      customOrders: false,
      views: initialArtwork?.views ?? 0,
      saves: initialArtwork?.saves ?? 0,
      messages: initialArtwork?.messages ?? 0,
      sponsored: initialArtwork?.sponsored ?? false,
    };
    const result = await ArtworkService.save(artwork);
    setSubmitting(false);
    setSubmittingLabel("");
    if (result.error) return toast.error(result.error.message);
    setDirty(false);
    if (!initialArtwork) ArtworkDraftService.clear();
    toast.success(
      status === "Draft" ? "Artwork saved as draft" : "Your artwork has been published",
      {
        description:
          status === "Draft" ? "You can keep editing it from Artworks." : "Admin will approve it.",
      },
    );
    if (onComplete) onComplete();
  }
  return (
    <form onSubmit={(event) => void submit(event, "Pending Review")} className="space-y-5">
      {atLimit && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-display text-2xl">Your active listing space is full.</h2>
              <p className="mt-2 text-sm leading-relaxed">
                You have used all {limit} active listings included in the {PLANS[planId].name}
                Plan. Nothing will be deleted. You can still complete this form and save it as a
                draft.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/artist/dashboard/subscription" className="btn-primary">
                  Upgrade Plan
                </a>
                <a href="/artist/dashboard/artworks" className="btn-ghost">
                  Manage Existing Artworks
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4 sm:flex-row sm:items-center">
        <div>
          <div className="text-sm font-semibold">
            {listingCount} of {limit ?? "fair-use unlimited"} active listings
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{saved}</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={submitting || uploading}
            onClick={(event) => void submit(event as unknown as FormEvent, "Draft")}
            className="btn-ghost"
          >
            {submitting && submittingLabel.startsWith("Saving")
              ? `${submittingLabel}…`
              : "Save draft"}
          </button>
          <button
            disabled={atLimit || submitting || uploading}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting && submittingLabel.startsWith("Publishing")
              ? `${submittingLabel}…`
              : "Publish for review"}
          </button>
        </div>
      </div>
      <FormSection
        title="Basic information"
        description="Help buyers understand the work at a glance."
      >
        <FormGrid>
          <DashboardField label="Artwork title">
            <input
              className="art-field"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
            />
          </DashboardField>
          <DashboardField label="Year created">
            <input
              type="number"
              className="art-field"
              value={form.year}
              onChange={(event) => set("year", event.target.value)}
            />
          </DashboardField>
          <DashboardField label="Artwork Description (Technical details)" wide>
            <textarea
              rows={4}
              placeholder="Technical specifications, finishing, framing, physical details, edition or condition..."
              className="art-field !rounded-xl"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </DashboardField>
          <DashboardField label="Category">
            <select
              className="art-field"
              value={form.category}
              onChange={(event) => set("category", event.target.value)}
            >
              {CATEGORIES_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </DashboardField>
          <DashboardField label="Medium">
            <input
              className="art-field"
              value={form.medium}
              onChange={(event) => set("medium", event.target.value)}
            />
          </DashboardField>
          <DashboardField label="Style">
            <select
              className="art-field"
              value={form.style}
              onChange={(event) => set("style", event.target.value)}
            >
              {STYLES_LIST.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </DashboardField>
          <DashboardField label="Subject">
            <select
              className="art-field"
              value={form.subject}
              onChange={(event) => set("subject", event.target.value)}
            >
              {SUBJECTS_LIST.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </DashboardField>
        </FormGrid>
      </FormSection>

      <FormSection
        title="The Story Behind the Work"
        description="Every artwork begins somewhere. Tell collectors where this one began."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-4 text-xs leading-relaxed text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">
              ✨ Share the inspiration, memory, emotion, person, place or moment behind your work.
            </div>
            <p>
              While the <span className="font-semibold text-foreground">Artwork Description</span>{" "}
              above contains factual product details (medium, dimensions, framing), your{" "}
              <span className="font-semibold text-foreground">Story</span> builds a personal,
              emotional connection with collectors before they collect your art.
            </p>
          </div>

          <DashboardField label="Tell the story behind your artwork" wide>
            <div className="relative">
              <textarea
                rows={6}
                maxLength={2000}
                placeholder="What inspired this work? Was there a particular memory, person, place, experience or feeling behind it? What would you like someone to feel when they see it?"
                className="art-field !rounded-xl text-sm leading-relaxed p-3.5 focus:ring-1 focus:ring-[var(--oxblood)]"
                value={form.storyText}
                onChange={(event) => set("storyText", event.target.value)}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span
                  className={
                    form.storyText.length > 0 && form.storyText.length < 80 ? "text-amber-700" : ""
                  }
                >
                  {form.storyText.length < 80 && form.storyText.length > 0
                    ? "Recommended length: ~80–100+ characters for best collector engagement."
                    : "Optional · Recommended minimum: 80 characters (Max: 2,000)"}
                </span>
                <span className="font-mono font-medium">
                  {form.storyText.length} / 2000 characters
                </span>
              </div>
            </div>
          </DashboardField>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4">
            <button
              type="button"
              onClick={() => setShowPrompts((val) => !val)}
              className="flex w-full items-center justify-between text-xs font-semibold text-[var(--oxblood)] hover:underline"
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Need inspiration?
              </span>
              <span>{showPrompts ? "Hide prompts ↑" : "Show prompts ↓"}</span>
            </button>

            {showPrompts && (
              <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Click any prompt to append it to your story:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    "Where did the idea for this artwork begin?",
                    "Is there a memory behind it?",
                    "Did a person or place inspire it?",
                    "Why did you choose these colors, materials or subjects?",
                    "What emotion were you experiencing while creating it?",
                    "What would you like the viewer to feel?",
                    "Does this artwork represent something personal or cultural?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        const next = form.storyText
                          ? `${form.storyText}\n\n${prompt} `
                          : `${prompt} `;
                        set("storyText", next.slice(0, 2000));
                      }}
                      className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-[11px] font-medium text-foreground hover:border-[var(--oxblood)] hover:bg-[var(--ivory)] transition text-left"
                    >
                      + {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="btn-ghost text-xs !py-2 !px-3 inline-flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5 text-[var(--oxblood)]" /> Preview how buyers see it
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--porcelain)] p-6 rounded-2xl">
                <DialogHeader>
                  <div className="eyebrow !text-[var(--oxblood)]">Live Buyer Preview</div>
                  <DialogTitle className="font-display text-2xl">
                    How collectors will see your story
                  </DialogTitle>
                </DialogHeader>

                <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-6">
                  <div className="eyebrow tracking-widest text-[var(--oxblood)]">
                    Editorial Spotlight
                  </div>
                  <h3 className="mt-1 font-display text-2xl text-[var(--ink)]">
                    The Story Behind the Work
                  </h3>
                  <div className="my-3 h-0.5 w-12 bg-[var(--oxblood)]/30" />
                  {form.storyText.trim() ? (
                    <blockquote className="font-serif text-base leading-relaxed text-[var(--ink)] italic whitespace-pre-line">
                      “{form.storyText.trim()}”
                    </blockquote>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      (Your artwork story will appear here once you write one above.)
                    </p>
                  )}
                  <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-xs">
                    <div className="font-display font-semibold text-[var(--ink)]">
                      — {form.title || "Untitled Artwork"} Creator
                    </div>
                    <span className="text-[var(--oxblood)] font-medium">View Artist Profile →</span>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="btn-primary"
                  >
                    Close Preview
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </FormSection>
      <FormSection
        title="Images and video"
        description="Upload the main image buyers will see. Files are validated before secure storage."
      >
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          {form.imageUrl ? (
            <img
              src={form.imageUrl}
              alt="Artwork upload preview"
              className="aspect-[4/5] w-full rounded-xl object-cover"
            />
          ) : (
            <div className="flex aspect-[4/5] w-full items-center justify-center rounded-xl bg-[var(--ivory)] text-xs text-muted-foreground">
              No image uploaded
            </div>
          )}
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] text-center">
            <ImagePlus className="h-6 w-6 text-[var(--oxblood)]" />
            <span className="mt-3 text-sm font-semibold">
              {uploading ? "Uploading image…" : "Add main image"}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              JPG, PNG or WebP · up to 5 MB
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void (async () => {
                  setUploading(true);
                  const result = await UploadService.upload(file, "artwork");
                  setUploading(false);
                  if (result.error) return toast.error(result.error.message);
                  if (result.data) {
                    set("imageUrl", result.data.url);
                    toast.success("Artwork image uploaded");
                  }
                })();
              }}
            />
          </label>
        </div>
      </FormSection>
      <FormSection
        title="Pricing and inventory"
        description="Set one clear price and the available quantity."
      >
        <FormGrid>
          <DashboardField label="Price (Rs.)">
            <input
              inputMode="numeric"
              className="art-field"
              value={form.price}
              onChange={(event) => set("price", event.target.value.replace(/\D/g, ""))}
            />
          </DashboardField>
          <DashboardField label="Discount price, optional">
            <input
              inputMode="numeric"
              className="art-field"
              value={form.discount}
              onChange={(event) => set("discount", event.target.value.replace(/\D/g, ""))}
            />
          </DashboardField>
          <DashboardField label="Original or print">
            <select
              className="art-field"
              value={form.kind}
              onChange={(event) => set("kind", event.target.value as Artwork["kind"])}
            >
              <option>Original</option>
              <option>Print</option>
              <option>Limited Edition</option>
            </select>
          </DashboardField>
          <DashboardField label="Quantity">
            <input
              type="number"
              min="1"
              className="art-field"
              value={form.quantity}
              onChange={(event) => set("quantity", event.target.value)}
            />
          </DashboardField>
        </FormGrid>
      </FormSection>
      <FormSection
        title="Size, framing and shipping"
        description="Accurate dimensions produce better shipping estimates."
      >
        <FormGrid>
          {(
            [
              ["width", "Width (inches)"],
              ["height", "Height (inches)"],
              ["depth", "Depth (inches)"],
              ["weight", "Weight (kg)"],
            ] as const
          ).map(([key, label]) => (
            <DashboardField key={key} label={label}>
              <input
                type="number"
                step="0.1"
                className="art-field"
                value={form[key]}
                onChange={(event) => set(key, event.target.value)}
              />
            </DashboardField>
          ))}
          <DashboardToggle
            label="Framed"
            checked={form.framed}
            onChange={(value) => set("framed", value)}
          />
          <DashboardToggle
            label="Domestic shipping"
            checked={form.domestic}
            onChange={(value) => set("domestic", value)}
          />
          <div className="sm:col-span-2">
            <DashboardToggle
              label="International shipping"
              checked={form.international}
              onChange={(value) => set("international", value)}
            />
            {form.international && (
              <p className="mt-2 text-xs text-muted-foreground ml-14">
                International buyers will be able to request shipping quotes. ArtDera handles the
                logistics calculation and you will be notified when a quote is approved.
              </p>
            )}
          </div>
          <DashboardToggle
            label="Certificate of authenticity"
            checked={form.certificate}
            onChange={(value) => set("certificate", value)}
          />
        </FormGrid>
      </FormSection>
      <FormSection
        title="Search tags and review"
        description="Use specific, accurate words separated by commas."
      >
        <DashboardField label="Search tags">
          <input
            className="art-field"
            value={form.tags}
            onChange={(event) => set("tags", event.target.value)}
          />
        </DashboardField>
        <div className="mt-5 grid gap-4 rounded-xl bg-[var(--ivory)] p-4 sm:grid-cols-[100px_1fr]">
          <img
            src={IMAGES.art1}
            alt="Listing preview"
            className="aspect-[4/5] w-full rounded-lg object-cover"
          />
          <div>
            <div className="eyebrow">Listing preview</div>
            <div className="mt-2 font-display text-2xl">{form.title || "Untitled artwork"}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {form.medium} · {form.width} × {form.height} inches
            </div>
            <div className="mt-3 font-semibold">
              {form.price ? formatPKR(Number(form.price)) : "Add a price"}
            </div>
          </div>
        </div>
      </FormSection>
    </form>
  );
}

function StoreManager({ storeId, storeSlug }: { storeId: string; storeSlug: string }) {
  const store = StoreService.list().find((item) => item.id === storeId) ?? STORES[0];
  const [name, setName] = useState(store.name);
  const [tagline, setTagline] = useState(store.tagline);
  const [bio, setBio] = useState(store.bio);
  const [categories, setCategories] = useState(store.categories.join(", "));
  const [mediums, setMediums] = useState(store.mediums.join(", "));
  const [slug, setSlug] = useState(store.slug);
  const [slugEditing, setSlugEditing] = useState(false);
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [saving, setSaving] = useState(false);

  // Normalize slug: lowercase alphanumeric and hyphens only, max 60 chars
  function normalizeSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  // Debounced slug availability check
  useEffect(() => {
    if (!slugEditing) return;
    const trimmed = slug.trim();
    if (trimmed === store.slug) {
      setSlugStatus("idle");
      return;
    }
    if (trimmed.length < 3) {
      setSlugStatus("invalid");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(trimmed)) {
      setSlugStatus("invalid");
      return;
    }
    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      const result = await StoreService.slugAvailable(trimmed);
      if (result.data) {
        setSlugStatus(result.data.available ? "available" : "taken");
      } else {
        setSlugStatus("idle");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [slug, slugEditing, store.slug]);

  const slugOk = slugStatus === "idle" || slugStatus === "available";
  const slugChanged = slug.trim() !== store.slug;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Panel>
        <div className="eyebrow">Store details</div>
        <h2 className="mt-2 font-display text-3xl">Edit the story buyers see.</h2>
        <div className="mt-6 grid gap-5">
          <DashboardField label="Store name">
            <input
              className="art-field"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </DashboardField>

          {/* ── Store URL (slug) editor ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="eyebrow">Store URL</span>
              {!slugEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setSlugEditing(true);
                    setSlugStatus("idle");
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--ivory)] border border-[var(--color-border)] px-3 py-1 text-[11px] font-semibold text-[var(--oxblood)] hover:bg-[var(--porcelain)] transition"
                >
                  <Pencil className="h-3 w-3" /> Edit URL
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSlugEditing(false);
                    setSlug(store.slug);
                    setSlugStatus("idle");
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--ivory)] border border-[var(--color-border)] px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-[var(--porcelain)] transition"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>

            {!slugEditing ? (
              <div className="art-field bg-[var(--ivory)] text-muted-foreground select-all">
                artdera.com/store/
                <span className="font-semibold text-foreground">{store.slug}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`flex items-center rounded-xl border transition ${
                    slugStatus === "available"
                      ? "border-emerald-400 ring-1 ring-emerald-200"
                      : slugStatus === "taken" || slugStatus === "invalid"
                        ? "border-red-400 ring-1 ring-red-200"
                        : "border-[var(--color-border)]"
                  } overflow-hidden bg-white`}
                >
                  <span className="shrink-0 pl-4 text-sm text-muted-foreground select-none">
                    artdera.com/store/
                  </span>
                  <input
                    className="flex-1 bg-transparent py-3 pr-4 text-sm font-semibold outline-none"
                    value={slug}
                    autoFocus
                    spellCheck={false}
                    placeholder="your-store-name"
                    onChange={(event) => {
                      setSlug(normalizeSlug(event.target.value));
                      setSlugStatus("idle");
                    }}
                  />
                  <span className="shrink-0 pr-3">
                    {slugStatus === "checking" && (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--oxblood)] border-t-transparent" />
                    )}
                    {slugStatus === "available" && <Check className="h-4 w-4 text-emerald-500" />}
                    {(slugStatus === "taken" || slugStatus === "invalid") && (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </span>
                </div>
                <p
                  className={`text-xs ${
                    slugStatus === "available"
                      ? "text-emerald-600"
                      : slugStatus === "taken"
                        ? "text-red-600"
                        : slugStatus === "invalid"
                          ? "text-red-600"
                          : "text-muted-foreground"
                  }`}
                >
                  {slugStatus === "available" && "✓ This URL is available"}
                  {slugStatus === "taken" && "✗ This URL is already in use — try another"}
                  {slugStatus === "invalid" &&
                    "✗ Use 3–60 lowercase letters, numbers, or hyphens (no leading/trailing hyphens)"}
                  {(slugStatus === "idle" || slugStatus === "checking") &&
                    !slugChanged &&
                    "Lowercase letters, numbers and hyphens only · e.g. sara-ahmed-art"}
                  {slugStatus === "checking" && "Checking availability…"}
                  {slugStatus === "idle" && slugChanged && "Checking…"}
                </p>
                {slugChanged && slugStatus === "available" && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Changing your URL will break any existing links to your store. Make sure to
                      update any links you've shared.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DashboardField label="Tagline">
            <input
              className="art-field"
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
            />
          </DashboardField>
          <DashboardField label="Short biography">
            <textarea
              rows={4}
              className="art-field !rounded-xl"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </DashboardField>
          <div className="grid gap-3 sm:grid-cols-2">
            <DashboardField label="Main categories">
              <input
                className="art-field"
                value={categories}
                onChange={(event) => setCategories(event.target.value)}
              />
            </DashboardField>
            <DashboardField label="Mediums">
              <input
                className="art-field"
                value={mediums}
                onChange={(event) => setMediums(event.target.value)}
              />
            </DashboardField>
          </div>
          <button
            disabled={
              saving ||
              (slugChanged && !slugOk) ||
              slugStatus === "taken" ||
              slugStatus === "invalid" ||
              slugStatus === "checking"
            }
            onClick={() =>
              void (async () => {
                setSaving(true);
                const result = await StoreService.save({
                  ...store,
                  name: name.trim(),
                  slug: slug.trim(),
                  tagline,
                  bio,
                  categories: categories
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                  mediums: mediums
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                });
                setSaving(false);
                if (result.error) {
                  toast.error(result.error.message);
                } else {
                  toast.success("Store changes saved");
                  setSlugEditing(false);
                  setSlugStatus("idle");
                  // Navigate to new URL if slug changed
                  if (slugChanged && result.data?.slug) {
                    window.location.href = "/artist/dashboard/store";
                  }
                }
              })()
            }
            className="btn-primary justify-self-start disabled:opacity-45"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Panel>
      <aside className="h-fit overflow-hidden rounded-2xl bg-[var(--ink)] text-[var(--ivory)] xl:sticky xl:top-28">
        <img
          src={store.coverImage}
          alt="Store cover"
          className="h-40 w-full object-cover opacity-65"
        />
        <div className="p-5">
          <img
            src={store.profileImage}
            alt=""
            className="-mt-14 h-20 w-20 rounded-full border-4 border-[var(--ink)] object-cover"
          />
          <h3 className="mt-4 font-display text-3xl">{name}</h3>
          <p className="mt-2 text-xs leading-relaxed text-white/60">{tagline}</p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-white/50 break-all">
            <Store className="h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
            artdera.com/store/
            <span className="text-white/80 font-semibold">{slug || store.slug}</span>
          </div>
          <a
            href={`/store/${storeSlug}`}
            className="btn-ghost mt-5 w-full !border-white/20 !text-white"
          >
            <Eye className="h-4 w-4" /> Open public preview
          </a>
        </div>
      </aside>
    </div>
  );
}

function OrdersManager({ userId }: { userId: string }) {
  const sellerOrders = ORDERS.filter((order) => order.sellerId === userId);
  const [statuses, setStatuses] = useState<Record<string, OrderStatus>>(
    Object.fromEntries(sellerOrders.map((order) => [order.id, order.status])),
  );
  const [active, setActive] = useState(sellerOrders[0]);
  const nextStatus = (current: OrderStatus): OrderStatus =>
    current === "Paid" || current === "Payment Confirmed"
      ? "Seller Confirmed"
      : current === "Seller Confirmed"
        ? "Preparing"
        : current === "Preparing"
          ? "Ready for Pickup"
          : current === "Ready for Pickup"
            ? "Shipped"
            : current;
  if (!active)
    return (
      <Panel>
        <div className="eyebrow">Orders</div>
        <h2 className="mt-3 font-display text-3xl">No orders yet.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Paid marketplace orders will appear here.
        </p>
      </Panel>
    );
  return (
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Orders</div>
            <h2 className="mt-2 font-display text-3xl">{sellerOrders.length} recent orders</h2>
          </div>
          <select className="art-field !w-auto">
            <option>All statuses</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="mt-5 space-y-3">
          {sellerOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => setActive(order)}
              className={`w-full rounded-xl border p-4 text-left ${active.id === order.id ? "border-[var(--oxblood)] bg-[var(--ivory)]" : "border-[var(--color-border)]"}`}
            >
              <div className="flex gap-3">
                <img src={order.items[0].image} alt="" className="h-16 w-14 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="truncate text-sm">{order.orderNumber}</strong>
                    <StatusBadge status={statuses[order.id]} />
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {order.items[0].title} · {order.deliveryCity}
                  </div>
                  <div className="mt-2 text-sm font-semibold">{formatPKR(order.total)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Panel>
      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="eyebrow">{active.orderNumber}</div>
            <h2 className="mt-2 font-display text-3xl">{active.items[0].title}</h2>
            <div className="mt-2 text-xs text-muted-foreground">
              Placed {active.createdAt} · Buyer: Hamza A.
            </div>
          </div>
          <StatusBadge status={statuses[active.id]} />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Order amount", active.subtotal],
            ["Commission", -active.commission],
            ["Shipping", active.shipping],
            ["Estimated payout", active.subtotal - active.commission],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl bg-[var(--ivory)] p-4">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="mt-2 font-semibold">{formatPKR(Number(value))}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-[var(--oxblood)]" /> Delivery address
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Delivery city: {active.deliveryCity}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Full delivery contact is kept server-side and becomes available only to eligible order
            participants.
          </p>
        </div>
        <div className="mt-6">
          <div className="eyebrow">Timeline</div>
          <ol className="mt-4 grid gap-3">
            {[
              "Payment Confirmed",
              "Seller Confirmed",
              "Preparing",
              "Ready for Pickup",
              "Shipped",
              "Delivered",
            ].map((value, index) => (
              <li key={value} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${index < 3 ? "bg-[var(--success)] text-white" : "bg-[var(--ivory)] text-muted-foreground"}`}
                >
                  {index < 3 ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                {value}
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-7 flex flex-wrap gap-2">
          <button
            onClick={() =>
              void (async () => {
                const next = nextStatus(statuses[active.id]);
                if (next === statuses[active.id])
                  return toast.info("No seller transition is currently available.");
                const result = await OrderService.updateStatus(active.id, next);
                if (result.error) return toast.error(result.error.message);
                setStatuses((current) => ({ ...current, [active.id]: next }));
                toast.success(`Order marked ${next}`);
              })()
            }
            className="btn-primary"
          >
            <PackageCheck className="h-4 w-4" /> Mark as {nextStatus(statuses[active.id])}
          </button>
          <button
            onClick={() =>
              void OrderService.updateShipping(active.id, {
                courier: "Seller-arranged courier",
                status: "awaiting_pickup",
              }).then((result) =>
                result.error
                  ? toast.error(result.error.message)
                  : toast.success("Pickup status saved"),
              )
            }
            className="btn-ghost"
          >
            <Truck className="h-4 w-4" /> Request pickup
          </button>
          <button onClick={() => window.print()} className="btn-ghost">
            <ReceiptText className="h-4 w-4" /> Print invoice
          </button>
          <button onClick={() => window.print()} className="btn-ghost">
            <FileText className="h-4 w-4" /> Packing slip
          </button>
        </div>
      </Panel>
    </div>
  );
}

function MessageCenter() {
  const { user } = useAuth();
  const sellerConversations = CONVERSATIONS.filter(
    (conversation) => conversation.sellerId === user?.id,
  );
  const [active, setActive] = useState(() => sellerConversations[0]?.id ?? "");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    mimeType: string;
    size: number;
  } | null>(null);
  const [offers, setOffers] = useState<Array<Record<string, any>>>([]);
  const messages = MESSAGES.filter((message) => message.conversationId === active);
  const warning = containsProtectedContact(text);
  const filteredConversations = sellerConversations.filter((conversation) => {
    const artwork = ARTWORKS.find((item) => item.id === conversation.artworkId);
    const query = search.trim().toLowerCase();
    return (
      !query ||
      `${artwork?.title ?? "store enquiry"} ${conversation.status}`.toLowerCase().includes(query)
    );
  });
  useEffect(() => {
    void MessageService.listConversations().then((result) => {
      const firstSellerConversation = result.data?.find(
        (conversation) => conversation.sellerId === user?.id,
      );
      if (firstSellerConversation) setActive((current) => current || firstSellerConversation.id);
    });
  }, [user?.id]);
  useEffect(() => {
    if (!active) return;
    void MessageService.getConversation(active).then((result) => {
      if (result.data) setOffers(result.data.offers);
    });
  }, [active]);
  async function send() {
    if (!text.trim() && !attachment) return;
    if (warning)
      return toast.error(
        "Keep contact and payment details inside ArtDera until an order is confirmed.",
      );
    const result = await MessageService.send(active, text, attachment ?? undefined);
    if (result.error) return toast.error(result.error.message);
    toast.success("Message sent");
    setText("");
    setAttachment(null);
  }
  async function changeStatus(action: "archive" | "block" | "report", label: string) {
    const result = await MessageService.changeStatus(active, action);
    if (result.error) return toast.error(result.error.message);
    if (result.data) {
      const index = CONVERSATIONS.findIndex((item) => item.id === result.data!.id);
      if (index >= 0) CONVERSATIONS[index] = result.data;
    }
    toast.success(label);
  }
  if (!sellerConversations.length)
    return (
      <Panel>
        <div className="eyebrow">Messages</div>
        <h2 className="mt-3 font-display text-3xl">No conversations yet.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Buyer questions and offers will appear here.
        </p>
      </Panel>
    );
  const currentConversation =
    sellerConversations.find((conversation) => conversation.id === active) ??
    sellerConversations[0];
  const currentArtwork = ARTWORKS.find((artwork) => artwork.id === currentConversation.artworkId);
  return (
    <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] lg:grid-cols-[320px_1fr]">
      <aside className="border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="art-field pl-10"
              placeholder="Search conversations"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {filteredConversations.map((conversation) => {
            const artwork = ARTWORKS.find((item) => item.id === conversation.artworkId);
            return (
              <button
                key={conversation.id}
                onClick={() => setActive(conversation.id)}
                className={`flex w-full gap-3 p-4 text-left ${active === conversation.id ? "bg-[var(--ivory)]" : ""}`}
              >
                {artwork?.images[0] && (
                  <img
                    src={artwork.images[0].url}
                    alt=""
                    className="h-14 w-12 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-semibold">Marketplace buyer</span>
                    {conversation.unreadCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--oxblood)] text-[10px] text-white">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {artwork?.title ?? "Store enquiry"}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    {conversation.status}
                  </div>
                </div>
              </button>
            );
          })}
          {!filteredConversations.length && (
            <p className="p-5 text-sm text-muted-foreground">No conversations match that search.</p>
          )}
        </div>
      </aside>
      <main className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <div className="flex items-center gap-3">
            {currentArtwork?.images[0] && (
              <img
                src={currentArtwork.images[0].url}
                alt=""
                className="h-11 w-11 rounded-lg object-cover"
              />
            )}
            <div>
              <div className="text-sm font-semibold">Protected conversation</div>
              <div className="text-xs text-muted-foreground">
                {currentArtwork ? `About ${currentArtwork.title}` : "Store enquiry"}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--ivory)]"
              aria-label="Conversation options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-white/30 p-4 md:p-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[82%] rounded-2xl p-4 text-sm leading-relaxed ${message.senderId === user?.id ? "ml-auto bg-[var(--ink)] text-[var(--ivory)]" : "bg-[var(--ivory)]"}`}
            >
              {message.body}
              {message.attachments?.map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block font-semibold underline"
                >
                  {item.name}
                </a>
              ))}
              <div
                className={`mt-2 text-[10px] ${message.senderId === user?.id ? "text-white/45" : "text-muted-foreground"}`}
              >
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
          {offers.map((offer) => (
            <div
              key={String(offer.id)}
              className="max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4"
            >
              <div className="eyebrow">Offer</div>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="font-display text-2xl">{formatPKR(Number(offer.amount))}</div>
                  <div className="text-xs text-muted-foreground">
                    for {currentArtwork?.title ?? "artwork"}
                  </div>
                </div>
                <StatusBadge status={String(offer.status)} />
              </div>
              {offer.status === "Pending" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      void MessageService.updateOffer(String(offer.id), "accept").then((result) => {
                        if (result.error) toast.error(result.error.message);
                        else {
                          setOffers((items) =>
                            items.map((item) =>
                              item.id === offer.id ? { ...item, status: "Accepted" } : item,
                            ),
                          );
                          toast.success("Offer accepted");
                        }
                      })
                    }
                    className="btn-primary px-3"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() =>
                      void (async () => {
                        const amount = Number(window.prompt("Counter price in PKR"));
                        if (!amount) return;
                        const result = await MessageService.updateOffer(
                          String(offer.id),
                          "counter",
                          amount,
                        );
                        result.error
                          ? toast.error(result.error.message)
                          : setOffers((items) =>
                              items.map((item) =>
                                item.id === offer.id ? { ...item, status: "Countered" } : item,
                              ),
                            );
                      })()
                    }
                    className="btn-ghost px-3"
                  >
                    Counter
                  </button>
                  <button
                    onClick={() =>
                      void MessageService.updateOffer(String(offer.id), "reject").then((result) =>
                        result.error
                          ? toast.error(result.error.message)
                          : setOffers((items) =>
                              items.map((item) =>
                                item.id === offer.id ? { ...item, status: "Rejected" } : item,
                              ),
                            ),
                      )
                    }
                    className="btn-ghost px-3"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--color-border)] p-4">
          {warning && (
            <div className="mb-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Please do not share phone numbers, email, WhatsApp or external payment links before a
              confirmed order.
            </div>
          )}
          {attachment && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-[var(--ivory)] px-3 py-2 text-xs">
              <span className="truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <label
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
              aria-label="Attach a file"
            >
              <Plus className="h-4 w-4" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={uploadingAttachment}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void (async () => {
                    setUploadingAttachment(true);
                    const result = await UploadService.upload(file, "message");
                    setUploadingAttachment(false);
                    if (result.error) return toast.error(result.error.message);
                    if (result.data)
                      setAttachment({
                        url: result.data.url,
                        name: file.name,
                        mimeType: result.data.mimeType,
                        size: result.data.size,
                      });
                  })();
                }}
              />
            </label>
            <label className="sr-only" htmlFor="seller-message">
              Write a message
            </label>
            <textarea
              id="seller-message"
              rows={2}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write a message…"
              className="art-field !rounded-xl"
            />
            <button
              disabled={uploadingAttachment}
              onClick={() => void send()}
              className="btn-primary self-end disabled:opacity-45"
            >
              {uploadingAttachment ? "Uploading…" : "Send"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <button onClick={() => void changeStatus("report", "Conversation reported")}>
              Report conversation
            </button>
            <button onClick={() => void changeStatus("block", "Conversation blocked")}>
              Block buyer
            </button>
            <button onClick={() => void changeStatus("archive", "Conversation archived")}>
              Archive
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Customers({ planId }: { planId: PlanId }) {
  const [customers, setCustomers] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (planId === "free") return;
    void CustomerService.list().then((result) => {
      if (result.data) setCustomers(result.data as Array<Record<string, any>>);
      else if (result.error) toast.error(result.error.message);
      setLoading(false);
    });
  }, [planId]);
  if (planId === "free")
    return (
      <UpgradePanel
        title="Customer management is included with ArtDera Professional."
        body="Organise collectors, private notes, tags and consent-aware follow-ups. Contact details remain protected until an order is completed."
      />
    );
  return (
    <Panel>
      <PrivacyNotice />
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs text-muted-foreground">
              {[
                "Customer",
                "Orders",
                "Spending",
                "Last purchase",
                "Favourite",
                "Location",
                "Consent",
                "Action",
              ].map((value) => (
                <th key={value} className="p-3">
                  {value}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-[var(--color-border)]">
                <td className="p-3">
                  <strong>{customer.buyerName}</strong>
                  <div className="mt-1 flex gap-1">
                    {(customer.tags ?? []).map((tag: string) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3">{customer.completedOrders}</td>
                <td className="p-3">{formatPKR(customer.totalSpending)}</td>
                <td className="p-3">{customer.lastPurchase}</td>
                <td className="p-3">{customer.favouriteCategory}</td>
                <td className="p-3">{customer.city}</td>
                <td className="p-3">
                  <StatusBadge status={customer.marketingConsent ? "Consented" : "No consent"} />
                </td>
                <td className="p-3">
                  <button onClick={() => toast.info(customer.notes)} className="btn-ghost px-3">
                    Notes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <p className="mt-5 text-sm text-muted-foreground">Loading customers…</p>}
      {!loading && !customers.length && (
        <p className="mt-5 text-sm text-muted-foreground">
          Customers appear after a completed marketplace order.
        </p>
      )}
    </Panel>
  );
}

function Analytics({ planId }: { planId: PlanId }) {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [chartData, setChartData] = useState<Array<Record<string, string | number>>>([]);
  useEffect(() => {
    void AnalyticsService.get("30d").then((result) => {
      if (!result.data) {
        if (result.error) toast.error(result.error.message);
        return;
      }
      setMetrics(result.data.metrics);
      const byDate = new Map<string, Record<string, string | number>>();
      for (const point of result.data.series) {
        const date = point._id.date;
        const row = byDate.get(date) ?? { date, storeViews: 0, artworkViews: 0 };
        if (point._id.type === "store_view") row.storeViews = point.count;
        if (point._id.type === "artwork_view") row.artworkViews = point.count;
        byDate.set(date, row);
      }
      setChartData([...byDate.values()]);
    });
  }, []);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Store views", metrics.storeViews ?? 0, "Last 30 days"],
          ["Artwork views", metrics.artworkViews ?? 0, "Last 30 days"],
          ["Unique visitors", metrics.uniqueVisitors ?? 0, "Last 30 days"],
          ["Revenue", formatPKR(metrics.revenue ?? 0), `${metrics.orders ?? 0} orders`],
        ].map(([label, value, change]) => (
          <Metric
            key={label as string}
            label={label as string}
            value={String(value)}
            change={change as string}
          />
        ))}
      </div>
      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="eyebrow">Last 7 days</div>
            <h2 className="mt-2 font-display text-3xl">Store and artwork attention</h2>
          </div>
          <span className="chip">{PLANS[planId].analytics} analytics</span>
        </div>
        <div className="mt-6 h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="storeAnalytics" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#263454" stopOpacity={0.35} />
                  <stop offset="1" stopColor="#263454" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#ddd4c7" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => value.slice(5)}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="artworkViews"
                stroke="#263454"
                strokeWidth={2}
                fill="url(#storeAnalytics)"
              />
              <Area
                type="monotone"
                dataKey="storeViews"
                stroke="#b65f42"
                strokeWidth={2}
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      {planId !== "free" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel>
            <div className="eyebrow">Top artworks</div>
            <div className="mt-5 space-y-3">
              {ARTWORKS.slice(0, 4).map((artwork, index) => (
                <div
                  key={artwork.id}
                  className="grid grid-cols-[30px_52px_1fr_auto] items-center gap-3"
                >
                  <span className="font-display text-xl text-muted-foreground">{index + 1}</span>
                  <img
                    src={artwork.images[0].url}
                    alt=""
                    className="h-14 w-12 rounded object-cover"
                  />
                  <div>
                    <div className="text-sm font-semibold">{artwork.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {artwork.saves} saves · {artwork.messages} messages
                    </div>
                  </div>
                  <strong className="text-sm">{artwork.views}</strong>
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <div className="eyebrow">Marketplace engagement</div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {[
                ["Saves", metrics.saves ?? 0],
                ["Messages", metrics.messages ?? 0],
                ["Offers", metrics.offers ?? 0],
                ["Video requests", metrics.videoRequests ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[var(--ivory)] p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <strong className="mt-1 block font-display text-3xl">{value}</strong>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
      {planId === "free" && (
        <UpgradePanel
          compact
          title="Detailed analytics start with Professional."
          body="Your Free plan keeps essential store and artwork views visible. Upgrade for visitor, source and conversion detail."
        />
      )}
      {planId === "professional" && (
        <UpgradePanel
          compact
          title="Advanced audience and revenue reports"
          body="Pro Plus adds deeper visitor geography, customer segments and promotion conversion detail."
        />
      )}
    </div>
  );
}

function Promotions() {
  const [artwork, setArtwork] = useState(ARTWORKS[0].id);
  const [placement, setPlacement] = useState(PROMOTION_PLACEMENTS[0].id);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"jazzcash" | "easypaisa">("jazzcash");
  const [submitting, setSubmitting] = useState(false);
  const [campaigns, setCampaigns] = useState(() => PromotionService.list());
  const selected = PROMOTION_PLACEMENTS.find((item) => item.id === placement)!;
  const endDate = new Date(new Date(startDate).getTime() + selected.durationDays * 86400000)
    .toISOString()
    .slice(0, 10);
  return (
    <div className="space-y-6">
      <Panel>
        <div className="grid gap-7 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="eyebrow">Create promotion</div>
            <h2 className="mt-2 font-display text-3xl">Choose measured visibility.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sponsored placements are labelled and never exceed one in every five marketplace
              cards.
            </p>
            <div className="mt-6 grid gap-4">
              <DashboardField label="Artwork">
                <select
                  className="art-field"
                  value={artwork}
                  onChange={(event) => setArtwork(event.target.value)}
                >
                  {ARTWORKS.slice(0, 4).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </DashboardField>
              <DashboardField label="Promotion">
                <select
                  className="art-field"
                  value={placement}
                  onChange={(event) => setPlacement(event.target.value)}
                >
                  {PROMOTION_PLACEMENTS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ·{" "}
                      {item.priceMin === item.priceMax
                        ? formatPKR(item.priceMin)
                        : `${formatPKR(item.priceMin)}–${formatPKR(item.priceMax)}`}
                    </option>
                  ))}
                </select>
              </DashboardField>
              <div className="grid gap-4 sm:grid-cols-2">
                <DashboardField label="Start date">
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="art-field"
                  />
                </DashboardField>
                <DashboardField label="End date">
                  <input type="date" value={endDate} readOnly className="art-field" />
                </DashboardField>
              </div>
              <DashboardField label="Payment method">
                <select
                  className="art-field"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value as "jazzcash" | "easypaisa")
                  }
                >
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">Easypaisa</option>
                </select>
              </DashboardField>
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--ivory)] p-5">
            <div className="eyebrow">Placement preview</div>
            <div className="relative mt-4 overflow-hidden rounded-xl">
              <img
                src={ARTWORKS.find((item) => item.id === artwork)?.images[0].url}
                alt="Promotion preview"
                className="aspect-[4/3] w-full object-cover"
              />
              <span className="absolute left-3 top-3 rounded-full bg-[var(--porcelain)] px-2 py-1 text-[10px] font-bold">
                Sponsored
              </span>
            </div>
            <div className="mt-4 font-display text-2xl">{selected.name}</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {selected.description}
            </p>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground">Server-verified total</div>
                <div className="font-display text-3xl">
                  {selected.priceMin === selected.priceMax
                    ? formatPKR(selected.priceMin)
                    : `From ${formatPKR(selected.priceMin)}`}
                </div>
              </div>
              {selected.requiresApproval && <span className="chip">Admin approval</span>}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              You will receive the exact transfer amount and ArtDera account details, then submit
              payment proof for admin verification.
            </p>
            <button
              disabled={submitting}
              onClick={() =>
                void (async () => {
                  setSubmitting(true);
                  const result = await PromotionService.create(
                    {
                      artworkId: artwork,
                      placementId: selected.id,
                      status: "Pending",
                      startDate,
                      endDate,
                      price: selected.priceMin,
                      impressions: 0,
                      clicks: 0,
                      saves: 0,
                      messages: 0,
                      conversions: 0,
                    },
                    paymentMethod,
                  );
                  setSubmitting(false);
                  if (result.error) {
                    toast.error(result.error.message);
                    return;
                  }
                  if (!DEMO_PAYMENT_MODE && result.data?.paymentId) {
                    window.location.assign(`/payment/${encodeURIComponent(result.data.paymentId)}`);
                    return;
                  }
                  setCampaigns(PromotionService.list());
                  toast.success("Promotion payment created", {
                    description: selected.requiresApproval
                      ? "The promotion is pending admin review."
                      : "The promotion is scheduled or ready for activation.",
                  });
                })
              }
              className="btn-primary mt-5 w-full"
            >
              {submitting ? "Creating promotion…" : "Continue to payment"}
            </button>
          </div>
        </div>
      </Panel>
      <Panel>
        <div className="eyebrow">Campaigns</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {campaigns.map((promotion) => {
            const place = PROMOTION_PLACEMENTS.find((item) => item.id === promotion.placementId);
            const art = ARTWORKS.find((item) => item.id === promotion.artworkId);
            return (
              <article
                key={promotion.id}
                className="rounded-xl border border-[var(--color-border)] p-4"
              >
                <div className="flex items-start gap-3">
                  <img src={art?.images[0].url} alt="" className="h-16 w-14 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{place?.name}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{art?.title}</div>
                    <div className="mt-2">
                      <StatusBadge status={promotion.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-2 text-center">
                  {[
                    ["Views", promotion.impressions],
                    ["Clicks", promotion.clicks],
                    ["Saves", promotion.saves],
                    ["Messages", promotion.messages],
                    ["Sales", promotion.conversions],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div className="text-sm font-semibold">{value}</div>
                      <div className="text-[9px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function Shipping() {
  const [weight, setWeight] = useState(3);
  const [city, setCity] = useState("Islamabad");
  const [province, setProvince] = useState("Islamabad Capital Territory");
  const [fragile, setFragile] = useState(false);
  const [framed, setFramed] = useState(true);
  const [packagingType, setPackagingType] = useState<"art_box" | "wooden_crate" | "tube">(
    "art_box",
  );
  const [calculating, setCalculating] = useState(false);
  const [estimate, setEstimate] = useState<{
    courierCost: number;
    packagingCost: number;
    total: number;
    ruleName: string;
    notice: string;
  } | null>(null);
  async function calculate() {
    setCalculating(true);
    const result = await OrderService.estimateShipping({
      city,
      province,
      weightKg: weight,
      fragile,
      framed,
      packagingType,
    });
    setCalculating(false);
    if (result.error) return toast.error(result.error.message);
    if (result.data) setEstimate(result.data);
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Panel>
        <div className="eyebrow">Shipping preferences</div>
        <h2 className="mt-2 font-display text-3xl">Estimate before you promise.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          ArtDera applies the active server-side shipping rules. The result remains an estimate
          until a courier confirms a quote.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <DashboardField label="Delivery city">
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="art-field"
            />
          </DashboardField>
          <DashboardField label="Delivery province">
            <input
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              className="art-field"
            />
          </DashboardField>
          <DashboardField label="Weight (kg)">
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={weight}
              onChange={(event) => setWeight(Number(event.target.value))}
              className="art-field"
            />
          </DashboardField>
          <DashboardField label="Packaging type">
            <select
              className="art-field"
              value={packagingType}
              onChange={(event) => setPackagingType(event.target.value as typeof packagingType)}
            >
              <option value="art_box">Corner protection + art box</option>
              <option value="wooden_crate">Wooden crate</option>
              <option value="tube">Protective tube</option>
            </select>
          </DashboardField>
          <DashboardToggle label="Framed" checked={framed} onChange={setFramed} />
          <DashboardToggle label="Glass or fragile" checked={fragile} onChange={setFragile} />
          <button
            type="button"
            disabled={calculating || !city.trim() || weight <= 0}
            onClick={() => void calculate()}
            className="btn-primary sm:col-span-2 disabled:opacity-45"
          >
            {calculating ? "Calculating…" : "Calculate estimate"}
          </button>
        </div>
      </Panel>
      <Panel>
        <div className="eyebrow">Buyer estimate</div>
        <h2 className="mt-2 font-display text-3xl">Estimated delivery total</h2>
        {estimate ? (
          <>
            <dl className="mt-6 divide-y divide-[var(--color-border)]">
              {[
                ["Estimated courier cost", estimate.courierCost],
                ["Packaging cost", estimate.packagingCost],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between py-4 text-sm">
                  <dt>{label}</dt>
                  <dd className="font-semibold">{formatPKR(Number(value))}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-between border-t-2 border-[var(--ink)] pt-5 font-display text-2xl">
              <span>Estimated total</span>
              <span>{formatPKR(estimate.total)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Rule: {estimate.ruleName}</p>
          </>
        ) : (
          <p className="mt-6 rounded-xl bg-[var(--ivory)] p-4 text-sm text-muted-foreground">
            Enter a destination and calculate to load the active shipping rule.
          </p>
        )}
        <div className="mt-5 flex gap-3 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          <Truck className="h-4 w-4 shrink-0" />
          {estimate?.notice ?? "Courier, insurance and final packaging may change the amount."}
        </div>
        <div className="mt-5">
          <div className="eyebrow">Current shipment</div>
          {SHIPMENTS.map((shipment) => (
            <div
              key={shipment.id}
              className="mt-3 rounded-xl border border-[var(--color-border)] p-4"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">
                    {shipment.pickupCity} → {shipment.deliveryCity}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {shipment.trackingNumber}
                  </div>
                </div>
                <StatusBadge status={shipment.status} />
              </div>
            </div>
          ))}
          {!SHIPMENTS.length && (
            <p className="mt-3 text-sm text-muted-foreground">No active shipments.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Payouts({ planId }: { planId: PlanId }) {
  const payout = PAYOUTS[0];
  const totals = {
    available: PAYOUTS.filter((item) => item.status === "Available").reduce(
      (sum, item) => sum + item.net,
      0,
    ),
    pending: PAYOUTS.filter((item) => item.status === "Pending").reduce(
      (sum, item) => sum + item.net,
      0,
    ),
    held: PAYOUTS.filter((item) => item.status === "On Hold").reduce(
      (sum, item) => sum + item.net,
      0,
    ),
    paid: PAYOUTS.filter((item) => item.status === "Paid").reduce((sum, item) => sum + item.net, 0),
  };
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Available balance", formatPKR(totals.available), WalletCards],
          ["Pending balance", formatPKR(totals.pending), CircleDollarSign],
          ["On hold", formatPKR(totals.held), LockKeyhole],
          ["Completed payouts", formatPKR(totals.paid), CheckCircle2],
        ].map(([label, value, Icon]) => {
          const ItemIcon = Icon as LucideIcon;
          return (
            <Panel key={label as string} compact>
              <ItemIcon className="h-5 w-5 text-[var(--oxblood)]" />
              <div className="mt-4 text-xs text-muted-foreground">{label as string}</div>
              <div className="mt-1 font-display text-3xl">{value as string}</div>
            </Panel>
          );
        })}
      </div>
      {payout ? (
        <Panel>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="eyebrow">Estimated payout</div>
              <h2 className="mt-2 font-display text-3xl">
                Order{" "}
                {ORDERS.find((order) => order.id === payout.orderId)?.orderNumber ?? payout.orderId}
              </h2>
            </div>
            <StatusBadge status={payout.status} />
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <tbody>
                {[
                  ["Gross artwork amount", payout.gross],
                  ["Commission", -payout.commission],
                  ["Shipping deduction", -payout.shippingDeduction],
                  ["Estimated tax deduction", -payout.taxEstimate],
                  ["Payment-processing deduction", -payout.processingDeduction],
                  ["Refund adjustment", payout.refundAdjustment],
                  ["Net payout", payout.net],
                ].map(([label, value], index) => (
                  <tr
                    key={label as string}
                    className={`border-b border-[var(--color-border)] ${index === 6 ? "text-base font-bold" : ""}`}
                  >
                    <td className="p-4">{label}</td>
                    <td className="p-4 text-right">{formatPKR(Number(value))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 rounded-xl bg-[var(--ivory)] p-4 text-sm">
            <strong>{PLANS[planId].payoutTime}</strong>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Timing begins after successful delivery, the inspection period and order completion.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel>
          <EmptyState
            icon={WalletCards}
            title="No payouts yet."
            body="Eligible payouts are calculated by the API after an order completes delivery and inspection."
            action={["View orders", "/artist/dashboard/orders"]}
          />
        </Panel>
      )}
      <Panel>
        <div className="eyebrow">Payout provider</div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Real bank disbursement is disabled until an authorized payout provider is configured.
          ArtDera stores calculated payout records only; this page never collects bank credentials.
        </p>
      </Panel>
    </div>
  );
}

function Reviews({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState(() =>
    REVIEWS.filter((review) => review.sellerId === userId),
  );
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  return (
    <Panel>
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Store rating</div>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-display text-5xl">{average.toFixed(1)}</span>
            <div>
              <div className="flex text-amber-500">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} className="h-4 w-4" fill="currentColor" />
                ))}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {reviews.length} verified-order reviews
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-7 space-y-4">
        {reviews.map((review) => (
          <article key={review.id} className="rounded-xl border border-[var(--color-border)] p-5">
            <div className="flex justify-between">
              <div className="flex text-amber-500">
                {Array.from({ length: review.rating }, (_, index) => (
                  <Star key={index} className="h-3.5 w-3.5" fill="currentColor" />
                ))}
              </div>
              <StatusBadge status={review.status} />
            </div>
            <h3 className="mt-3 font-semibold">{review.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.body}</p>
            <div className="mt-4 flex gap-3 text-xs">
              <button
                onClick={() =>
                  void (async () => {
                    const response = window.prompt("Public response to this review")?.trim();
                    if (!response) return;
                    const result = await ReviewService.respond(review.id, response);
                    if (result.error) return toast.error(result.error.message);
                    setReviews((items) =>
                      items.map((item) =>
                        item.id === review.id ? { ...item, sellerResponse: response } : item,
                      ),
                    );
                    toast.success("Review response published");
                  })
                }
                className="font-semibold underline"
              >
                {review.sellerResponse ? "Update response" : "Reply"}
              </button>
            </div>
            {review.sellerResponse && (
              <p className="mt-4 rounded-xl bg-[var(--ivory)] p-4 text-sm">
                <strong>Seller response:</strong> {review.sellerResponse}
              </p>
            )}
          </article>
        ))}
      </div>
      {!reviews.length && (
        <p className="mt-7 text-sm text-muted-foreground">No verified-order reviews yet.</p>
      )}
    </Panel>
  );
}

function Verification() {
  const { user } = useAuth();
  const store = user ? ArtistService.getStoreForUser(user.id) : undefined;
  const [request, setRequest] = useState<Record<string, any> | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [idType, setIdType] = useState("CNIC");
  const [idNumber, setIdNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownershipDeclared, setOwnershipDeclared] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [identityDocumentId, setIdentityDocumentId] = useState("");
  const [identityDocumentName, setIdentityDocumentName] = useState("");
  const [uploadingIdentity, setUploadingIdentity] = useState(false);

  useEffect(() => {
    void VerificationService.list().then((result) => {
      if (result.data) {
        const req = result.data[0];
        setRequest(req);
        // Pre-fill from existing submission data
        if (req?.submittedData) {
          const d = req.submittedData as Record<string, any>;
          setFullName(String(d.fullName ?? ""));
          setPhoneNumber(String(d.phoneNumber ?? ""));
          setPortfolioUrl(String(d.portfolioUrl ?? ""));
          setIdType(String(d.idType ?? "CNIC"));
          setIdNumber(String(d.cnicNumber ?? d.idNumber ?? ""));
          setBusinessName(String(d.businessName ?? ""));
          setOwnershipDeclared(Boolean(d.ownershipDeclared));
          setAdditionalNotes(String(d.additionalNotes ?? ""));
          setIdentityDocumentName(String(d.identityDocumentName ?? ""));
        }
        if (Array.isArray(req?.documentReferences) && req.documentReferences.length > 0) {
          setIdentityDocumentId(String(req.documentReferences[0]));
        }
      } else if (result.error) {
        toast.error(result.error.message);
      }
    });
  }, []);

  const status = String(request?.identityStatus ?? request?.status ?? "Not submitted");
  const approved = status.toLowerCase() === "approved";

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      toast.error("Choose a PDF, JPG, PNG or WebP document.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be smaller than 5 MB.");
      return;
    }
    setUploadingIdentity(true);
    const res = await UploadService.upload(file, "verification");
    setUploadingIdentity(false);
    if (res.error) return toast.error(res.error.message);
    if (res.data) {
      setIdentityDocumentId(res.data.id);
      setIdentityDocumentName(file.name);
      toast.success("Identity document uploaded securely");
    }
  }

  async function handleSubmit() {
    if (!store || !user || (user.role !== "artist" && user.role !== "gallery")) return;
    setSubmitting(true);
    const result = await VerificationService.submit({
      storeId: store.id,
      type: user.role,
      submittedData: {
        fullName,
        phoneNumber,
        portfolioUrl,
        idType,
        idNumber,
        cnicNumber: idNumber,
        businessName,
        identityDocumentName,
        ownershipDeclared,
        additionalNotes,
      },
      documentReferences: identityDocumentId ? [identityDocumentId] : [],
    });
    setSubmitting(false);
    if (result.error) return toast.error(result.error.message);
    setRequest(result.data);
    setEditing(false);
    toast.success(request ? "Verification information updated" : "Verification request submitted");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Verification request</div>
            <h2 className="mt-2 font-display text-3xl">Identity and portfolio review</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--ivory)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--porcelain)] transition-colors"
                title="Edit verification information"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            {editing && (
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-[var(--ivory)] transition-colors"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            )}
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Verification is granted only after review. A subscription payment never guarantees
          approval.
        </p>

        {editing ? (
          /* ── Edit form ── */
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-4">
              <p className="text-xs text-muted-foreground">
                Fill in the fields below and submit to update your verification request. All
                information will be reviewed by the ArtDera team.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DashboardField label="Full legal name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="As it appears on your ID"
                  className="art-field"
                />
              </DashboardField>
              <DashboardField label="Phone number">
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+92 300 0000000"
                  className="art-field"
                />
              </DashboardField>
              <DashboardField label="ID type">
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="art-field"
                >
                  <option value="CNIC">National ID / CNIC</option>
                  <option value="Passport">Passport</option>
                  <option value="Business Registration">Business Registration</option>
                  <option value="Other">Other</option>
                </select>
              </DashboardField>
              <DashboardField label="CNIC / Document Number">
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 42101-1234567-1"
                  className="art-field"
                />
              </DashboardField>
              <DashboardField label="Identity Document (CNIC Front/Back or PDF)" wide>
                <label className="art-field flex cursor-pointer items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">
                    {uploadingIdentity
                      ? "Uploading identity document…"
                      : identityDocumentName || "Choose document (JPG, PNG, PDF)"}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={uploadingIdentity}
                    onChange={(e) => void handleFileUpload(e)}
                    className="sr-only"
                  />
                </label>
              </DashboardField>
              {user?.role === "gallery" && (
                <DashboardField label="Business / gallery name" wide>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Registered business name"
                    className="art-field"
                  />
                </DashboardField>
              )}
              <DashboardField label="Portfolio / website URL" wide>
                <input
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://your-portfolio.com"
                  className="art-field"
                />
              </DashboardField>
              <DashboardField label="Additional notes" wide>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any extra context you'd like to share with our review team…"
                  rows={3}
                  className="art-field resize-none"
                />
              </DashboardField>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] p-4 text-sm">
              <input
                type="checkbox"
                checked={ownershipDeclared}
                onChange={(e) => setOwnershipDeclared(e.target.checked)}
                className="mt-0.5 accent-[var(--oxblood)]"
              />
              <span>
                I declare that all information submitted is accurate and that I am the rightful
                owner of this store and the artworks listed.
              </span>
            </label>
            <div className="flex gap-3">
              <button
                disabled={!store || !user || submitting || !ownershipDeclared}
                onClick={() => void handleSubmit()}
                className="btn-primary disabled:opacity-45"
              >
                {submitting
                  ? "Submitting…"
                  : request
                    ? "Update information"
                    : "Submit for verification"}
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Status view ── */
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["Email", user?.emailVerified ? "Verified" : "Pending"],
                ["Phone", request?.phoneVerified ? "Verified" : "Not verified"],
                ["Identity", status],
                ["Portfolio", String(request?.portfolioStatus ?? status)],
                ["Ownership declaration", request?.ownershipDeclared ? "Confirmed" : "Pending"],
                ["Public badge", approved ? "Visible" : "Not visible"],
              ].map(([label, statusVal]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-xl bg-[var(--ivory)] p-4 text-sm"
                >
                  <span>{label}</span>
                  <span className="font-semibold">{statusVal}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                disabled={!store || !user || submitting}
                onClick={() => setEditing(true)}
                className="btn-primary"
              >
                <Pencil className="h-4 w-4" />
                {request ? "Edit & resubmit" : "Fill in details"}
              </button>
              {request && (
                <button
                  disabled={!store || !user || submitting}
                  onClick={() =>
                    void (async () => {
                      if (!store || !user || (user.role !== "artist" && user.role !== "gallery"))
                        return;
                      setSubmitting(true);
                      const result = await VerificationService.submit({
                        storeId: store.id,
                        type: user.role,
                        submittedData: { ownershipDeclared: true },
                      });
                      setSubmitting(false);
                      if (result.error) return toast.error(result.error.message);
                      setRequest(result.data);
                      toast.success("Verification request resubmitted");
                    })()
                  }
                  className="btn-ghost"
                >
                  {submitting ? "Submitting…" : "Resubmit current"}
                </button>
              )}
            </div>
          </>
        )}
      </Panel>
      <Panel>
        <ShieldCheck className="h-8 w-8 text-[var(--indigo)]" />
        <h2 className="mt-5 font-display text-3xl">What the badge means</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li>Identity or business information passed ArtDera's review.</li>
          <li>Portfolio information was reviewed for consistency.</li>
          <li>It does not guarantee artwork quality, investment value or delivery outcome.</li>
          <li>Sponsored status never affects verification.</li>
        </ul>
        {request?.rejectionReason && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <strong className="block mb-1">Reviewer note:</strong>
            {request.rejectionReason}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Billing({
  planId,
  userId,
  role,
}: {
  planId: PlanId;
  userId: string;
  role: "artist" | "gallery";
}) {
  const initialSubscription = SubscriptionService.getForUser(userId);
  const [cycle, setCycle] = useState<"monthly" | "annual">(
    initialSubscription?.billingCycle === "annual" ? "annual" : "monthly",
  );
  const [activePlanId, setActivePlanId] = useState(planId);
  const [active, setActive] = useState(
    initialSubscription?.status !== "Cancelled" && !initialSubscription?.cancelAtPeriodEnd,
  );
  const [changeOpen, setChangeOpen] = useState(false);
  const [requestedPlan, setRequestedPlan] = useState<PlanId | null>(null);
  const [downgradeEffective, setDowngradeEffective] = useState<"immediately" | "end-of-cycle">(
    "end-of-cycle",
  );
  const plan = PLANS[activePlanId];
  const subscription = SubscriptionService.getForUser(userId);
  const invoices = InvoiceService.listFor(userId);
  const activeStore = ArtistService.getStoreForUser(userId);
  const usage = FeatureAccessService.usage(userId, activeStore?.id);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("upgrade");
    if (requested && PLAN_ORDER.includes(requested as PlanId) && requested !== activePlanId) {
      setRequestedPlan(requested as PlanId);
      setChangeOpen(true);
    }
  }, [activePlanId]);

  return (
    <div className="space-y-6">
      <Panel>
        <div className="grid gap-7 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="eyebrow">Current plan</div>
            <h2 className="mt-2 font-display text-4xl">{plan.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={active ? "Active" : "Cancelled"} />
              <span className="chip">{subscription?.billingCycle ?? cycle} billing</span>
              <span className="chip">{plan.commission}% commission</span>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {usage.activeListings} of {plan.listingLimit ?? "fair-use unlimited"} active listings
              · Payout: {plan.payoutTime}
            </p>
            <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Start date</dt>
                <dd className="mt-1 font-semibold">
                  {subscription?.startedAt
                    ? new Date(subscription.startedAt).toLocaleDateString("en-PK")
                    : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Next billing date</dt>
                <dd className="mt-1 font-semibold">
                  {subscription?.renewsAt
                    ? new Date(subscription.renewsAt).toLocaleDateString("en-PK")
                    : "Not applicable"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Listing usage</dt>
                <dd className="mt-1 font-semibold">
                  {usage.activeListings} / {plan.listingLimit ?? "Fair-use"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Subscription status</dt>
                <dd className="mt-1 font-semibold">{subscription?.status ?? "Active"}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl bg-[var(--ivory)] p-5 text-right">
            <div className="text-xs text-muted-foreground">Subscription price</div>
            <div className="mt-2 font-display text-4xl">
              {formatPKR(
                subscription?.price ??
                  (cycle === "annual" && plan.annualPrice ? plan.annualPrice : plan.monthlyPrice),
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {subscription?.status ?? "No active subscription"}
            </div>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap gap-2">
          <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
            <DialogTrigger asChild>
              <button className="btn-primary">Compare and change plan</button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto bg-[var(--porcelain)]">
              <DialogHeader>
                <DialogTitle className="font-display text-3xl">Compare seller plans</DialogTitle>
                <DialogDescription>
                  Plan changes are validated by the API. An immediate downgrade archives listings
                  above the new limit; artwork records and order history are preserved.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {PLAN_ORDER.map((id) => PLANS[id])
                  .filter(Boolean)
                  .map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 flex flex-col justify-between ${item.id === activePlanId || item.id === requestedPlan ? "border-[var(--oxblood)] bg-[var(--ivory)]" : "border-[var(--color-border)]"}`}
                    >
                      <div>
                        <div className="flex justify-between items-center">
                          <strong>{item.name}</strong>
                          {item.id === activePlanId && <span className="chip">Current</span>}
                        </div>
                        <div className="mt-2 font-display text-2xl">
                          {item.id === "free"
                            ? "PKR 0"
                            : item.id === "professional"
                              ? "PKR 500 / year"
                              : `${formatPKR(item.monthlyPrice)} / month`}
                        </div>
                        {item.id === "professional" && (
                          <div className="text-[11px] text-[var(--terracotta)] font-medium mt-0.5">
                            Less than PKR 42/month
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {item.listingLimit ?? "Fair-use unlimited"} listings · {item.commission}%
                          commission
                        </div>
                      </div>
                      <button
                        disabled={item.id === activePlanId}
                        onClick={() =>
                          void (async () => {
                            const movingUp =
                              PLAN_ORDER.indexOf(item.id) > PLAN_ORDER.indexOf(activePlanId);
                            if (movingUp) {
                              if (
                                item.id === "gallery" &&
                                role !== "gallery" &&
                                !window.confirm(
                                  "The Gallery Plan is for a gallery or art business managing multiple artists. Confirm that this account should register as a gallery or art business.",
                                )
                              )
                                return;
                              if (item.id === "gallery")
                                SubscriptionService.confirmGalleryRegistration(userId);
                              const selectedPlan = await SubscriptionService.selectPlan(
                                item.id,
                                "monthly",
                              );
                              if (selectedPlan.error) {
                                toast.error(selectedPlan.error.message);
                                return;
                              }
                              window.location.assign("/artist/checkout?change=upgrade");
                              return;
                            }
                            const lost = plan.allowedModules.filter(
                              (module) => !item.allowedModules.includes(module),
                            );
                            if (
                              !window.confirm(
                                `Downgrade to ${item.name}? The new listing limit is ${item.listingLimit ?? "fair-use unlimited"}, commission is ${item.commission}%, and these tools will be locked: ${lost.join(", ") || "none"}. Artwork and order history will not be deleted.`,
                              )
                            )
                              return;
                            const result = await SubscriptionService.scheduleDowngrade(
                              userId,
                              item.id,
                              downgradeEffective,
                            );
                            if (!result) {
                              toast.error("The plan change could not be completed");
                              return;
                            }
                            if (downgradeEffective === "immediately") setActivePlanId(item.id);
                            toast.success(
                              downgradeEffective === "immediately"
                                ? `Downgraded to ${item.name}`
                                : `Downgrade to ${item.name} scheduled`,
                              {
                                description:
                                  downgradeEffective === "immediately"
                                    ? "Artwork over the new limit was archived, never deleted."
                                    : "The change will apply at the end of the current billing cycle.",
                              },
                            );
                          })()
                        }
                        className="btn-ghost mt-4 w-full disabled:cursor-default disabled:opacity-55"
                      >
                        {item.id === activePlanId
                          ? "Current plan"
                          : PLAN_ORDER.indexOf(item.id) > PLAN_ORDER.indexOf(activePlanId)
                            ? `Upgrade to ${item.name}`
                            : `Downgrade to ${item.name}`}
                      </button>
                    </div>
                  ))}
              </div>
            </DialogContent>
          </Dialog>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-xs font-semibold">
            Downgrades
            <select
              value={downgradeEffective}
              onChange={(event) =>
                setDowngradeEffective(event.target.value as typeof downgradeEffective)
              }
              className="bg-transparent"
            >
              <option value="end-of-cycle">At end of billing cycle</option>
              <option value="immediately">Apply immediately</option>
            </select>
          </label>
          {active && (
            <button
              onClick={() =>
                void (async () => {
                  if (
                    !window.confirm(
                      "Cancel this subscription at the end of its current billing period? Your store and historical records will be preserved.",
                    )
                  )
                    return;
                  const result = await SubscriptionService.updateStatus(userId, "Cancelled");
                  if (!result) return toast.error("The cancellation could not be saved");
                  setActive(false);
                  toast.success("Cancellation scheduled for the end of the billing period");
                })
              }
              className="btn-ghost"
            >
              Cancel subscription
            </button>
          )}
        </div>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <div className="eyebrow">Included features</div>
          <ul className="mt-4 space-y-2 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-[var(--success)]" /> {feature}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <div className="eyebrow">Locked features</div>
          {plan.lockedModules.length ? (
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {plan.lockedModules.map((feature) => (
                <li key={feature} className="flex gap-2 capitalize">
                  <LockKeyhole className="mt-0.5 h-4 w-4" /> {feature.replaceAll("-", " ")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              All modules available for this seller type are unlocked.
            </p>
          )}
        </Panel>
      </div>
      <Panel>
        <div className="eyebrow">Invoices</div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Invoice</th>
                <th className="p-3">Date</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b">
                  <td className="p-3 font-semibold">{invoice.id}</td>
                  <td className="p-3">{new Date(invoice.issuedAt).toLocaleDateString("en-PK")}</td>
                  <td className="p-3">{PLANS[invoice.planId].name}</td>
                  <td className="p-3">{formatPKR(invoice.total)}</td>
                  <td className="p-3">
                    <StatusBadge status={invoice.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!invoices.length && (
          <p className="mt-5 text-sm text-muted-foreground">
            No invoices have been issued for this account yet.
          </p>
        )}
      </Panel>
    </div>
  );
}

function ManagedArtists() {
  const [artists, setArtists] = useState<Array<Record<string, any>>>([]);
  useEffect(() => {
    void GalleryService.artists().then((result) => {
      if (result.data) setArtists(result.data);
      else if (result.error) toast.error(result.error.message);
    });
  }, []);
  return (
    <Panel>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Artist roster</div>
          <h2 className="mt-2 font-display text-3xl">{artists.length} managed artists</h2>
        </div>
        <button
          onClick={() =>
            void (async () => {
              const email = window.prompt("Artist account email")?.trim();
              if (!email) return;
              const result = await GalleryService.inviteArtist(email);
              if (result.error) return toast.error(result.error.message);
              setArtists((values) => [result.data!, ...values]);
              toast.success("Artist invitation created");
            })
          }
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> Add artist
        </button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {artists.map((artist, index) => (
          <article
            key={`${artist.name}-${index}`}
            className="rounded-xl border border-[var(--color-border)] p-5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ivory)] font-display text-xl">
                {artist.name
                  .split(" ")
                  .map((value: string) => value[0])
                  .join("")}
              </div>
              <div>
                <div className="font-semibold">{artist.name}</div>
                <div className="text-xs text-muted-foreground">
                  {artist.email ?? artist.city ?? "Pakistan"}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <div className="font-display text-2xl">{artist.city || "—"}</div>
                <div className="text-[10px] text-muted-foreground">Location</div>
              </div>
              <div>
                <div className="font-display text-2xl">{artist.status ?? "Invited"}</div>
                <div className="text-[10px] text-muted-foreground">Relationship</div>
              </div>
            </div>
            <div className="mt-4 flex justify-between">
              <StatusBadge status={artist.status ?? "Invited"} />
            </div>
          </article>
        ))}
      </div>
      {!artists.length && (
        <p className="mt-6 text-sm text-muted-foreground">
          No artists are connected to this gallery yet.
        </p>
      )}
    </Panel>
  );
}

function StaffAccounts() {
  const [staff, setStaff] = useState<Array<Record<string, any>>>([]);
  useEffect(() => {
    void GalleryService.staff().then((result) => {
      if (result.data) setStaff(result.data);
      else if (result.error) toast.error(result.error.message);
    });
  }, []);
  return (
    <Panel>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Staff accounts</div>
          <h2 className="mt-2 font-display text-3xl">{staff.length} of 10 seats used</h2>
        </div>
        <button
          onClick={() =>
            void (async () => {
              const email = window.prompt("Staff member email")?.trim();
              if (!email) return;
              const result = await GalleryService.inviteStaff({
                email,
                role: "Gallery Staff",
                permissions: ["manage_inventory", "manage_orders"],
              });
              if (result.error) return toast.error(result.error.message);
              setStaff((items) => [result.data!, ...items]);
              toast.success("Staff invitation created");
            })
          }
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> Invite staff
        </button>
      </div>
      <div className="mt-5 flex gap-3 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Invitations, seat limits and assigned permissions are validated by the gallery API.
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3">Staff member</th>
              <th className="p-3">Role</th>
              <th className="p-3">Permissions</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-b">
                <td className="p-3">
                  <strong>{member.name}</strong>
                  <div className="text-xs text-muted-foreground">{member.email}</div>
                </td>
                <td className="p-3">{member.role}</td>
                <td className="p-3">{member.permissions.join(", ")}</td>
                <td className="p-3">
                  <StatusBadge status={member.status} />
                </td>
                <td className="p-3">
                  <button
                    onClick={() =>
                      void (async () => {
                        const next =
                          String(member.status).toLowerCase() === "suspended"
                            ? "active"
                            : "suspended";
                        const result = await GalleryService.updateStaff(member.id, {
                          status: next,
                        });
                        if (result.error) return toast.error(result.error.message);
                        setStaff((items) =>
                          items.map((item) =>
                            item.id === member.id
                              ? { ...item, status: next === "active" ? "Active" : "Suspended" }
                              : item,
                          ),
                        );
                      })
                    }
                    className="btn-ghost px-3"
                  >
                    {String(member.status).toLowerCase() === "suspended" ? "Activate" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!staff.length && (
        <p className="mt-5 text-sm text-muted-foreground">
          No staff accounts or pending invitations.
        </p>
      )}
    </Panel>
  );
}

function Exhibitions() {
  const [exhibitions, setExhibitions] = useState<Array<Record<string, any>>>([]);
  useEffect(() => {
    void GalleryService.exhibitions().then((result) => {
      if (result.data) setExhibitions(result.data);
      else if (result.error) toast.error(result.error.message);
    });
  }, []);
  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="eyebrow">Exhibitions</div>
            <h2 className="mt-2 font-display text-3xl">Curate public programmes.</h2>
          </div>
          <button
            onClick={() =>
              void (async () => {
                const name = window.prompt("Exhibition name")?.trim();
                if (!name) return;
                const startAt = new Date(Date.now() + 7 * 86400000);
                const endAt = new Date(Date.now() + 30 * 86400000);
                const result = await GalleryService.createExhibition({
                  name,
                  slug: `${name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`,
                  description: "",
                  venue: "",
                  startAt: startAt.toISOString(),
                  endAt: endAt.toISOString(),
                  artistIds: [],
                  artworkIds: [],
                  type: "hybrid",
                  status: "draft",
                  isPublished: false,
                });
                if (result.error) return toast.error(result.error.message);
                setExhibitions((items) => [result.data!, ...items]);
                toast.success("Exhibition draft created");
              })
            }
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> New exhibition
          </button>
        </div>
      </Panel>
      {exhibitions.map((exhibition) => (
        <article
          key={exhibition.id}
          className="grid overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] md:grid-cols-[280px_1fr]"
        >
          {exhibition.coverImage ? (
            <img
              src={exhibition.coverImage}
              alt={exhibition.name}
              className="h-full min-h-56 w-full object-cover"
            />
          ) : (
            <div className="min-h-56 bg-[var(--ivory)]" aria-hidden="true" />
          )}
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={exhibition.published ? "Published" : "Draft"} />
              <span className="chip">{exhibition.format}</span>
            </div>
            <h2 className="mt-4 font-display text-4xl">{exhibition.name}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {exhibition.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                {exhibition.venue}
              </span>
              <span>
                <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                {exhibition.startDate} – {exhibition.endDate}
              </span>
              <span>
                {exhibition.artistIds.length} artists · {exhibition.artworkIds.length} artworks
              </span>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() =>
                  void (async () => {
                    const name = window.prompt("Exhibition name", exhibition.name)?.trim();
                    if (!name || name === exhibition.name) return;
                    const result = await GalleryService.updateExhibition(exhibition.id, { name });
                    if (result.error) return toast.error(result.error.message);
                    setExhibitions((items) =>
                      items.map((item) => (item.id === exhibition.id ? { ...item, name } : item)),
                    );
                    toast.success("Exhibition updated");
                  })
                }
                className="btn-primary"
              >
                Edit exhibition
              </button>
            </div>
          </div>
        </article>
      ))}
      {!exhibitions.length && (
        <Panel>
          <p className="text-sm text-muted-foreground">No exhibitions have been created.</p>
        </Panel>
      )}
    </div>
  );
}

function GalleryReports() {
  // Gallery reports share the same server-aggregated analytics source as the seller view.
  return <Analytics planId="gallery" />;
}

function Support({ planId }: { planId: PlanId }) {
  const [ticket, setTicket] = useState<Record<string, any> | undefined>();
  const [topic, setTopic] = useState("orders");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
      <Panel>
        {ticket ? (
          <EmptyState
            icon={CheckCircle2}
            title="Support request sent."
            body={`Ticket ${ticket.ticketNumber ?? ticket.id} is open and stored in your account.`}
            action={["Send another", "/artist/dashboard/support"]}
          />
        ) : (
          <>
            <div className="eyebrow">Contact support</div>
            <h2 className="mt-2 font-display text-3xl">How can we help?</h2>
            <div className="mt-6 grid gap-4">
              <DashboardField label="Topic">
                <select
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  className="art-field"
                >
                  <option value="orders">Orders and shipping</option>
                  <option value="artwork">Artwork review</option>
                  <option value="verification">Verification</option>
                  <option value="subscription">Subscription</option>
                  <option value="technical">Technical issue</option>
                </select>
              </DashboardField>
              <DashboardField label="Subject">
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={180}
                  className="art-field"
                />
              </DashboardField>
              <DashboardField label="Message">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={5000}
                  rows={6}
                  className="art-field !rounded-xl"
                />
              </DashboardField>
              <button
                disabled={sending || subject.trim().length < 3 || message.trim().length < 10}
                onClick={() =>
                  void (async () => {
                    setSending(true);
                    const result = await SupportService.create({
                      category: topic,
                      subject,
                      description: message,
                    });
                    setSending(false);
                    if (result.error) return toast.error(result.error.message);
                    setTicket(result.data as Record<string, any>);
                  })
                }
                className="btn-primary justify-self-start"
              >
                {sending ? "Sending…" : "Send support request"}
              </button>
            </div>
          </>
        )}
      </Panel>
      <Panel>
        <div className="eyebrow">Help centre</div>
        <div className="mt-4 space-y-2">
          {[
            "Preparing artwork for delivery",
            "Understanding listing reviews",
            "How verification works",
            "Promotion placement rules",
            "Payout timing explained",
          ].map((label) => (
            <a
              key={label}
              href="/help"
              className="flex min-h-12 items-center justify-between rounded-xl bg-[var(--ivory)] px-4 text-sm font-semibold"
            >
              {label}
              <ChevronRight className="h-4 w-4" />
            </a>
          ))}
        </div>
        {planId === "free" && (
          <div className="mt-5 rounded-xl bg-[var(--ivory)] p-4 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Need priority support?</strong> Professional adds
            priority assistance alongside 50 listings and detailed analytics.
            <a
              href="/artist/dashboard/subscription?upgrade=professional"
              className="mt-3 block font-semibold text-foreground underline"
            >
              Compare Professional
            </a>
          </div>
        )}
      </Panel>
    </div>
  );
}

function SettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    email: true,
    inApp: true,
    marketing: false,
    orderUpdates: true,
    messageUpdates: true,
  });
  useEffect(() => {
    void NotificationService.preferences().then((result) => {
      if (result.data) setPreferences(result.data);
    });
  }, []);
  return (
    <div className="space-y-6">
      <Panel>
        <div className="eyebrow">Profile settings</div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <DashboardField label="Full name">
            <input
              className="art-field"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={120}
            />
          </DashboardField>
          <DashboardField label="Email">
            <input
              type="email"
              className="art-field"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
            />
          </DashboardField>
        </div>
        <button
          onClick={() =>
            void (async () => {
              if (!user) return;
              const profile = await UserService.updateProfile({ fullName });
              if (profile.error) return toast.error(profile.error.message);
              if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
                const contact = await UserService.updateContact(user.id, { email });
                if (!contact) return toast.error("The email address could not be updated");
                toast.success("Profile saved. Verify the new email address to continue.");
                return;
              }
              toast.success("Profile settings saved");
            })
          }
          className="btn-primary mt-6"
        >
          Save profile
        </button>
      </Panel>
      <Panel>
        <div className="eyebrow">Notification preferences</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Email notifications", "email"],
            ["In-app notifications", "inApp"],
            ["Marketplace updates", "marketing"],
            ["Order updates", "orderUpdates"],
            ["Message and offer updates", "messageUpdates"],
          ].map(([label, key]) => (
            <DashboardToggle
              key={key}
              label={label}
              checked={Boolean(preferences[key])}
              onChange={(value) => setPreferences((current) => ({ ...current, [key]: value }))}
            />
          ))}
        </div>
        <button
          onClick={() =>
            void NotificationService.updatePreferences(preferences).then((result) =>
              result.error
                ? toast.error(result.error.message)
                : toast.success("Notification preferences saved"),
            )
          }
          className="btn-primary mt-6"
        >
          Save notification preferences
        </button>
      </Panel>
      <Panel>
        <div className="eyebrow">Privacy and security</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() =>
              void UserService.revokeOtherSessions().then((result) =>
                result.error
                  ? toast.error(result.error.message)
                  : toast.success(`${result.data?.revoked ?? 0} other sessions signed out`),
              )
            }
            className="btn-ghost justify-start"
          >
            <ShieldCheck className="h-4 w-4" /> Sign out other sessions
          </button>
        </div>
      </Panel>
    </div>
  );
}

function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(NOTIFICATIONS.filter((item) => item.userId === userId));
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--porcelain)]"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {items.some((item) => !item.read) && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--oxblood)]" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-13 z-30 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-3 shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between p-2">
            <strong>Notifications</strong>
            <button
              onClick={() =>
                void NotificationService.readAll().then((result) => {
                  if (result.error) return toast.error(result.error.message);
                  setItems((values) => values.map((item) => ({ ...item, read: true })));
                })
              }
              className="text-[11px] font-semibold underline"
            >
              Mark all read
            </button>
          </div>
          <div className="mt-1 space-y-1">
            {items.length ? (
              items.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    if (!item.read) void NotificationService.read(item.id);
                  }}
                  className={`block rounded-xl p-3 ${item.read ? "" : "bg-[var(--ivory)]"}`}
                >
                  <div className="text-xs font-semibold">{item.title}</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {item.body}
                  </div>
                </a>
              ))
            ) : (
              <div className="p-5 text-center text-xs text-muted-foreground">No notifications.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardLoading() {
  return <PageLoading label="Loading your seller dashboard" />;
}
function DashboardAccess({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="container-editorial flex min-h-[65vh] items-center justify-center py-16">
      <div className="max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-8 text-center">
        <LockKeyhole className="mx-auto h-9 w-9 text-[var(--oxblood)]" />
        <h1 className="mt-5 font-display text-4xl">
          {signedIn ? "Start seller setup." : "Sign in to your seller workspace."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {signedIn
            ? "Keep this account and add a seller profile in a few guided steps."
            : "Sign in with your ArtDera account. If you have not started selling yet, you can add a seller profile without creating another account."}
        </p>
        <a
          href={signedIn ? "/sell/plans" : "/auth/login?redirect=/artist/dashboard"}
          className="btn-primary mt-6"
        >
          {signedIn ? "Choose a seller plan" : "Sign in"}
        </a>
      </div>
    </div>
  );
}
function Panel({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <section
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] ${compact ? "p-5" : "p-5 md:p-6"}`}
    >
      {children}
    </section>
  );
}
function Metric({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <Panel compact>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-3 font-display text-3xl">{value}</div>
      <div className="mt-1 flex items-center gap-1 text-xs text-[var(--success)]">
        <ArrowUpRight className="h-3 w-3" />
        {change}
      </div>
    </Panel>
  );
}
function StatusBadge({ status }: { status: string }) {
  const positive =
    /Published|Approved|Active|Completed|Paid|Delivered|Verified|Consented|Accepted/i.test(status);
  const warning = /Pending|Preparing|Review|Required|Awaiting|Invited|Scheduled|Packaging/i.test(
    status,
  );
  const negative = /Rejected|Cancelled|Disputed|Damaged|No consent|Suspended/i.test(status);
  return (
    <span
      className={`inline-flex max-w-max rounded-full px-2.5 py-1 text-[10px] font-bold ${positive ? "bg-emerald-50 text-emerald-800" : warning ? "bg-amber-50 text-amber-900" : negative ? "bg-red-50 text-red-800" : "bg-[var(--ivory)] text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action: [string, string];
}) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ivory)]">
        <Icon className="h-6 w-6 text-[var(--oxblood)]" />
      </div>
      <h2 className="mt-5 font-display text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      <a href={action[1]} className="btn-primary mt-5">
        {action[0]}
      </a>
    </div>
  );
}
function PrivacyNotice() {
  return (
    <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
      <ShieldCheck className="h-4 w-4 shrink-0" />
      Customer contact information is hidden before a completed order. Marketing consent is shown
      separately, and sensitive data is protected by role-based access controls.
    </div>
  );
}
function UpgradePanel({
  title,
  body,
  compact = false,
}: {
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-[var(--indigo)] text-[var(--ivory)] ${compact ? "p-6" : "p-8 md:p-10"}`}
    >
      <Sparkles className="h-7 w-7 text-[var(--terracotta)]" />
      <h2 className="mt-5 font-display text-4xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">{body}</p>
      <a
        href="/artist/dashboard/subscription"
        className="btn-primary mt-6 bg-[var(--terracotta)] !text-[var(--ink)]"
      >
        Compare plans
      </a>
    </div>
  );
}
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-6">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
}
function DashboardField({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
    </label>
  );
}
function DashboardToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[var(--oxblood)]"
      />
    </label>
  );
}
