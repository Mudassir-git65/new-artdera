import type {
  AnalyticsRecord,
  Artwork,
  AuditLog,
  Conversation,
  CustomerRecord,
  Exhibition,
  Message,
  Notification,
  Order,
  Payout,
  Promotion,
  Review,
  Shipment,
  StaffMember,
  Store,
  User,
  VerificationRequest,
} from "./types";

// These arrays are hydrated in-place from /api/bootstrap. Keeping their identities stable lets the
// existing UI consume live API state without retaining a second browser-side source of truth.
export const SEEDED_USERS: User[] = [];
export const STORES: Store[] = [];
export const ARTWORKS: Artwork[] = [];
export const ORDERS: Order[] = [];
export const CONVERSATIONS: Conversation[] = [];
export const MESSAGES: Message[] = [];
export const PROMOTIONS: Promotion[] = [];
export const SHIPMENTS: Shipment[] = [];
export const PAYOUTS: Payout[] = [];
export const STAFF: StaffMember[] = [];
export const EXHIBITIONS: Exhibition[] = [];
export const CUSTOMERS: CustomerRecord[] = [];
export const REVIEWS: Review[] = [];
export const VERIFICATIONS: VerificationRequest[] = [];
export const NOTIFICATIONS: Notification[] = [];
export const ANALYTICS: AnalyticsRecord[] = [];
export const AUDIT_LOG: AuditLog[] = [];

export const ADMIN_METRICS = {
  totalUsers: 0,
  activeArtists: 0,
  galleries: 0,
  buyers: 0,
  publishedArtworks: 0,
  pendingArtworks: 0,
  pendingVerification: 0,
  orders: 0,
  openDisputes: 0,
  pendingPayouts: 0,
  gmv: 0,
  subscriptionRevenue: 0,
  commissionRevenue: 0,
  promotionRevenue: 0,
};

function replace<T>(target: T[], source: T[] | undefined) {
  target.splice(0, target.length, ...(source ?? []));
}

export function hydrateMarketplaceData(input: {
  users?: User[];
  stores?: Store[];
  artworks?: Artwork[];
  orders?: Order[];
  conversations?: Conversation[];
  messages?: Message[];
  promotions?: Promotion[];
  shipments?: Shipment[];
  payouts?: Payout[];
  staff?: StaffMember[];
  exhibitions?: Exhibition[];
  customers?: CustomerRecord[];
  reviews?: Review[];
  verifications?: VerificationRequest[];
  notifications?: Notification[];
  analytics?: AnalyticsRecord[];
  auditLogs?: AuditLog[];
}) {
  if (input.users) replace(SEEDED_USERS, input.users);
  if (input.stores) replace(STORES, input.stores);
  if (input.artworks) replace(ARTWORKS, input.artworks);
  if (input.orders) replace(ORDERS, input.orders);
  if (input.conversations) replace(CONVERSATIONS, input.conversations);
  if (input.messages) replace(MESSAGES, input.messages);
  if (input.promotions) replace(PROMOTIONS, input.promotions);
  if (input.shipments) replace(SHIPMENTS, input.shipments);
  if (input.payouts) replace(PAYOUTS, input.payouts);
  if (input.staff) replace(STAFF, input.staff);
  if (input.exhibitions) replace(EXHIBITIONS, input.exhibitions);
  if (input.customers) replace(CUSTOMERS, input.customers);
  if (input.reviews) replace(REVIEWS, input.reviews);
  if (input.verifications) replace(VERIFICATIONS, input.verifications);
  if (input.notifications) replace(NOTIFICATIONS, input.notifications);
  if (input.analytics) replace(ANALYTICS, input.analytics);
  if (input.auditLogs) replace(AUDIT_LOG, input.auditLogs);
}

export function hydrateAdminMetrics(metrics: Record<string, number>) {
  Object.assign(ADMIN_METRICS, {
    totalUsers: metrics.totalUsers ?? 0,
    activeArtists: metrics.artists ?? 0,
    galleries: metrics.galleries ?? 0,
    buyers: metrics.buyers ?? 0,
    publishedArtworks: metrics.publishedArtworks ?? metrics.artworks ?? 0,
    pendingArtworks: metrics.pendingModeration ?? 0,
    pendingVerification: metrics.pendingVerification ?? 0,
    orders: metrics.orders ?? 0,
    openDisputes: metrics.openDisputes ?? 0,
    pendingPayouts: metrics.pendingPayouts ?? 0,
    gmv: metrics.gmv ?? 0,
    subscriptionRevenue: metrics.subscriptionRevenue ?? 0,
    commissionRevenue: metrics.commissionRevenue ?? 0,
    promotionRevenue: metrics.promotionRevenue ?? 0,
  });
}
