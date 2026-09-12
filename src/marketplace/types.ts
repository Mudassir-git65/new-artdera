export const USER_ROLES = [
  "artist",
  "gallery",
  "gallery_staff",
  "buyer",
  "admin",
  "moderator",
  "support",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ARTWORK_STATUSES = [
  "Draft",
  "Pending Review",
  "Published",
  "Rejected",
  "Sold",
  "Reserved",
  "Archived",
] as const;
export type ArtworkStatus = (typeof ARTWORK_STATUSES)[number];

export const ORDER_STATUSES = [
  "Awaiting Payment",
  "Paid",
  "Payment Confirmed",
  "Seller Confirmed",
  "Preparing",
  "Ready for Pickup",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Inspection Period",
  "Completed",
  "Return Requested",
  "Returned",
  "Refunded",
  "Cancelled",
  "Disputed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PROMOTION_STATUSES = [
  "Draft",
  "Pending",
  "Scheduled",
  "Active",
  "Completed",
  "Rejected",
  "Cancelled",
] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const SHIPPING_STATUSES = [
  "Packaging Required",
  "Awaiting Pickup",
  "Picked Up",
  "In Transit",
  "Delivered",
  "Delayed",
  "Damaged",
  "Returned",
] as const;
export type ShippingStatus = (typeof SHIPPING_STATUSES)[number];

export type PlanId = "free" | "professional" | "gallery";
export type BillingCycle = "free" | "monthly" | "annual";
export type SubscriptionStatus =
  | "Trial"
  | "Active"
  | "Pending Payment"
  | "Payment Review"
  | "Payment Failed"
  | "Past Due"
  | "Cancelled"
  | "Expired"
  | "Suspended";
export type PaymentMethod = "card" | "bank-transfer" | "easypaisa" | "jazzcash" | "raast";
export type AnalyticsLevel = "Basic" | "Detailed" | "Advanced";

export interface PlanFeature {
  id: string;
  label: string;
  description: string;
}

export interface PlanPermission {
  module: string;
  access: "allowed" | "locked";
  requiredPlan?: PlanId;
}

export interface PlanUsage {
  userId: string;
  activeListings: number;
  managedArtists: number;
  staffAccounts: number;
  exhibitionPages: number;
  storageUsedMb: number;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile?: string;
  city: string;
  province?: string;
  country: string;
  role: UserRole;
  /** Seller capability attached to this account; buyer features remain available. */
  sellerType?: "artist" | "gallery" | null;
  avatar?: string;
  status?: "pending_verification" | "active" | "suspended" | "locked" | "deleted";
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt: string;
}

export interface Buyer extends User {
  role: "buyer";
  wishlist: string[];
  followedStoreIds: string[];
  marketingConsent: boolean;
}

export interface Artist extends User {
  role: "artist";
  planId: PlanId;
  storeId: string;
  professionalTitle: string;
  verificationStatus: VerificationStatus;
  languages: string[];
}

export interface Gallery extends User {
  role: "gallery";
  planId: "gallery";
  storeId: string;
  staffIds: string[];
  managedArtistIds: string[];
  verificationStatus: VerificationStatus;
}

export interface StaffMember {
  id: string;
  galleryId: string;
  name: string;
  email: string;
  role:
    "Gallery Owner" | "Manager" | "Curator" | "Inventory Staff" | "Customer Support" | "Analyst";
  permissions: string[];
  status: "Active" | "Invited" | "Suspended";
}

export interface Store {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  tagline: string;
  bio: string;
  story: string;
  location: string;
  categories: string[];
  mediums: string[];
  coverImage: string;
  profileImage: string;
  featuredArtworkId?: string;
  verified: boolean;
  ownerType?: "artist" | "gallery";
  approvedSeller?: boolean;
  planId?: PlanId;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: string;
  status: "Draft" | "Published" | "Suspended";
  followers: number;
  rating: number;
  reviewCount: number;
}

export interface ArtworkImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}

export interface Artwork {
  id: string;
  storeId: string;
  artistId?: string;
  galleryId?: string;
  creatorName: string;
  slug: string;
  title: string;
  description: string;
  story?: { text: string; updatedAt?: string };
  category: string;
  medium: string;
  style: string;
  subject: string;
  colours?: string[];
  year: number;
  kind: "Original" | "Print" | "Limited Edition";
  price: number;
  discountPrice?: number;
  dimensions: string;
  weightKg: number;
  framed: boolean;
  orientation: "Portrait" | "Landscape" | "Square";
  images: ArtworkImage[];
  status: ArtworkStatus;
  quantity: number;
  domesticShipping: boolean;
  internationalShipping: boolean;
  certificate: boolean;
  tags: string[];
  customOrders: boolean;
  views: number;
  saves: number;
  messages: number;
  sponsored: boolean;
  shipsFromCountry?: string;
  shipsFromCity?: string;
  packagedWeight?: number;
  packageDimensions?: { width: number; height: number; length: number; unit: "cm" | "in" };
  canFramedArtworkBeShippedInternationally?: boolean;
  requiresWoodenCratePackaging?: boolean;
  internationalShippingNotes?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  activeArtworkCount: number;
}
export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string;
  artworkIds: string[];
  coverImage: string;
}
export interface Exhibition {
  id: string;
  galleryId: string;
  name: string;
  description: string;
  venue: string;
  startDate: string;
  endDate: string;
  artistIds: string[];
  artworkIds: string[];
  coverImage: string;
  format: "Online" | "Physical" | "Hybrid";
  published: boolean;
}

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  annualPrice?: number;
  listingLimit: number | null;
  commission: number;
  profile: string;
  analytics: AnalyticsLevel;
  payoutTime: string;
  staffLimit?: string;
  recommended?: boolean;
  features: string[];
  billingOptions: BillingCycle[];
  buttonLabel: string;
  styleId: "free" | "professional" | "gallery";
  allowedModules: string[];
  lockedModules: string[];
  upgradeTarget?: PlanId;
  sellerType: "artist" | "gallery";
  verification: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  startedAt: string;
  renewsAt?: string;
  price: number;
  commission: number;
  listingLimit: number | null;
  featureIds: string[];
  cancelledAt?: string;
  cancelAtPeriodEnd?: boolean;
  pendingPlanId?: PlanId;
  pendingChangeAt?: string;
}

export type UserSubscription = Subscription;

export interface Invoice {
  id: string;
  userId: string;
  subscriptionId: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  amount: number;
  tax: number;
  discount: number;
  total: number;
  status: "Paid" | "Pending" | "Voided";
  issuedAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  invoiceId?: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  method: PaymentMethod;
  amount: number;
  status: "Processing" | "Succeeded" | "Failed" | "Pending Review";
  reference: string;
  createdAt: string;
  failureReason?: string;
}

export interface PlanUpgrade {
  id: string;
  userId: string;
  fromPlanId: PlanId;
  toPlanId: PlanId;
  effectiveAt: string;
  paymentId?: string;
  status: "Pending" | "Completed" | "Cancelled";
}

export interface PlanDowngrade {
  id: string;
  userId: string;
  fromPlanId: PlanId;
  toPlanId: PlanId;
  effective: "immediately" | "end-of-cycle";
  effectiveAt: string;
  archivedArtworkIds: string[];
  status: "Scheduled" | "Completed" | "Cancelled";
}

export interface PlanSelection {
  planId: PlanId;
  billingCycle: BillingCycle;
  price: number;
  commission: number;
  listingLimit: number | null;
  features: string[];
  selectedAt: string;
}

export interface ArtistFlowState {
  selection?: PlanSelection;
  preferredBilling?: BillingCycle;
  userId?: string;
  signupComplete: boolean;
  verificationComplete: boolean;
  paymentComplete: boolean;
  paymentStatus?: Payment["status"];
  onboardingStep: number;
  onboardingComplete: boolean;
  galleryRegistrationConfirmed?: boolean;
  storeId?: string;
  updatedAt: string;
}
export interface PromotionPlacement {
  id: string;
  name: string;
  priceMin: number;
  priceMax: number;
  durationDays: number;
  requiresApproval: boolean;
  description: string;
}
export interface Promotion {
  id: string;
  paymentId?: string;
  artworkId: string;
  placementId: string;
  status: PromotionStatus;
  startDate: string;
  endDate: string;
  price: number;
  impressions: number;
  clicks: number;
  saves: number;
  messages: number;
  conversions: number;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  read: boolean;
  attachmentName?: string;
  attachments?: Array<{ url: string; name: string; mimeType: string; size: number }>;
}
export interface Conversation {
  id: string;
  participantIds: string[];
  buyerId: string;
  sellerId: string;
  storeId: string;
  artworkId?: string;
  lastMessageAt: string;
  unreadCount: number;
  status: "Active" | "Archived" | "Blocked" | "Spam";
}
export interface Offer {
  id: string;
  conversationId: string;
  artworkId: string;
  buyerId: string;
  amount: number;
  status: "Pending" | "Accepted" | "Rejected" | "Countered" | "Expired";
  createdAt: string;
}
export interface VideoConsultation {
  id: string;
  conversationId: string;
  requestedBy: string;
  preferredDate: string;
  preferredTime: string;
  message: string;
  status: "Requested" | "Accepted" | "Reschedule Suggested" | "Declined";
  meetingLink?: string;
}
export interface OrderItem {
  id: string;
  artworkId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
}
export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  items: OrderItem[];
  status: OrderStatus;
  subtotal: number;
  discount: number;
  shipping: number;
  packaging: number;
  commission: number;
  total: number;
  deliveryCity: string;
  createdAt: string;
  trackingNumber?: string;
  isInternational?: boolean;
  shippingQuoteId?: string;
  deliveryEstimate?: string;
}
export interface Shipment {
  id: string;
  orderId: string;
  status: ShippingStatus;
  courier: string;
  trackingNumber?: string;
  pickupCity: string;
  deliveryCity: string;
  estimatedCost: number;
  updatedAt: string;
}
export interface ShippingQuote {
  id: string;
  buyerId: string;
  sellerId: string;
  storeId: string;
  artworkId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  country: string;
  city: string;
  postalCode?: string;
  shippingAddress: string;
  quantity: number;
  status: "new_request" | "quote_provided" | "accepted" | "rejected";
  quotedShippingCost?: number;
  quotedPackagingCost?: number;
  estimatedDeliveryTime?: string;
  adminNotes?: string;
  quoteProvidedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  artwork?: Artwork;
}
export interface Payout {
  id: string;
  sellerId: string;
  orderId: string;
  gross: number;
  commission: number;
  shippingDeduction: number;
  taxEstimate: number;
  processingDeduction: number;
  refundAdjustment: number;
  net: number;
  status: "Pending" | "On Hold" | "Available" | "Paid";
  estimatedDate: string;
}
export interface Review {
  id: string;
  orderId: string;
  artworkId: string;
  buyerId: string;
  sellerId: string;
  rating: number;
  title: string;
  body: string;
  sellerResponse?: string;
  status: "Published" | "Pending" | "Reported";
  createdAt: string;
}
export type VerificationStatus =
  "Not Submitted" | "Pending Review" | "Approved" | "Changes Requested" | "Rejected";
export interface VerificationRequest {
  id: string;
  sellerId: string;
  type: "Artist" | "Gallery";
  identityStatus: VerificationStatus;
  portfolioStatus: VerificationStatus;
  phoneVerified: boolean;
  emailVerified: boolean;
  ownershipDeclared: boolean;
  registrationStatus?: VerificationStatus;
  submittedAt?: string;
}
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  href?: string;
}
export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  category: string;
  priority: "Low" | "Normal" | "High";
  status: "Open" | "Waiting" | "Resolved";
  createdAt: string;
}
export interface CustomerRecord {
  id: string;
  sellerId: string;
  buyerName: string;
  completedOrders: number;
  totalSpending: number;
  lastPurchase: string;
  favouriteCategory: string;
  notes: string;
  tags: string[];
  followUpAt?: string;
  city: string;
  country: string;
  marketingConsent: boolean;
  contactVisible: boolean;
}
export interface AnalyticsRecord {
  id: string;
  storeId: string;
  date: string;
  storeViews: number;
  artworkViews: number;
  uniqueVisitors: number;
  saves: number;
  messages: number;
  offers: number;
  videoRequests: number;
  orders: number;
  revenue: number;
  source: string;
  city: string;
  country: string;
}
export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface DemoSession {
  userId: string;
  role: UserRole;
  email: string;
  expiresAt: number;
}
export interface ServiceResult<T> {
  data?: T;
  error?: { code: string; message: string };
}
