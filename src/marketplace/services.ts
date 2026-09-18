import {
  PLAN_RANK,
  hydrateSubscriptionPlans,
  isPlanId,
  planPrice,
  validBillingCycle,
} from "@/config/subscription-plans";
import {
  COLLECTIONS,
  CREATORS,
  CATEGORIES,
  IMAGES,
  PRODUCTS,
  hydrateEditorialData,
  type Category as EditorialCategory,
  type Creator as EditorialCreator,
  type EditorialCollection,
  type Product,
} from "@/lib/artdera";
import { CATEGORIES_LIST } from "@/lib/taxonomy";
import {
  ADMIN_METRICS,
  ANALYTICS,
  ARTWORKS,
  AUDIT_LOG,
  CONVERSATIONS,
  CUSTOMERS,
  EXHIBITIONS,
  MESSAGES,
  NOTIFICATIONS,
  ORDERS,
  PAYOUTS,
  PROMOTIONS,
  REVIEWS,
  SEEDED_USERS,
  SHIPMENTS,
  STAFF,
  STORES,
  VERIFICATIONS,
  hydrateAdminMetrics,
  hydrateMarketplaceData,
} from "./data";
import { DEMO_PAYMENT_MODE, PLANS, ROLE_HOME, hydrateRuntimeConfig } from "./config";
import { prepareImageForUpload } from "./image-upload";
import { uploadResponseResult } from "./upload-response";
import type {
  Artwork,
  ArtistFlowState,
  BillingCycle,
  Conversation,
  Invoice,
  Message,
  Notification,
  Order,
  Payment,
  PaymentMethod,
  PlanDowngrade,
  PlanId,
  PlanSelection,
  PlanUpgrade,
  PlanUsage,
  Promotion,
  ServiceResult,
  Store,
  Subscription,
  SubscriptionPlan,
  User,
  UserRole,
} from "./types";

type ApiEnvelope<T> = { success: true; data: T; message?: string };
type ApiFailure = {
  success: false;
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
};

export const SESSION_EXPIRED_EVENT = "artdera:session-expired";

function productionSafeApiBase(configured?: string) {
  const value = configured?.trim().replace(/\/$/, "");
  if (!value) return "";
  try {
    const url = new URL(value);
    if (
      import.meta.env.PROD &&
      (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
      return "";
    return url.origin;
  } catch {
    return "";
  }
}

function internalAppPath(value: unknown, fallback = "/account") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(value)
  )
    return fallback;
  return value;
}

export class HttpApiClient {
  private readonly base = productionSafeApiBase(import.meta.env.VITE_API_URL as string | undefined);

  async request<T>(method: string, path: string, payload?: unknown): Promise<ServiceResult<T>> {
    try {
      const response = await fetch(`${this.base}${path}`, {
        method,
        credentials: "include",
        headers: payload === undefined ? undefined : { "content-type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json")
        ? ((await response.json()) as ApiEnvelope<T> | ApiFailure)
        : undefined;
      if (!response.ok || !body?.success) {
        if (response.status === 401 && activeUser && path !== "/api/auth/login")
          expireClientSession();
        const error = body as ApiFailure | undefined;
        return {
          error: {
            code: error?.error?.code ?? `HTTP_${response.status || "ERROR"}`,
            message:
              error?.error?.message ??
              (response.status >= 500
                ? "ArtDera's secure service had a problem. Please try this action again."
                : "This action could not be completed. Please review the details and try again."),
          },
        };
      }
      return { data: body.data };
    } catch {
      return {
        error: {
          code: "API_UNAVAILABLE",
          message: "ArtDera could not reach the secure server. Please try again.",
        },
      };
    }
  }

  get<T>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, payload?: unknown) {
    return this.request<T>("POST", path, payload);
  }
  patch<T>(path: string, payload: unknown) {
    return this.request<T>("PATCH", path, payload);
  }
  delete<T>(path: string) {
    return this.request<T>("DELETE", path);
  }
  mutate<T>(path: string, payload: unknown) {
    return this.post<T>(path, payload);
  }
  async upload<T>(path: string, form: FormData): Promise<ServiceResult<T>> {
    try {
      const response = await fetch(`${this.base}${path}`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      return await uploadResponseResult<T>(response);
    } catch {
      return {
        error: { code: "API_UNAVAILABLE", message: "ArtDera could not reach the upload service." },
      };
    }
  }
}

export const apiClient = new HttpApiClient();

let activeUser: User | null = null;
let activeSubscription: Subscription | undefined;
let activeSelection: PlanSelection | undefined;
let activeDestination = "/";
let preferredBillingCycle: "monthly" | "annual" = "monthly";
let onboardingDraft: Record<string, unknown> = {};
let onboardingStep = 0;
let onboardingCompleted = false;
let artworkFormDraft: unknown;
let signupDraft: unknown;
let payments: Payment[] = [];
let invoices: Invoice[] = [];
let bootstrapPromise: Promise<void> | undefined;
let onboardingSaveTimer: ReturnType<typeof setTimeout> | undefined;

function expireClientSession() {
  activeUser = null;
  activeSubscription = undefined;
  activeSelection = undefined;
  activeDestination = "/account";
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

function selectionFromSubscription(subscription?: Subscription | null): PlanSelection | undefined {
  if (!subscription || !isPlanId(subscription.planId)) return undefined;
  const plan = PLANS[subscription.planId];
  if (!plan) return undefined;
  return {
    planId: subscription.planId,
    billingCycle: subscription.billingCycle,
    price: subscription.price,
    commission: subscription.commission,
    listingLimit: subscription.listingLimit,
    features: [...plan.features],
    selectedAt: subscription.startedAt ?? new Date().toISOString(),
  };
}

export function sanitizeText(value: string, maxLength = 1200) {
  return value
    .replace(/[<>\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function containsProtectedContact(value: string) {
  return /(https?:\/\/|wa\.me|whatsapp|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?92|0)?3\d{9})/i.test(
    value,
  );
}

const statusToOrderLabel: Record<string, string> = {
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
  payment_confirmed: "Payment Confirmed",
  seller_confirmed: "Seller Confirmed",
  preparing: "Preparing",
  ready_for_pickup: "Ready for Pickup",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  inspection_period: "Inspection Period",
  completed: "Completed",
  return_requested: "Return Requested",
  returned: "Returned",
  refunded: "Refunded",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

function mapOrder(value: Record<string, any>) {
  return {
    id: String(value.id ?? value._id),
    orderNumber: value.orderNumber,
    buyerId: String(value.buyerId),
    sellerId: String(value.sellerId),
    items: (value.items ?? []).map((item: Record<string, any>) => ({
      id: String(item.id ?? item._id),
      artworkId: String(item.artworkId),
      title: item.title,
      price: item.price,
      quantity: item.quantity,
      image: item.image ?? "",
    })),
    status: statusToOrderLabel[value.status] ?? value.status,
    subtotal: value.subtotal ?? value.artworkSubtotal ?? 0,
    discount: value.discount ?? 0,
    shipping: value.shipping ?? value.shippingCost ?? 0,
    packaging: value.packaging ?? value.packagingCost ?? 0,
    commission: value.commission ?? value.platformCommission ?? 0,
    total: value.total ?? value.buyerTotal ?? 0,
    deliveryCity: value.deliveryCity ?? value.shippingAddress?.city ?? "",
    createdAt: value.createdAt,
    trackingNumber: value.trackingNumber,
  } as Order;
}

function mapPromotion(value: Record<string, any>): Promotion {
  const label = String(value.status ?? "Draft")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    id: String(value.id ?? value._id),
    paymentId: value.paymentId ? String(value.paymentId) : undefined,
    artworkId: String(value.artworkId ?? ""),
    placementId: String(value.placementId ?? value.promotionType ?? "").replaceAll("_", "-"),
    status: (label === "Pending Approval" || label === "Pending Payment"
      ? "Pending"
      : label) as Promotion["status"],
    startDate: value.startDate ?? value.startAt,
    endDate: value.endDate ?? value.endAt,
    price: value.price ?? 0,
    impressions: value.impressions ?? 0,
    clicks: value.clicks ?? 0,
    saves: value.saves ?? 0,
    messages: value.messages ?? 0,
    conversions: value.conversions ?? 0,
  };
}

function mapPayment(value: Record<string, any>): Payment {
  const status =
    value.status === "successful"
      ? "Succeeded"
      : value.status === "failed"
        ? "Failed"
        : value.status === "processing"
          ? "Processing"
          : (value.status ?? "Pending Review");
  return {
    id: String(value.id ?? value._id),
    userId: String(value.userId),
    invoiceId: value.invoiceId ? String(value.invoiceId) : undefined,
    planId: value.planId ?? value.metadata?.targetPlanId ?? activeSelection?.planId ?? "free",
    billingCycle:
      value.billingCycle ?? value.metadata?.billingCycle ?? activeSelection?.billingCycle ?? "free",
    method: value.method ?? value.metadata?.method ?? "card",
    amount: value.amount ?? 0,
    status,
    reference: value.reference ?? value.providerReference ?? "",
    createdAt: value.createdAt,
    failureReason: value.failureReason,
  };
}

function mergeById<T extends { id: string }>(publicItems: T[], privateItems: T[] = []) {
  return [
    ...privateItems,
    ...publicItems.filter((item) => !privateItems.some((own) => own.id === item.id)),
  ];
}

function editorialProductFromArtwork(
  artwork: Artwork,
  stores: Store[],
  creators: EditorialCreator[],
): Product {
  const store = stores.find((item) => item.id === artwork.storeId);
  const creator = creators.find((item) => item.works.includes(artwork.slug));
  return {
    slug: artwork.slug,
    title: artwork.title,
    creatorSlug: creator?.slug ?? store?.slug ?? "artdera-creator",
    categorySlug: slugify(artwork.category),
    price: artwork.discountPrice ?? artwork.price,
    currency: "PKR",
    kind:
      artwork.kind === "Limited Edition"
        ? "Limited Edition"
        : artwork.kind === "Print"
          ? "Open Edition"
          : "Original",
    medium: artwork.medium,
    dimensions:
      typeof artwork.dimensions === "string"
        ? artwork.dimensions.replace(/\bcm\b/gi, "inches")
        : artwork.dimensions,
    year: artwork.year,
    framed: artwork.framed,
    colours: artwork.colours ?? [],
    style: artwork.style,
    subject: artwork.subject,
    tags: artwork.tags ?? [],
    room: [],
    description: artwork.description,
    story: artwork.story,
    images: (Array.isArray(artwork.images) ? artwork.images : [])
      .map((image) => image?.url)
      .filter((url): url is string => typeof url === "string" && url.length > 0),
    featured: artwork.sponsored,
    new: true,
  };
}

function hydratePublicCatalog(data: Record<string, any>) {
  const plans = (data.plans ?? []) as SubscriptionPlan[];
  hydrateSubscriptionPlans(plans);
  hydrateRuntimeConfig(data.runtime ?? {});
  const stores = (data.stores ?? []) as Store[];
  const artworks = (data.artworks ?? []) as Artwork[];
  const creatorsRaw = (data.creators ?? []) as Array<Record<string, any>>;
  const galleriesRaw = (data.galleries ?? []) as Array<Record<string, any>>;
  const creators: EditorialCreator[] = [...creatorsRaw, ...galleriesRaw].map((creator) => ({
    slug: creator.slug ?? slugify(creator.name),
    name: creator.name,
    handle: creator.handle ?? `@${slugify(creator.name)}`,
    location: creator.location ?? "Pakistan",
    discipline: creator.title ?? creator.type ?? "Visual art",
    bio: creator.bio ?? "",
    verified: Boolean(creator.verified),
    accountType: creator.accountType === "gallery" ? "gallery" : "artist",
    approvedSeller: Boolean(creator.approvedSeller),
    planId: isPlanId(creator.planId) ? creator.planId : undefined,
    subscriptionStatus: creator.subscriptionStatus,
    subscriptionExpiresAt: creator.subscriptionExpiresAt,
    portrait:
      creator.portrait ||
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&q=50&auto=format&fit=crop",
    works: artworks
      .filter(
        (artwork) =>
          artwork.artistId === creator.id ||
          stores.find((store) => store.id === artwork.storeId)?.ownerId === creator.id,
      )
      .map((artwork) => artwork.slug),
  }));
  const products = artworks.map((artwork) =>
    editorialProductFromArtwork(artwork, stores, creators),
  );
  const categories: EditorialCategory[] = CATEGORIES_LIST.map((name: string, index: number) => {
    const slug = slugify(name);
    return {
      slug,
      name,
      blurb: `Browse ${name.toLowerCase()} available from ArtDera sellers.`,
      image:
        products.find((product) => product.categorySlug === slug)?.images[0] ??
        Object.values(IMAGES)[index % 6],
    };
  });
  const collections: EditorialCollection[] = (data.collections ?? []).map(
    (collection: Record<string, any>) => ({
      slug: collection.slug,
      name: collection.name,
      blurb: collection.description ?? "",
      products: (collection.artworkIds ?? [])
        .map((id: string) => artworks.find((artwork) => artwork.id === id)?.slug)
        .filter(Boolean),
      cover:
        collection.coverImage ||
        products.find((product) =>
          collection.artworkIds?.includes(
            artworks.find((artwork) => artwork.slug === product.slug)?.id,
          ),
        )?.images[0] ||
        IMAGES.art1,
    }),
  );
  hydrateEditorialData({ categories, creators, products, collections });
  hydrateMarketplaceData({ stores, artworks, exhibitions: data.exhibitions ?? [] });
}

function hydratePrivate(data?: Record<string, any> | null) {
  if (!data) return;
  const ownStores = (data.stores ?? []) as Store[];
  const ownArtworks = (data.artworks ?? []) as Artwork[];
  activeSubscription = data.subscription ?? activeSubscription;
  payments = (data.payments ?? []).map(mapPayment);
  invoices = (data.invoices ?? []).map((value: Record<string, any>) => ({
    id: String(value.id ?? value._id),
    userId: String(value.userId),
    subscriptionId: String(value.subscriptionId ?? ""),
    planId: value.planId ?? activeSubscription?.planId ?? "free",
    billingCycle: value.billingCycle ?? activeSubscription?.billingCycle ?? "free",
    amount: value.amount ?? value.subtotal ?? 0,
    tax: value.tax ?? 0,
    discount: value.discount ?? 0,
    total: value.total ?? 0,
    status:
      value.status === "paid"
        ? "Paid"
        : value.status === "void"
          ? "Voided"
          : (value.status ?? "Pending"),
    issuedAt: value.issuedAt,
  }));
  hydrateMarketplaceData({
    stores: mergeById(STORES, ownStores),
    artworks: mergeById(ARTWORKS, ownArtworks),
    orders: (data.orders ?? []).map(mapOrder),
    conversations: (data.conversations ?? []).map((item: Record<string, any>) => ({
      id: String(item.id ?? item._id),
      participantIds: item.participantIds ?? item.participants?.map(String) ?? [],
      buyerId: String(item.buyerId),
      sellerId: String(item.sellerId),
      storeId: String(item.storeId),
      artworkId: item.artworkId ? String(item.artworkId) : undefined,
      lastMessageAt: item.lastMessageAt ?? item.updatedAt,
      unreadCount: item.unreadCount ?? 0,
      status: String(item.status ?? "Active").replace(/^./, (letter) => letter.toUpperCase()),
    })) as Conversation[],
    messages: (data.messages ?? []) as Message[],
    notifications: data.notifications ?? [],
    promotions: (data.promotions ?? []).map(mapPromotion),
    payouts: data.payouts ?? [],
    shipments: data.shipments ?? [],
    reviews: data.reviews ?? [],
  });
}

export class MarketplaceService {
  static async loadSession() {
    const session = await apiClient.get<{
      user: User | null;
      subscription: Subscription | null;
      planSelection?: PlanSelection | null;
      destination?: string;
    }>("/api/auth/session");
    if (session.data) {
      activeUser = session.data.user;
      activeSubscription = session.data.subscription ?? undefined;
      activeSelection =
        session.data.planSelection ?? selectionFromSubscription(session.data.subscription);
      activeDestination = internalAppPath(session.data.destination, "/");
    }
    return activeUser;
  }

  static async initialize() {
    await this.loadSession();
    await this.bootstrap(true);
    return activeUser;
  }

  static async bootstrap(force = false) {
    if (bootstrapPromise && !force) return bootstrapPromise;
    bootstrapPromise = (async () => {
      const result = await apiClient.get<Record<string, any>>("/api/bootstrap");
      if (result.error) throw new Error(result.error.message);
      hydratePublicCatalog(result.data!);
      hydratePrivate(result.data!.private);
      if (!activeSelection) activeSelection = selectionFromSubscription(activeSubscription);
      if (activeUser?.role === "admin") {
        const admin = await apiClient.get<Record<string, any>>("/api/admin/dashboard");
        if (admin.data) {
          hydrateAdminMetrics(admin.data.metrics ?? {});
          hydrateMarketplaceData({
            users: admin.data.users ?? [],
            stores: mergeById(STORES, admin.data.stores ?? []),
            artworks: mergeById(ARTWORKS, admin.data.artworks ?? []),
            orders: (admin.data.orders ?? []).map(mapOrder),
            promotions: (admin.data.promotions ?? []).map(mapPromotion),
            auditLogs: admin.data.auditLogs ?? [],
          });
        }
      }
      if (activeUser && ["artist", "gallery", "gallery_staff"].includes(activeUser.role)) {
        const draft = await apiClient.get<{
          step: number;
          data: Record<string, unknown>;
          completedAt?: string;
        }>("/api/stores/onboarding/draft/current");
        if (draft.data) {
          onboardingStep = draft.data.step;
          onboardingDraft = draft.data.data ?? {};
          onboardingCompleted = Boolean(
            draft.data.completedAt || STORES.some((store) => store.ownerId === activeUser?.id),
          );
        }
        const artDraft = await apiClient.get<unknown>("/api/drafts/artwork-form");
        artworkFormDraft = artDraft.data ?? undefined;
      }
    })().finally(() => {
      bootstrapPromise = undefined;
    });
    return bootstrapPromise;
  }

  static async loadArtworkPage(page: number, limit = 24) {
    const result = await apiClient.get<{
      items: Artwork[];
      page: number;
      limit: number;
      total: number;
      pages: number;
    }>(`/api/artworks?page=${page}&limit=${limit}`);
    if (!result.data) return result;
    const mergedArtworks = [
      ...ARTWORKS,
      ...result.data.items.filter((item) => !ARTWORKS.some((existing) => existing.id === item.id)),
    ];
    hydrateMarketplaceData({ artworks: mergedArtworks });
    const products = mergedArtworks.map((artwork) =>
      editorialProductFromArtwork(artwork, STORES, CREATORS),
    );
    PRODUCTS.splice(0, PRODUCTS.length, ...products);
    return result;
  }

  static async loadArtworksForStore(slug: string) {
    await MarketplaceService.bootstrap();
    const result = await StoreService.fetchBySlug(slug);
    if (result.data) {
      const newProducts = result.data.artworks.map((artwork) =>
        editorialProductFromArtwork(artwork, STORES, CREATORS),
      );
      const existingSlugs = new Set(PRODUCTS.map((p) => p.slug));
      const toAdd = newProducts.filter((p) => !existingSlugs.has(p.slug));
      PRODUCTS.push(...toAdd);

      const creator = CREATORS.find((c) => c.slug === slug);
      if (creator) {
        const productSlugs = newProducts.map((p) => p.slug);
        creator.works = Array.from(new Set([...creator.works, ...productSlugs]));
      }
    }
    return result;
  }
}

export class UserService {
  static list() {
    return SEEDED_USERS;
  }
  static getById(id: string) {
    return (
      SEEDED_USERS.find((user) => user.id === id) ??
      (activeUser?.id === id ? activeUser : undefined)
    );
  }
  static async create(input: Record<string, any> & { password: string }) {
    const payload = {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone ?? input.mobile,
      password: input.password,
      role: input.role ?? "buyer",
      sellerType: input.sellerType,
      city: input.city,
      province: input.province,
      country: input.country ?? "Pakistan",
      termsAccepted: input.termsAccepted ?? input.terms ?? true,
      privacyAccepted: input.privacyAccepted ?? input.terms ?? true,
      planId: input.planId ?? activeSelection?.planId,
      billingCycle: input.billingCycle ?? activeSelection?.billingCycle,
    };
    const result = await apiClient.post<User>("/api/auth/register", payload);
    if (result.data) {
      activeUser = result.data;
      if (!SEEDED_USERS.some((user) => user.id === result.data!.id))
        SEEDED_USERS.unshift(result.data);
      await MarketplaceService.bootstrap(true);
    }
    return result;
  }
  static async becomeSeller() {
    const result = await apiClient.post<{
      user: User;
      subscription: Subscription | null;
      destination: string;
    }>("/api/auth/become-seller", {});
    if (result.data) {
      activeUser = result.data.user;
      activeSubscription = result.data.subscription ?? undefined;
      activeSelection = selectionFromSubscription(result.data.subscription);
      activeDestination = internalAppPath(result.data.destination);
      await MarketplaceService.bootstrap(true);
    }
    return result;
  }
  static async updateContact(_userId: string, input: { email?: string; mobile?: string }) {
    const result = await apiClient.patch<User>("/api/auth/contact", {
      email: input.email,
      mobile: input.mobile,
    });
    if (result.data) activeUser = result.data;
    return result.data;
  }
  static async updateProfile(input: {
    fullName?: string;
    city?: string;
    province?: string;
    country?: string;
    avatarUrl?: string;
  }) {
    const result = await apiClient.patch<User>("/api/auth/profile", input);
    if (result.data) activeUser = result.data;
    return result;
  }
  static revokeOtherSessions() {
    return apiClient.post<{ revoked: number }>("/api/auth/sessions/revoke-others", {});
  }
  static async updateRole(_userId: string, _role: "artist" | "gallery") {
    return activeUser ?? undefined;
  }
}

export class AuthService {
  static async login(
    email: string,
    password: string,
  ): Promise<ServiceResult<{ user: User; destination: string }>> {
    const result = await apiClient.post<{ user: User; destination: string }>("/api/auth/login", {
      email,
      password,
    });
    if (result.data) {
      activeUser = result.data.user;
      activeDestination = internalAppPath(result.data.destination);
      await MarketplaceService.bootstrap(true);
    }
    return result;
  }
  static startSession(user: User) {
    activeUser = user;
  }
  static async currentUser() {
    return MarketplaceService.loadSession();
  }
  static getSession() {
    return activeUser
      ? { userId: activeUser.id, role: activeUser.role, email: activeUser.email, expiresAt: 0 }
      : null;
  }
  static async logout() {
    await apiClient.post("/api/auth/logout");
    activeUser = null;
    activeSubscription = undefined;
    activeSelection = undefined;
  }
  static destination() {
    return activeDestination;
  }
  static forgotPassword(email: string) {
    return apiClient.post<{ sent: boolean }>("/api/auth/forgot-password", { email });
  }
  static resetPassword(token: string, password: string, confirmPassword: string) {
    return apiClient.post<{ reset: boolean }>("/api/auth/reset-password", {
      token,
      password,
      confirmPassword,
    });
  }
}

export class ArtistService {
  static getStoreForUser(userId: string) {
    return STORES.find((store) => store.ownerId === userId);
  }
}

export class StoreService {
  static list() {
    return STORES;
  }
  static getBySlug(slug: string) {
    return STORES.find((store) => store.slug === slug);
  }
  static slugAvailable(slug: string) {
    return apiClient.get<{ slug: string; available: boolean }>(
      `/api/stores/slug-available/${encodeURIComponent(slug)}`,
    );
  }
  static async fetchBySlug(slug: string) {
    const result = await apiClient.get<{ store: Store; artworks: Artwork[] }>(
      `/api/stores/${encodeURIComponent(slug)}`,
    );
    if (result.data) {
      const storeIndex = STORES.findIndex((item) => item.id === result.data!.store.id);
      if (storeIndex >= 0) STORES[storeIndex] = result.data.store;
      else STORES.push(result.data.store);
      for (const artwork of result.data.artworks) {
        const index = ARTWORKS.findIndex((item) => item.id === artwork.id);
        if (index >= 0) ARTWORKS[index] = artwork;
        else ARTWORKS.push(artwork);
      }
    }
    return result;
  }
  static async save(store: Store) {
    const existing = /^[a-f\d]{24}$/i.test(store.id);
    const payload = {
      name: store.name,
      slug: store.slug,
      tagline: store.tagline,
      shortDescription: store.bio,
      fullDescription: store.story,
      logoUrl: store.profileImage,
      coverImageUrl: store.coverImage,
      city: store.location.split(",")[0]?.trim(),
      country: store.location.split(",")[1]?.trim() || "Pakistan",
      categories: store.categories,
      mediums: store.mediums,
      styles: [],
      themes: [],
      status: store.status === "Published" ? "active" : "draft",
    };
    const result = existing
      ? await apiClient.patch<Store>(`/api/stores/${store.id}`, payload)
      : await apiClient.post<Store>("/api/stores", payload);
    if (result.data) {
      const index = STORES.findIndex((item) => item.id === result.data!.id);
      if (index >= 0) STORES[index] = result.data;
      else STORES.unshift(result.data);
    }
    return result;
  }
}

export class GalleryService {
  static profile() {
    return apiClient.get<Record<string, any>>("/api/gallery/profile");
  }
  static updateProfile(input: Record<string, unknown>) {
    return apiClient.patch<Record<string, any>>("/api/gallery/profile", input);
  }
  static staff() {
    return apiClient.get<Array<Record<string, any>>>("/api/gallery/staff");
  }
  static inviteStaff(input: { email: string; role: string; permissions: string[] }) {
    return apiClient.post<Record<string, any>>("/api/gallery/staff/invite", input);
  }
  static updateStaff(
    id: string,
    input: { role?: string; permissions?: string[]; status?: "active" | "suspended" | "revoked" },
  ) {
    return apiClient.patch<Record<string, any>>(`/api/gallery/staff/${id}`, input);
  }
  static artists() {
    return apiClient.get<Array<Record<string, any>>>("/api/gallery/artists");
  }
  static inviteArtist(email: string) {
    return apiClient.post<Record<string, any>>("/api/gallery/artists", { email });
  }
  static exhibitions() {
    return apiClient.get<Array<Record<string, any>>>("/api/gallery/exhibitions");
  }
  static createExhibition(input: Record<string, unknown>) {
    return apiClient.post<Record<string, any>>("/api/gallery/exhibitions", input);
  }
  static updateExhibition(id: string, input: Record<string, unknown>) {
    return apiClient.patch<Record<string, any>>(`/api/gallery/exhibitions/${id}`, input);
  }
  static customers() {
    return apiClient.get<Array<Record<string, any>>>("/api/gallery/customers");
  }
}

export class ArtworkService {
  static list() {
    return ARTWORKS;
  }
  static forStore(storeId: string) {
    return ARTWORKS.filter((artwork) => artwork.storeId === storeId);
  }
  static async save(artwork: Artwork) {
    const existing = /^[a-f\d]{24}$/i.test(artwork.id);
    const payload = {
      storeId: artwork.storeId,
      title: artwork.title,
      ...(existing ? { slug: artwork.slug } : {}),
      description: artwork.description,
      story: artwork.story,
      category: artwork.category,
      medium: artwork.medium,
      style: artwork.style,
      subject: artwork.subject,
      year: artwork.year,
      kind: artwork.kind,
      price: artwork.price,
      discountPrice: artwork.discountPrice,
      dimensions: artwork.dimensions,
      weightKg: artwork.weightKg,
      framed: artwork.framed,
      orientation: artwork.orientation,
      images: artwork.images,
      status: artwork.status,
      quantity: artwork.quantity,
      domesticShipping: artwork.domesticShipping,
      internationalShipping: artwork.internationalShipping,
      certificate: artwork.certificate,
      tags: artwork.tags,
      customOrders: artwork.customOrders,
    };
    const result = existing
      ? await apiClient.patch<Artwork>(`/api/artworks/${artwork.id}`, payload)
      : await apiClient.post<Artwork>("/api/artworks", payload);
    if (result.data) {
      const index = ARTWORKS.findIndex((item) => item.id === result.data!.id);
      if (index >= 0) ARTWORKS[index] = result.data;
      else ARTWORKS.unshift(result.data);
    }
    return result;
  }
  static async updateMany(ids: string[], status: Artwork["status"]) {
    const action = status === "Archived" ? "archive" : status === "Draft" ? "restore" : "submit";
    const result = await apiClient.patch<Artwork[]>("/api/artworks/bulk", { ids, action });
    if (result.data) {
      for (const artwork of result.data) {
        const index = ARTWORKS.findIndex((item) => item.id === artwork.id);
        if (index >= 0) ARTWORKS[index] = artwork;
      }
    }
    return result;
  }
  static async deleteMany(ids: string[]) {
    const result = await apiClient.patch<{ ids: string[] }>("/api/artworks/bulk", {
      ids,
      action: "delete",
    });
    if (result.data)
      ARTWORKS.splice(0, ARTWORKS.length, ...ARTWORKS.filter((item) => !ids.includes(item.id)));
    return result;
  }
}

export class ArtworkDraftService {
  static read<T>(fallback: T) {
    return (artworkFormDraft as T | undefined) ?? fallback;
  }
  static save<T>(value: T) {
    artworkFormDraft = value;
    void apiClient.patch("/api/drafts/artwork-form", { data: value });
    return true;
  }
  static clear() {
    artworkFormDraft = undefined;
    void apiClient.delete("/api/drafts/artwork-form");
  }
}

export class UploadService {
  static async upload(
    file: File,
    purpose: "artwork" | "profile" | "cover" | "message" | "verification" | "payment_proof",
  ) {
    let preparedFile = file;
    if (file.type.startsWith("image/")) {
      try {
        preparedFile = await prepareImageForUpload(file);
      } catch (error) {
        return {
          error: {
            code: "IMAGE_PREPARATION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "The selected image could not be prepared for upload.",
          },
        };
      }
    }
    const form = new FormData();
    form.set("file", preparedFile);
    form.set("purpose", purpose);
    form.set(
      "access",
      purpose === "verification" || purpose === "payment_proof" ? "private" : "public",
    );
    return apiClient.upload<{
      id: string;
      publicId: string;
      url: string;
      mimeType: string;
      size: number;
      access: "public" | "private";
    }>("/api/uploads", form);
  }
  static remove(publicId: string) {
    return apiClient.delete<{ publicId: string; deleted: boolean }>(
      `/api/uploads/${encodeURIComponent(publicId)}`,
    );
  }
}

export type CartEntry = {
  artwork: Artwork;
  quantity: number;
  priceChanged: boolean;
  available: boolean;
};

export type ShippingQuote = {
  id: string;
  artworkId: string;
  buyerName?: string;
  buyerPhone?: string;
  country: string;
  city: string;
  province?: string;
  postalCode?: string;
  shippingAddress?: string;
  quantity: number;
  status: string;
  quotedShippingCost?: number;
  quotedPackagingCost?: number;
  estimatedDeliveryTime?: string;
  artwork?: Record<string, any>;
};

export class ShippingQuoteService {
  static request(input: {
    artworkId: string;
    quantity?: number;
    shippingAddress: CheckoutAddress;
  }) {
    return apiClient.post<{ quoteId: string }>("/api/shipping-quotes", input);
  }

  static list() {
    return apiClient.get<ShippingQuote[]>("/api/shipping-quotes");
  }

  static accept(id: string) {
    return apiClient.patch<{ id: string; status: "accepted" }>(
      `/api/shipping-quotes/${encodeURIComponent(id)}/accept`,
      {},
    );
  }
}

export class CartService {
  static get() {
    return apiClient.get<{ items: CartEntry[]; subtotal: number }>("/api/cart");
  }
  static add(artworkId: string, quantity = 1) {
    return apiClient.post<{ artworkId: string; quantity: number }>("/api/cart/items", {
      artworkId,
      quantity,
    });
  }
  static remove(artworkId: string) {
    return apiClient.delete<{ artworkId: string }>(`/api/cart/items/${artworkId}`);
  }
}

export class WishlistService {
  static list() {
    return apiClient.get<Artwork[]>("/api/wishlist");
  }
  static save(artworkId: string) {
    return apiClient.post<{ artworkId: string; saved: boolean }>(`/api/wishlist/${artworkId}`);
  }
  static remove(artworkId: string) {
    return apiClient.delete<{ artworkId: string; saved: boolean }>(`/api/wishlist/${artworkId}`);
  }
}

export class FollowService {
  static list() {
    return apiClient.get<Store[]>("/api/follows");
  }
  static follow(storeId: string) {
    return apiClient.post<{ storeId: string; following: boolean }>(`/api/follows/${storeId}`);
  }
  static unfollow(storeId: string) {
    return apiClient.delete<{ storeId: string; following: boolean }>(`/api/follows/${storeId}`);
  }
}

export type CheckoutAddress = {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode?: string;
  country: string;
  phone: string;
};

export type CheckoutResult = {
  orders: Array<{
    order: ReturnType<typeof mapOrder>;
    payment: { id: string; status: string; amount: number };
    paymentInstructions?: ManualPaymentInstructions;
    invoiceId: string;
    shipmentId: string;
  }>;
  estimateNotice: string;
};

export type AffiliateCheckoutPreview = {
  originalArtworkPrice: number;
  affiliateDiscount: number;
  finalArtworkPrice: number;
  shipping: number;
  packaging: number;
  taxes: number;
  total: number;
  eligibleArtworkPrice: number;
  attribution?: {
    code: string;
    discountRate: number;
    applied: boolean;
    message: string;
  };
};

export type ManualPaymentInstructions = {
  method: "jazzcash" | "easypaisa" | "hbl";
  label: "JazzCash" | "Easypaisa" | "HBL (Bank Transfer)";
  accountTitle: string;
  accountNumber: string;
  iban?: string;
  qrCode?: string;
  amount: number;
  orderId: string;
  paymentId: string;
  instruction: string;
};

export type PaymentProof = {
  id: string;
  paymentId: string;
  orderId?: string;
  paymentType?: "order" | "subscription" | "promotion";
  method: "jazzcash" | "easypaisa" | "hbl";
  amount: number;
  fullName: string;
  mobileNumber: string;
  transactionId: string;
  screenshotUrl?: string;
  note?: string;
  status: string;
  attempt: number;
  submittedAt: string;
  rejectionReason?: string;
};

export type ManualPaymentDetails = {
  order: ReturnType<typeof mapOrder>;
  payment: { id: string; status: string; amount: number };
  paymentInstructions: ManualPaymentInstructions;
  latestProof?: PaymentProof;
  canSubmit: boolean;
};

export type GenericManualPaymentDetails = {
  payment: { id: string; status: string; amount: number };
  paymentType: "order" | "subscription" | "promotion";
  paymentInstructions: Omit<ManualPaymentInstructions, "orderId"> & { referenceLabel: string };
  latestProof?: PaymentProof;
  canSubmit: boolean;
  returnPath: string;
};

export class CheckoutService {
  static create(input: {
    shippingAddress: CheckoutAddress;
    billingAddress?: CheckoutAddress;
    method: PaymentMethod;
    shippingQuoteId?: string;
    affiliateCode?: string;
    idempotencyKey: string;
  }) {
    return apiClient.post<CheckoutResult>("/api/checkout", input);
  }
  static confirmDemo(paymentId: string, outcome: "success" | "failure" = "success") {
    return apiClient.post<{ payment: Record<string, unknown>; order: Record<string, any> }>(
      `/api/order-payments/${paymentId}/confirm-demo`,
      { outcome },
    );
  }
  static getManual(paymentId: string) {
    return apiClient.get<ManualPaymentDetails>(
      `/api/order-payments/${encodeURIComponent(paymentId)}/manual`,
    );
  }
  static submitProof(
    paymentId: string,
    input: {
      fullName: string;
      mobileNumber: string;
      transactionId: string;
      screenshotId: string;
      note?: string;
    },
  ) {
    return apiClient.post<{
      proof: PaymentProof;
      orderId: string;
      paymentStatus: "Pending Verification";
      orderStatus: "Awaiting Payment Approval";
    }>(`/api/order-payments/${encodeURIComponent(paymentId)}/proof`, input);
  }
}

export type AffiliateDashboardData = {
  affiliate: null | {
    id: string;
    userId: string;
    code: string;
    status: "pending" | "approved" | "rejected" | "disabled";
    commissionRate: number;
    buyerDiscountRate: number;
    referralLink: string;
    rejectionReason?: string;
    createdAt: string;
  };
  settings: {
    enabled: boolean;
    attributionDays: number;
    minimumPayoutUsd: number;
    minimumPayoutPkr: number;
    defaultCommissionRate: number;
    defaultBuyerDiscountRate: number;
  };
  metrics: {
    totalClicks: number;
    uniqueClicks: number;
    successfulOrders: number;
    pendingCommissions: number;
    approvedCommissions: number;
    paidCommissions: number;
    availableBalance: number;
    pendingBalance: number;
    totalEarnings: number;
    generatedRevenue: number;
    conversionRate: number;
  };
  commissions: AffiliateCommissionRecord[];
  recentOrders: AffiliateCommissionRecord[];
  payouts: AffiliatePayoutRecord[];
};

export type AffiliateCommissionRecord = {
  id: string;
  affiliateId: string;
  affiliateCode?: string;
  orderId: string;
  orderReference: string;
  artwork: string;
  eligibleSaleAmount: number;
  commissionRate: number;
  commissionAmount: number;
  buyerDiscountAmount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  rejectionReason?: string;
  createdAt: string;
};

export type AffiliatePayoutRecord = {
  id: string;
  affiliateId: string;
  affiliateCode?: string;
  amount: number;
  currency: "PKR";
  status: "requested" | "approved" | "processing" | "paid" | "rejected" | "cancelled";
  payoutMethod: string;
  requestedAt: string;
  processedAt?: string;
  transactionReference?: string;
  rejectionReason?: string;
};

export class AffiliateService {
  static program() {
    return apiClient.get<{
      enabled: boolean;
      commissionRate: number;
      buyerDiscountRate: number;
      attributionDays: number;
      minimumPayoutUsd: number;
    }>("/api/affiliate/program");
  }
  static capture(code: string, landingPage: string) {
    return apiClient.post<{ captured: boolean; preserved: boolean; code?: string }>(
      "/api/affiliate/referrals/capture",
      { code, landingPage },
    );
  }
  static checkoutPreview(code?: string, shippingQuoteId?: string) {
    return apiClient.post<AffiliateCheckoutPreview>("/api/affiliate/checkout-preview", {
      ...(code ? { code } : {}),
      ...(shippingQuoteId ? { shippingQuoteId } : {}),
    });
  }
  static dashboard() {
    return apiClient.get<AffiliateDashboardData>("/api/affiliate/dashboard");
  }
  static apply(requestedCode?: string) {
    return apiClient.post<NonNullable<AffiliateDashboardData["affiliate"]>>(
      "/api/affiliate/apply",
      requestedCode ? { requestedCode } : {},
    );
  }
  static changeCode(code: string) {
    return apiClient.patch<NonNullable<AffiliateDashboardData["affiliate"]>>(
      "/api/affiliate/code",
      { code },
    );
  }
  static requestPayout() {
    return apiClient.post<AffiliatePayoutRecord>("/api/affiliate/payouts", {
      payoutMethod: "manual",
    });
  }
}

export type AdminAffiliateRecord = NonNullable<AffiliateDashboardData["affiliate"]> & {
  totalClicks: number;
  uniqueClicks: number;
  suspiciousActivityCount: number;
  user?: { id: string; fullName: string; email: string; role: string };
  metrics: {
    clicks: number;
    orders: number;
    generatedSales: number;
    pending: number;
    approved: number;
    paid: number;
    payoutRequests: number;
  };
};

export type AffiliateAdminAnalytics = {
  summary: {
    totalClicks: number;
    uniqueClicks: number;
    successfulOrders: number;
    generatedRevenue: number;
    commissions: number;
    buyerDiscounts: number;
  };
  topAffiliates: Array<{
    affiliateId: string;
    code: string;
    orders: number;
    revenue: number;
    commissions: number;
  }>;
  topArtworks: Array<{
    artworkId: string;
    title: string;
    slug?: string;
    orders: number;
    revenue: number;
  }>;
};

export class AdminAffiliateService {
  static affiliates(page = 1, q = "", status = "") {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    return apiClient.get<{
      items: AdminAffiliateRecord[];
      page: number;
      pages: number;
      total: number;
    }>(`/api/admin/affiliate/affiliates?${params.toString()}`);
  }
  static updateAffiliate(
    id: string,
    input: {
      action: "approve" | "reject" | "enable" | "disable" | "update";
      reason?: string;
      commissionRate?: number;
      buyerDiscountRate?: number;
      code?: string;
    },
  ) {
    return apiClient.patch<AdminAffiliateRecord>(
      `/api/admin/affiliate/affiliates/${encodeURIComponent(id)}`,
      input,
    );
  }
  static commissions(status = "") {
    return apiClient.get<AffiliateCommissionRecord[]>(
      `/api/admin/affiliate/commissions${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    );
  }
  static updateCommission(id: string, action: "approve" | "reject", reason?: string) {
    return apiClient.patch<{ id: string; status: string }>(
      `/api/admin/affiliate/commissions/${encodeURIComponent(id)}`,
      { action, reason },
    );
  }
  static payouts() {
    return apiClient.get<AffiliatePayoutRecord[]>("/api/admin/affiliate/payouts");
  }
  static updatePayout(
    id: string,
    action: "approve" | "process" | "mark_paid" | "reject",
    input: { reason?: string; transactionReference?: string } = {},
  ) {
    return apiClient.patch<AffiliatePayoutRecord>(
      `/api/admin/affiliate/payouts/${encodeURIComponent(id)}`,
      { action, ...input },
    );
  }
  static activity() {
    return apiClient.get<Array<Record<string, any>>>("/api/admin/affiliate/activity");
  }
  static analytics() {
    return apiClient.get<AffiliateAdminAnalytics>("/api/admin/affiliate/analytics");
  }
  static settings() {
    return apiClient.get<{
      enabled: boolean;
      defaultCommissionRate: number;
      defaultBuyerDiscountRate: number;
      attributionDays: number;
      minimumPayoutUsd: number;
      usdToPkrRate: number;
      autoApproveApplications: boolean;
      allowDiscountStacking: boolean;
    }>("/api/admin/affiliate/settings");
  }
  static updateSettings(input: {
    enabled: boolean;
    defaultCommissionRate: number;
    defaultBuyerDiscountRate: number;
    attributionDays: number;
    minimumPayoutUsd: number;
    usdToPkrRate: number;
    autoApproveApplications: boolean;
    allowDiscountStacking: boolean;
  }) {
    return apiClient.patch<typeof input>("/api/admin/affiliate/settings", input);
  }
}

export class ManualPaymentService {
  static get(paymentId: string) {
    return apiClient.get<GenericManualPaymentDetails>(
      `/api/payments/${encodeURIComponent(paymentId)}/manual`,
    );
  }

  static submitProof(
    paymentId: string,
    input: {
      fullName: string;
      mobileNumber: string;
      transactionId: string;
      screenshotId: string;
      note?: string;
    },
  ) {
    return apiClient.post<{ proof: PaymentProof }>(
      `/api/payments/${encodeURIComponent(paymentId)}/proof`,
      input,
    );
  }
}

export class OrderService {
  static listFor(userId: string, role: UserRole) {
    return ORDERS.filter((order) =>
      role === "buyer" ? order.buyerId === userId : order.sellerId === userId,
    );
  }
  static async refresh(view?: "buyer" | "seller") {
    const result = await apiClient.get<Array<Record<string, any>>>(
      `/api/orders${view ? `?view=${view}` : ""}`,
    );
    if (result.data) hydrateMarketplaceData({ orders: result.data.map(mapOrder) });
    return result;
  }
  static async updateStatus(id: string, status: string) {
    const apiStatus = status.toLowerCase().replaceAll(" ", "_");
    const result = await apiClient.patch<Record<string, any>>(`/api/orders/${id}/status`, {
      status: apiStatus,
    });
    if (result.data) {
      const mapped = mapOrder(result.data);
      const index = ORDERS.findIndex((item) => item.id === id);
      if (index >= 0) ORDERS[index] = mapped;
    }
    return result;
  }
  static shipping(orderId: string) {
    return apiClient.get<Record<string, any> | null>(`/api/shipping/${orderId}`);
  }
  static estimateShipping(input: {
    city: string;
    province?: string;
    weightKg: number;
    fragile: boolean;
    framed: boolean;
    packagingType: "art_box" | "wooden_crate" | "tube";
  }) {
    return apiClient.post<{
      currency: "PKR";
      courierCost: number;
      packagingCost: number;
      total: number;
      ruleName: string;
      isCourierQuote: false;
      notice: string;
    }>("/api/shipping/estimate", input);
  }
  static updateShipping(
    orderId: string,
    input: { courier?: string; trackingNumber?: string; status?: string; actualCost?: number },
  ) {
    return apiClient.patch<Record<string, any>>(`/api/shipping/${orderId}`, input);
  }
}

export class NotificationService {
  static list() {
    return apiClient.get<Notification[]>("/api/notifications");
  }
  static read(id: string) {
    return apiClient.patch<{ id: string; read: boolean }>(`/api/notifications/${id}/read`, {});
  }
  static readAll() {
    return apiClient.post<{ read: boolean }>("/api/notifications/read-all");
  }
  static remove(id: string) {
    return apiClient.delete<{ id: string }>(`/api/notifications/${id}`);
  }
  static preferences() {
    return apiClient.get<Record<string, boolean>>("/api/notification-preferences");
  }
  static updatePreferences(input: Record<string, boolean>) {
    return apiClient.patch<Record<string, boolean>>("/api/notification-preferences", input);
  }
}

export class SupportService {
  static list() {
    return apiClient.get<Record<string, unknown>[]>("/api/support");
  }
  static create(input: {
    category: string;
    subject: string;
    description: string;
    priority?: "low" | "normal" | "high";
  }) {
    return apiClient.post<Record<string, unknown>>("/api/support", input);
  }
  static reply(id: string, message: string) {
    return apiClient.post<Record<string, unknown>>(`/api/support/${id}/messages`, { message });
  }
}

export class NewsletterService {
  static subscribe(email: string, source = "website") {
    return apiClient.post<{ subscribed: boolean }>("/api/newsletter", { email, source });
  }
}

export class CustomerService {
  static list() {
    return apiClient.get<Record<string, unknown>[]>("/api/customers");
  }
}

export class AnalyticsService {
  static get(range: "today" | "7d" | "30d" | "3m" | "1y" = "30d") {
    return apiClient.get<{
      range: string;
      from: string;
      metrics: Record<string, number>;
      series: Array<{ _id: { date: string; type: string }; count: number; value: number }>;
    }>(`/api/analytics?range=${range}`);
  }
}

export class ReviewService {
  static publicForStore(storeId: string) {
    return apiClient.get<
      Array<{
        id: string;
        rating: number;
        title: string;
        body: string;
        sellerResponse?: string;
        createdAt: string;
      }>
    >(`/api/reviews/public/${storeId}`);
  }
  static create(input: {
    orderId: string;
    artworkId: string;
    rating: number;
    title: string;
    comment: string;
  }) {
    return apiClient.post<Record<string, unknown>>("/api/reviews", input);
  }
  static respond(id: string, response: string) {
    return apiClient.patch<Record<string, unknown>>(`/api/reviews/${id}/respond`, { response });
  }
}

export class MessageService {
  static conversationsFor(userId: string) {
    return CONVERSATIONS.filter((conversation) => conversation.participantIds.includes(userId));
  }
  static messagesFor(conversationId: string) {
    return MESSAGES.filter((message) => message.conversationId === conversationId);
  }
  static async listConversations() {
    const result = await apiClient.get<Conversation[]>("/api/messages/conversations");
    if (result.data) CONVERSATIONS.splice(0, CONVERSATIONS.length, ...result.data);
    return result;
  }
  static async getConversation(id: string) {
    const result = await apiClient.get<{
      conversation: Conversation;
      messages: Message[];
      offers: Record<string, unknown>[];
      consultations: Record<string, unknown>[];
    }>(`/api/messages/conversations/${id}`);
    if (result.data) {
      const conversationIndex = CONVERSATIONS.findIndex((item) => item.id === id);
      if (conversationIndex >= 0) CONVERSATIONS[conversationIndex] = result.data.conversation;
      else CONVERSATIONS.unshift(result.data.conversation);
      MESSAGES.splice(
        0,
        MESSAGES.length,
        ...MESSAGES.filter((item) => item.conversationId !== id),
        ...result.data.messages,
      );
    }
    return result;
  }
  static async createConversation(storeId: string, artworkId?: string, message?: string) {
    const result = await apiClient.post<Conversation>("/api/messages/conversations", {
      storeId,
      artworkId,
      message,
    });
    if (result.data && !CONVERSATIONS.some((item) => item.id === result.data!.id))
      CONVERSATIONS.unshift(result.data);
    return result;
  }
  static async send(
    conversationId: string,
    text: string,
    attachment?: { url: string; name: string; mimeType: string; size: number },
  ) {
    const result = await apiClient.post<Message>(
      `/api/messages/conversations/${conversationId}/messages`,
      {
        text,
        type: attachment?.mimeType.startsWith("image/")
          ? "image"
          : attachment
            ? "document"
            : "text",
        attachments: attachment ? [attachment] : [],
      },
    );
    if (result.data) MESSAGES.push(result.data);
    return result;
  }
  static markRead(conversationId: string) {
    return apiClient.post<{ read: boolean }>(`/api/messages/conversations/${conversationId}/read`);
  }
  static changeStatus(
    conversationId: string,
    action: "archive" | "unarchive" | "block" | "unblock" | "report",
  ) {
    return apiClient.patch<Conversation>(`/api/messages/conversations/${conversationId}/status`, {
      action,
    });
  }
  static createOffer(conversationId: string, offeredPrice: number, message?: string) {
    return apiClient.post<Record<string, unknown>>("/api/messages/offers", {
      conversationId,
      offeredPrice,
      message,
      expiresInHours: 48,
    });
  }
  static updateOffer(
    id: string,
    action: "accept" | "reject" | "counter" | "withdraw",
    counterPrice?: number,
  ) {
    return apiClient.patch<Record<string, unknown>>(`/api/messages/offers/${id}`, {
      action,
      counterPrice,
    });
  }
  static requestConsultation(input: {
    conversationId: string;
    requestedDate: string;
    requestedTime: string;
    timezone: string;
    message?: string;
  }) {
    return apiClient.post<Record<string, unknown>>("/api/messages/consultations", input);
  }
  static updateConsultation(
    id: string,
    input: {
      action: "accept" | "reject" | "suggest_alternate" | "cancel" | "complete";
      meetingUrl?: string;
    },
  ) {
    return apiClient.patch<Record<string, unknown>>(`/api/messages/consultations/${id}`, input);
  }
}

export class PromotionService {
  static list() {
    return PROMOTIONS;
  }
  static async create(
    input: Omit<Promotion, "id">,
    method: "jazzcash" | "easypaisa" = "jazzcash",
  ): Promise<ServiceResult<Promotion>> {
    const result = await apiClient.post<{
      promotion: Record<string, any>;
      payment: { id: string };
    }>("/api/promotions", {
      artworkId: input.artworkId,
      promotionType: input.placementId.replaceAll("-", "_"),
      requestedPrice: input.price,
      placement: input.placementId,
      startAt: input.startDate,
      method,
    });
    if (result.error) return { error: result.error };
    if (!DEMO_PAYMENT_MODE) {
      const promotion = mapPromotion({
        ...result.data!.promotion,
        paymentId: result.data!.payment.id,
      });
      PROMOTIONS.unshift(promotion);
      return { data: promotion } satisfies ServiceResult<Promotion>;
    }
    const confirmation = await apiClient.post<Record<string, any>>(
      `/api/promotions/${result.data!.promotion.id}/confirm-demo`,
      { outcome: "success" },
    );
    if (confirmation.error) return { error: confirmation.error };
    const promotion = mapPromotion(confirmation.data!);
    PROMOTIONS.unshift(promotion);
    return { data: promotion } satisfies ServiceResult<Promotion>;
  }
}

export class AdminService {
  static canAccess(user?: User | null) {
    return user?.role === "admin";
  }
  static resource(
    resource: string,
    page = 1,
    query = "",
    filters: { role?: UserRole; status?: User["status"]; limit?: number } = {},
  ) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(filters.limit ?? 50),
    });
    if (query) params.set("q", query);
    if (filters.role) params.set("role", filters.role);
    if (filters.status) params.set("status", filters.status);
    return apiClient.get<{
      items: Array<Record<string, any>>;
      page: number;
      limit: number;
      total: number;
      pages: number;
    }>(`/api/admin/resources/${encodeURIComponent(resource)}?${params.toString()}`);
  }
  static userStatus(id: string, status: "active" | "suspended" | "locked" | "deleted") {
    return apiClient.patch<User>(`/api/admin/users/${id}/status`, { status });
  }
  static changeUserPassword(id: string, newPassword: string) {
    return apiClient.patch<{ success: true }>(`/api/admin/users/${id}/password`, { newPassword });
  }
  static moderateArtwork(id: string, decision: "approve" | "reject", reason?: string) {
    return apiClient.patch<Artwork>(`/api/admin/artworks/${id}/moderation`, { decision, reason });
  }
  static updateArtworkImage(id: string, imageUrl: string) {
    return apiClient.patch<Artwork>(`/api/admin/artworks/${id}/image`, { imageUrl });
  }
  static verification(
    id: string,
    decision: "approve" | "reject" | "request_changes" | "remove",
    reason?: string,
  ) {
    return apiClient.patch<Record<string, unknown>>(`/api/admin/verification/${id}`, {
      decision,
      reason,
    });
  }
  static promotion(id: string, decision: "approve" | "reject" | "cancel", reason?: string) {
    return apiClient.patch<Record<string, unknown>>(`/api/admin/promotions/${id}`, {
      decision,
      reason,
    });
  }
  static plan(
    planId: PlanId,
    input: {
      monthlyPrice?: number;
      annualPrice?: number | null;
      listingLimit?: number | null;
      commissionRate?: number;
      features?: string[];
      permissions?: string[];
      isActive?: boolean;
    },
  ) {
    return apiClient.patch<SubscriptionPlan>(`/api/plans/${planId}`, input);
  }
  static setting(key: string, value: unknown, isPublic = false) {
    return apiClient.patch<Record<string, unknown>>(
      `/api/admin/settings/${encodeURIComponent(key)}`,
      { value, isPublic },
    );
  }
  static paymentProofs(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiClient.get<Array<Record<string, any>>>(`/api/admin/payment-proofs${query}`);
  }
  static reviewPaymentProof(
    id: string,
    action: "approve" | "reject" | "request_information",
    reason?: string,
  ) {
    return apiClient.patch<Record<string, unknown>>(
      `/api/admin/payment-proofs/${encodeURIComponent(id)}`,
      { action, reason },
    );
  }

  static shippingQuotes(page = 1) {
    return this.resource("shippingQuotes", page, "", { limit: 50 });
  }

  static quoteShipping(
    id: string,
    input: {
      quotedShippingCost: number;
      quotedPackagingCost: number;
      estimatedDeliveryTime?: string;
    },
  ) {
    return apiClient.patch<Record<string, unknown>>(
      `/api/admin/shipping-quotes/${encodeURIComponent(id)}`,
      { status: "quote_provided", ...input },
    );
  }
}

export class PlanService {
  static list() {
    return Object.values(PLANS);
  }
  static get(planId: PlanId) {
    return PLANS[planId];
  }
  static isValid(value: unknown): value is PlanId {
    return isPlanId(value);
  }
  static price(planId: PlanId, billingCycle: BillingCycle) {
    return planPrice(planId, billingCycle);
  }
  static higherThan(planId: PlanId) {
    return this.list().filter((plan) => PLAN_RANK[plan.id] > PLAN_RANK[planId]);
  }
}

function emptyFlow(): ArtistFlowState {
  return {
    selection: activeSelection,
    preferredBilling: preferredBillingCycle,
    userId: activeUser?.id,
    signupComplete: Boolean(activeUser),
    verificationComplete: Boolean(activeUser),
    paymentComplete: activeSubscription?.status === "Active",
    paymentStatus: activeSubscription?.status === "Active" ? "Succeeded" : undefined,
    onboardingStep,
    onboardingComplete: onboardingCompleted,
    storeId: activeUser ? STORES.find((store) => store.ownerId === activeUser!.id)?.id : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export class SubscriptionService {
  static getFlow() {
    return emptyFlow();
  }
  static saveFlow(patch: Partial<ArtistFlowState>) {
    if (patch.selection) activeSelection = patch.selection;
    if (patch.preferredBilling === "monthly" || patch.preferredBilling === "annual")
      preferredBillingCycle = patch.preferredBilling;
    if (typeof patch.onboardingStep === "number") onboardingStep = patch.onboardingStep;
    if (typeof patch.onboardingComplete === "boolean")
      onboardingCompleted = patch.onboardingComplete;
    return { ...emptyFlow(), ...patch };
  }
  static async selectPlan(planId: PlanId, requestedCycle?: BillingCycle) {
    const billingCycle = validBillingCycle(planId, requestedCycle);
    const result = await apiClient.post<PlanSelection>("/api/plans/select", {
      planId,
      billingCycle,
    });
    if (result.data) {
      activeSelection = result.data;
      preferredBillingCycle = result.data.billingCycle === "annual" ? "annual" : "monthly";
    }
    return result;
  }
  static getSelection() {
    return activeSelection;
  }
  static preferredBilling() {
    return preferredBillingCycle;
  }
  static setPreferredBilling(value: "monthly" | "annual") {
    preferredBillingCycle = value;
    return emptyFlow();
  }
  static attachUser(userId: string) {
    return this.saveFlow({ userId, signupComplete: true });
  }
  static markPayment(status: Payment["status"]) {
    return this.saveFlow({ paymentStatus: status, paymentComplete: status === "Succeeded" });
  }
  static markOnboardingStep(step: number) {
    onboardingStep = Math.max(0, Math.min(7, step));
    return emptyFlow();
  }
  static confirmGalleryRegistration(userId: string) {
    return this.saveFlow({ userId, galleryRegistrationConfirmed: true });
  }
  static completeOnboarding(storeId: string) {
    onboardingCompleted = true;
    onboardingStep = 7;
    activeDestination = "/artist/dashboard";
    return this.saveFlow({ storeId, onboardingComplete: true, onboardingStep: 7 });
  }
  static destinationFor(user: User) {
    if (!["artist", "gallery", "gallery_staff"].includes(user.role)) return ROLE_HOME[user.role];
    if (!activeSubscription) return "/sell/plans";
    if (activeSubscription.planId !== "free" && activeSubscription.status !== "Active")
      return "/artist/checkout";
    return onboardingCompleted ? "/artist/dashboard" : "/artist/onboarding";
  }
  static list() {
    return activeSubscription ? [activeSubscription] : [];
  }
  static getForUser(userId: string) {
    return activeSubscription?.userId === userId ? activeSubscription : undefined;
  }
  static async activate(_userId: string, planId: PlanId, requestedCycle: BillingCycle) {
    const selected = await this.selectPlan(planId, requestedCycle);
    return selected.data;
  }
  static async updateStatus(_userId: string, status: Subscription["status"]) {
    if (status !== "Cancelled") return activeSubscription;
    const result = await apiClient.post<Subscription>("/api/subscriptions/cancel", {
      immediately: false,
    });
    if (result.data) activeSubscription = result.data;
    return result.data;
  }
  static async scheduleDowngrade(
    userId: string,
    toPlanId: PlanId,
    effective: PlanDowngrade["effective"],
  ) {
    const current = this.getForUser(userId);
    if (!current) return undefined;
    const result = await apiClient.post<
      { subscription?: Subscription; archivedArtworkIds?: string[] } | Subscription
    >("/api/subscriptions/change", {
      planId: toPlanId,
      billingCycle: toPlanId === "free" ? "free" : "monthly",
      effective,
      keepArtworkIds: ArtworkService.list()
        .filter((artwork) => ["Published", "Pending Review", "Reserved"].includes(artwork.status))
        .slice(0, PLANS[toPlanId].listingLimit ?? 200)
        .map((artwork) => artwork.id),
    });
    if (result.error) return undefined;
    const value = result.data as { subscription?: Subscription; archivedArtworkIds?: string[] };
    activeSubscription = value.subscription ?? (result.data as Subscription);
    return {
      id: `server-${Date.now()}`,
      userId,
      fromPlanId: current.planId,
      toPlanId,
      effective,
      effectiveAt: activeSubscription?.pendingChangeAt ?? new Date().toISOString(),
      archivedArtworkIds: value.archivedArtworkIds ?? [],
      status: effective === "immediately" ? "Completed" : "Scheduled",
    } satisfies PlanDowngrade;
  }
  static planFor(role: UserRole): PlanId {
    return role === "gallery" || role === "gallery_staff"
      ? "gallery"
      : role === "artist"
        ? "professional"
        : "free";
  }
  static planForUser(user: User): PlanId {
    return this.getForUser(user.id)?.planId ?? this.planFor(user.role);
  }
}

export class InvoiceService {
  static listFor(userId: string) {
    return invoices.filter((invoice) => invoice.userId === userId);
  }
  static create(_userId: string, _subscription: Subscription, _status: Invoice["status"] = "Paid") {
    return invoices[0];
  }
}

export class PaymentService {
  static listFor(userId: string) {
    return payments.filter((payment) => payment.userId === userId);
  }
  static async process(input: { userId: string; method: PaymentMethod; pendingReview?: boolean }) {
    if (!activeSelection || activeSelection.planId === "free") {
      return {
        error: { code: "NO_PAID_PLAN", message: "A paid plan is required for checkout." },
      } satisfies ServiceResult<Payment>;
    }
    const initiated = await apiClient.post<Record<string, any>>("/api/subscriptions/payment", {
      planId: activeSelection.planId,
      billingCycle: activeSelection.billingCycle,
      method: input.method,
    });
    if (initiated.error) return initiated as ServiceResult<Payment>;
    if (input.pendingReview) {
      const pending = mapPayment(initiated.data!);
      payments.unshift(pending);
      return { data: pending };
    }
    if (!DEMO_PAYMENT_MODE) {
      const pending = mapPayment(initiated.data!);
      payments.unshift(pending);
      return { data: pending };
    }
    const confirmed = await apiClient.post<{ payment: Record<string, any> }>(
      `/api/subscriptions/payment/${initiated.data!.id}/confirm-demo`,
      {
        outcome: "success",
      },
    );
    if (confirmed.error) return { error: confirmed.error } as ServiceResult<Payment>;
    const payment = mapPayment(confirmed.data!.payment);
    payments.unshift(payment);
    await MarketplaceService.bootstrap(true);
    return { data: payment };
  }
}

export class VerificationService {
  static list() {
    return apiClient.get<Record<string, any>[]>("/api/verification");
  }
  static submit(input: {
    storeId: string;
    type: "artist" | "gallery";
    submittedData?: Record<string, unknown>;
    documentReferences?: string[];
  }) {
    return apiClient.post<Record<string, any>>("/api/verification", {
      submittedData: {},
      documentReferences: [],
      ...input,
    });
  }
}

export class FeatureAccessService {
  static canAccess(planId: PlanId, module: string) {
    return Boolean(PLANS[planId]?.allowedModules.includes(module));
  }
  static requiredPlan(module: string): PlanId {
    if (["managed-artists", "staff", "inventory", "exhibitions", "reports"].includes(module))
      return "gallery";
    return "professional";
  }
  static usage(userId: string, storeId?: string): PlanUsage {
    const artworks = storeId ? ArtworkService.forStore(storeId) : [];
    return {
      userId,
      activeListings: artworks.filter((artwork) =>
        ["Published", "Pending Review", "Reserved"].includes(artwork.status),
      ).length,
      managedArtists: 0,
      staffAccounts: STAFF.length,
      exhibitionPages: EXHIBITIONS.length,
      storageUsedMb: 0,
    };
  }
}

export class PlanChangeService {
  static recordUpgrade(
    userId: string,
    fromPlanId: PlanId,
    toPlanId: PlanId,
    paymentId?: string,
  ): PlanUpgrade {
    return {
      id: paymentId ?? `upgrade-${Date.now()}`,
      userId,
      fromPlanId,
      toPlanId,
      effectiveAt: new Date().toISOString(),
      paymentId,
      status: "Completed",
    };
  }
}

export class OnboardingService {
  static read<T>(fallback: T) {
    return Object.keys(onboardingDraft).length ? (onboardingDraft as T) : fallback;
  }
  static save<T>(value: T, step = onboardingStep) {
    onboardingDraft = value as Record<string, unknown>;
    onboardingStep = step;
    if (onboardingSaveTimer) clearTimeout(onboardingSaveTimer);
    onboardingSaveTimer = setTimeout(() => {
      void apiClient.patch("/api/stores/onboarding/draft/current", { data: value, step });
    }, 350);
    return true;
  }
  static async complete<T>(data: T) {
    const result = await apiClient.post<{
      store: Store;
      artwork?: Artwork;
      ignoredFeatures?: string[];
    }>("/api/stores/onboarding/complete", { data });
    if (result.data) {
      onboardingCompleted = true;
      onboardingStep = 7;
      onboardingDraft = {};
      const storeIndex = STORES.findIndex((store) => store.id === result.data!.store.id);
      if (storeIndex >= 0) STORES[storeIndex] = result.data.store;
      else STORES.unshift(result.data.store);
      if (result.data.artwork) {
        const artworkIndex = ARTWORKS.findIndex(
          (artwork) => artwork.id === result.data!.artwork!.id,
        );
        if (artworkIndex >= 0) ARTWORKS[artworkIndex] = result.data.artwork;
        else ARTWORKS.unshift(result.data.artwork);
      }
    }
    return result;
  }
  static clear() {
    onboardingDraft = {};
  }
}

export class SignupProgressService {
  static read<T>(fallback: T) {
    return (signupDraft as T | undefined) ?? fallback;
  }
  static save<T>(value: T) {
    signupDraft = value;
    return true;
  }
  static clear() {
    signupDraft = undefined;
  }
}

export function canAccessRole(user: User | null, roles: UserRole[]) {
  return Boolean(user && roles.includes(user.role));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Re-export live collections for modules that use the service adapter as their data boundary.
export const marketplaceState = {
  users: SEEDED_USERS,
  stores: STORES,
  artworks: ARTWORKS,
  orders: ORDERS,
  conversations: CONVERSATIONS,
  messages: MESSAGES,
  promotions: PROMOTIONS,
  shipments: SHIPMENTS,
  payouts: PAYOUTS,
  staff: STAFF,
  exhibitions: EXHIBITIONS,
  customers: CUSTOMERS,
  reviews: REVIEWS,
  verifications: VERIFICATIONS,
  notifications: NOTIFICATIONS,
  analytics: ANALYTICS,
  auditLog: AUDIT_LOG,
  adminMetrics: ADMIN_METRICS,
  categories: CATEGORIES,
  creators: CREATORS,
  products: PRODUCTS,
  collections: COLLECTIONS,
};
