import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const objectId = Schema.Types.ObjectId;
const timestamps = { timestamps: true, versionKey: false } as const;
const requiredString = { type: String, required: true, trim: true } as const;
const money = { type: Number, required: true, min: 0 } as const;
const imageSchema = new Schema(
  {
    url: requiredString,
    publicId: { type: String, trim: true },
    alt: { type: String, trim: true, maxlength: 180, default: "" },
    isPrimary: { type: Boolean, default: false },
    size: { type: Number, min: 0 },
    mimeType: { type: String, trim: true },
  },
  { _id: true, versionKey: false },
);
const addressSchema = new Schema(
  {
    fullName: { type: String, trim: true, maxlength: 120 },
    line1: { type: String, trim: true, maxlength: 180 },
    line2: { type: String, trim: true, maxlength: 180 },
    city: { type: String, trim: true, maxlength: 100 },
    province: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 24 },
    country: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 30 },
  },
  { _id: false, versionKey: false },
);

function modelFor<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const userSchema = new Schema(
  {
    fullName: { ...requiredString, maxlength: 120 },
    email: { ...requiredString, maxlength: 254 },
    emailNormalized: { ...requiredString, lowercase: true, select: false },
    phone: { type: String, trim: true, maxlength: 30 },
    phoneNormalized: { type: String, trim: true, select: false },
    passwordHash: { ...requiredString, select: false },
    role: {
      type: String,
      enum: ["buyer", "artist", "gallery", "gallery_staff", "admin", "moderator", "support"],
      default: "buyer",
      index: true,
    },
    sellerType: { type: String, enum: ["artist", "gallery", null], default: null },
    status: {
      type: String,
      enum: ["pending_verification", "active", "suspended", "locked", "deleted"],
      default: "pending_verification",
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    avatarUrl: { type: String, trim: true },
    city: { type: String, trim: true, maxlength: 100, default: "" },
    province: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 80, default: "Pakistan" },
    lastLoginAt: Date,
    failedLoginAttempts: { type: Number, default: 0, min: 0, select: false },
    lockedUntil: { type: Date, select: false },
    passwordChangedAt: { type: Date, select: false },
    termsAcceptedAt: { type: Date, required: true },
    privacyAcceptedAt: { type: Date, required: true },
    // Password-reset flow — only populated during an active reset request
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
  },
  timestamps,
);
userSchema.index(
  { emailNormalized: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
userSchema.index(
  { phoneNormalized: 1 },
  { unique: true, sparse: true, collation: { locale: "en", strength: 2 } },
);
export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = modelFor("User", userSchema);

const socialLinks = {
  instagram: { type: String, trim: true, maxlength: 500 },
  facebook: { type: String, trim: true, maxlength: 500 },
  linkedin: { type: String, trim: true, maxlength: 500 },
  youtube: { type: String, trim: true, maxlength: 500 },
} as const;
const verification = {
  type: String,
  enum: ["not_submitted", "pending", "under_review", "approved", "changes_requested", "rejected"],
  default: "not_submitted",
  index: true,
} as const;

export const ArtistProfileModel = modelFor(
  "ArtistProfile",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, unique: true, index: true },
      displayName: { ...requiredString, maxlength: 120 },
      professionalTitle: { type: String, trim: true, maxlength: 120, default: "" },
      shortBio: { type: String, trim: true, maxlength: 300, default: "" },
      fullBio: { type: String, trim: true, maxlength: 5000, default: "" },
      profileImageUrl: String,
      coverImageUrl: String,
      signatureImageUrl: String,
      city: { type: String, trim: true, maxlength: 100, default: "" },
      province: { type: String, trim: true, maxlength: 100, default: "" },
      country: { type: String, trim: true, maxlength: 80, default: "Pakistan" },
      languages: [{ type: String, trim: true, maxlength: 50 }],
      yearStarted: { type: Number, min: 1800, max: 2200 },
      categories: [{ type: String, trim: true, maxlength: 80 }],
      styles: [{ type: String, trim: true, maxlength: 80 }],
      mediums: [{ type: String, trim: true, maxlength: 80 }],
      themes: [{ type: String, trim: true, maxlength: 80 }],
      portfolioUrl: { type: String, trim: true, maxlength: 500 },
      socialLinks,
      customCommissionsAvailable: { type: Boolean, default: false },
      verificationStatus: verification,
      verificationBadge: { type: Boolean, default: false },
      onboardingCompleted: { type: Boolean, default: false },
      onboardingStep: { type: Number, min: 0, max: 7, default: 0 },
    },
    timestamps,
  ),
);

export const GalleryProfileModel = modelFor(
  "GalleryProfile",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, unique: true, index: true },
      galleryName: { ...requiredString, maxlength: 160 },
      legalName: { type: String, trim: true, maxlength: 180, select: false },
      description: { type: String, trim: true, maxlength: 5000, default: "" },
      logoUrl: String,
      coverImageUrl: String,
      registrationNumber: { type: String, trim: true, maxlength: 120, select: false },
      taxNumber: { type: String, trim: true, maxlength: 120, select: false },
      city: { type: String, trim: true, maxlength: 100, default: "" },
      province: { type: String, trim: true, maxlength: 100, default: "" },
      country: { type: String, trim: true, maxlength: 80, default: "Pakistan" },
      website: { type: String, trim: true, maxlength: 500 },
      socialLinks,
      verificationStatus: verification,
      onboardingCompleted: { type: Boolean, default: false },
    },
    timestamps,
  ),
);

export const storeSchema = new Schema(
  {
    ownerId: { type: objectId, ref: "User", required: true, index: true },
    ownerType: { type: String, enum: ["artist", "gallery"], required: true },
    name: { ...requiredString, maxlength: 160 },
    slug: { ...requiredString, lowercase: true, maxlength: 80, unique: true, index: true },
    tagline: { type: String, trim: true, maxlength: 180, default: "" },
    shortDescription: { type: String, trim: true, maxlength: 400, default: "" },
    fullDescription: { type: String, trim: true, maxlength: 5000, default: "" },
    logoUrl: String,
    coverImageUrl: String,
    featuredArtworkId: { type: objectId, ref: "Artwork" },
    categories: [{ type: String, trim: true, maxlength: 80 }],
    styles: [{ type: String, trim: true, maxlength: 80 }],
    mediums: [{ type: String, trim: true, maxlength: 80 }],
    themes: [{ type: String, trim: true, maxlength: 80 }],
    city: { type: String, trim: true, maxlength: 100, index: true },
    province: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 80, default: "Pakistan" },
    status: {
      type: String,
      enum: ["draft", "pending_review", "active", "suspended", "archived"],
      default: "draft",
      index: true,
    },
    verificationStatus: verification,
    isPublished: { type: Boolean, default: false, index: true },
    domesticShipping: { type: Boolean, default: true },
    internationalShipping: { type: Boolean, default: false },
    processingTime: { type: String, trim: true, maxlength: 80, default: "3-5 working days" },
    publicContactPreference: {
      type: String,
      enum: ["messages", "eligible_orders"],
      default: "messages",
    },
    customCommissionAvailable: { type: Boolean, default: false },
    totalViews: { type: Number, default: 0, min: 0 },
    totalFollowers: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  timestamps,
);
storeSchema.index({ isPublished: 1, status: 1, createdAt: -1 });
export type StoreDocument = InferSchemaType<typeof storeSchema>;
export const StoreModel = modelFor("Store", storeSchema);

export const artworkSchema = new Schema(
  {
    storeId: { type: objectId, ref: "Store", required: true, index: true },
    artistId: { type: objectId, ref: "User", index: true },
    galleryId: { type: objectId, ref: "GalleryProfile", index: true },
    title: { ...requiredString, maxlength: 180 },
    slug: { ...requiredString, lowercase: true, maxlength: 100, unique: true, index: true },
    description: { type: String, trim: true, maxlength: 8000, default: "" },
    story: {
      text: { type: String, trim: true, maxlength: 2000, default: "" },
      updatedAt: { type: Date },
    },
    category: { ...requiredString, maxlength: 80, index: true },
    medium: { ...requiredString, maxlength: 80, index: true },
    style: { type: String, trim: true, maxlength: 80, index: true },
    subject: { type: String, trim: true, maxlength: 100 },
    themes: [{ type: String, trim: true, maxlength: 80 }],
    colours: [{ type: String, trim: true, maxlength: 50 }],
    yearCreated: { type: Number, min: 1000, max: 2200 },
    artworkType: { type: String, enum: ["original", "print", "limited_edition"], required: true },
    editionType: { type: String, enum: ["open", "limited", "unique", null], default: null },
    editionNumber: { type: Number, min: 1 },
    editionTotal: { type: Number, min: 1 },
    price: { ...money, index: true },
    discountPrice: { type: Number, min: 0 },
    currency: { type: String, enum: ["PKR"], default: "PKR" },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    depth: { type: Number, min: 0 },
    measurementUnit: { type: String, enum: ["cm", "in"], default: "cm" },
    weight: { type: Number, min: 0 },
    weightUnit: { type: String, enum: ["kg", "lb"], default: "kg" },
    orientation: { type: String, enum: ["portrait", "landscape", "square"], index: true },
    isFramed: { type: Boolean, default: false, index: true },
    hasGlass: { type: Boolean, default: false },
    isFragile: { type: Boolean, default: false },
    quantity: { type: Number, min: 0, default: 1 },
    images: { type: [imageSchema], default: [] },
    videoUrl: String,
    certificateAvailable: { type: Boolean, default: false },
    certificateNumber: { type: String, trim: true, maxlength: 120, select: false },
    pickupCity: { type: String, trim: true, maxlength: 100, index: true },
    domesticShipping: { type: Boolean, default: true },
    internationalShipping: { type: Boolean, default: false, index: true },
    shipsFromCountry: { type: String, trim: true, maxlength: 80, default: "Pakistan" },
    shipsFromCity: { type: String, trim: true, maxlength: 100 },
    packagedWeight: { type: Number, min: 0 },
    packageDimensions: {
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      length: { type: Number, min: 0 },
      unit: { type: String, enum: ["cm", "in"], default: "cm" },
    },
    canFramedArtworkBeShippedInternationally: { type: Boolean, default: false },
    requiresWoodenCratePackaging: { type: Boolean, default: false },
    internationalShippingNotes: { type: String, trim: true, maxlength: 1000 },
    processingTime: { type: String, trim: true, maxlength: 80 },
    tags: [{ type: String, trim: true, maxlength: 60 }],
    status: {
      type: String,
      enum: ["draft", "pending_review", "published", "rejected", "reserved", "sold", "archived"],
      default: "draft",
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: ["not_submitted", "pending", "approved", "rejected"],
      default: "not_submitted",
      index: true,
    },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    isSponsored: { type: Boolean, default: false, index: true },
    promotionId: { type: objectId, ref: "Promotion" },
    views: { type: Number, default: 0, min: 0 },
    wishlistCount: { type: Number, default: 0, min: 0 },
    messageCount: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },
    customOrders: { type: Boolean, default: false },
    reservedUntil: Date,
    reservedBy: { type: objectId, ref: "User" },
  },
  timestamps,
);
artworkSchema.index({
  title: "text",
  description: "text",
  tags: "text",
  category: "text",
  medium: "text",
});
artworkSchema.index({ status: 1, isSponsored: 1, createdAt: -1 });
artworkSchema.index({ storeId: 1, status: 1, createdAt: -1 });
// Compound indexes for common discover-page filter combinations
// Covers: category filter + status/moderation guard + sort by date
artworkSchema.index({ status: 1, moderationStatus: 1, category: 1, createdAt: -1 });
// Covers: price range filter + status/moderation guard
artworkSchema.index({ status: 1, moderationStatus: 1, price: 1, createdAt: -1 });
// Covers: framing filter
artworkSchema.index({ status: 1, moderationStatus: 1, isFramed: 1, createdAt: -1 });
// Covers: sponsored artworks lookup (used in artworks route)
artworkSchema.index({ status: 1, moderationStatus: 1, isSponsored: 1, createdAt: -1 });
export type ArtworkDocument = InferSchemaType<typeof artworkSchema>;
export const ArtworkModel = modelFor("Artwork", artworkSchema);

export const subscriptionPlanSchema = new Schema(
  {
    planId: {
      type: String,
      enum: ["free", "professional", "pro-plus", "gallery"],
      required: true,
      unique: true,
    },
    name: requiredString,
    monthlyPrice: money,
    annualPrice: { type: Number, min: 0 },
    allowedBillingCycles: [{ type: String, enum: ["free", "monthly", "annual"] }],
    listingLimit: { type: Number, min: 0, default: null },
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    payoutMinimumDays: { type: Number, required: true, min: 0 },
    payoutMaximumDays: { type: Number, required: true, min: 0 },
    analyticsLevel: { type: String, enum: ["basic", "detailed", "advanced"], required: true },
    staffAccountMinimum: { type: Number, min: 0, default: 0 },
    staffAccountMaximum: { type: Number, min: 0, default: 0 },
    features: [{ type: String, trim: true }],
    permissions: [{ type: String, trim: true }],
    recommended: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, required: true },
  },
  timestamps,
);
export type SubscriptionPlanDocument = InferSchemaType<typeof subscriptionPlanSchema>;
export const SubscriptionPlanModel = modelFor("SubscriptionPlan", subscriptionPlanSchema);

export const subscriptionSchema = new Schema(
  {
    userId: { type: objectId, ref: "User", required: true, index: true },
    storeId: { type: objectId, ref: "Store", index: true },
    planId: {
      type: String,
      enum: ["free", "professional", "pro-plus", "gallery"],
      required: true,
      index: true,
    },
    billingCycle: { type: String, enum: ["free", "monthly", "annual"], required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "payment_review",
        "payment_failed",
        "past_due",
        "cancelled",
        "expired",
        "suspended",
      ],
      required: true,
      index: true,
    },
    price: money,
    currency: { type: String, enum: ["PKR"], default: "PKR" },
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    listingLimit: { type: Number, min: 0, default: null },
    startedAt: Date,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    nextBillingAt: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: Date,
    trialEndsAt: Date,
    paymentProvider: String,
    externalSubscriptionId: String,
    featuresSnapshot: [{ type: String, trim: true }],
    pendingPlanId: { type: String, enum: ["free", "professional", "pro-plus", "gallery"] },
    pendingChangeAt: Date,
  },
  timestamps,
);
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ planId: 1, status: 1, currentPeriodEnd: 1, userId: 1 });
export type SubscriptionDocument = InferSchemaType<typeof subscriptionSchema>;
export const SubscriptionModel = modelFor("Subscription", subscriptionSchema);

export const paymentSchema = new Schema(
  {
    userId: { type: objectId, ref: "User", required: true, index: true },
    subscriptionId: { type: objectId, ref: "Subscription", index: true },
    orderId: { type: objectId, ref: "Order", index: true },
    promotionId: { type: objectId, ref: "Promotion" },
    paymentType: {
      type: String,
      enum: ["subscription", "order", "promotion", "refund"],
      required: true,
    },
    provider: { type: String, required: true },
    providerReference: { type: String, required: true, unique: true },
    amount: money,
    currency: { type: String, enum: ["PKR"], default: "PKR" },
    status: {
      type: String,
      enum: [
        "initiated",
        "pending",
        "pending_verification",
        "information_requested",
        "processing",
        "successful",
        "rejected",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      default: "initiated",
      index: true,
    },
    failureReason: { type: String, trim: true, maxlength: 500 },
    paidAt: Date,
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  timestamps,
);
export type PaymentDocument = InferSchemaType<typeof paymentSchema>;
export const PaymentModel = modelFor("Payment", paymentSchema);

export const paymentProofSchema = new Schema(
  {
    paymentId: { type: objectId, ref: "Payment", required: true, index: true },
    orderId: { type: objectId, ref: "Order", index: true },
    subscriptionId: { type: objectId, ref: "Subscription", index: true },
    promotionId: { type: objectId, ref: "Promotion", index: true },
    paymentType: {
      type: String,
      enum: ["order", "subscription", "promotion"],
      required: true,
      index: true,
    },
    buyerId: { type: objectId, ref: "User", required: true, index: true },
    method: { type: String, enum: ["jazzcash", "easypaisa", "hbl"], required: true, index: true },
    amount: money,
    customerName: { ...requiredString, maxlength: 120 },
    mobileNumber: { ...requiredString, maxlength: 30 },
    transactionId: { ...requiredString, maxlength: 120 },
    screenshotId: { type: objectId, ref: "Upload", required: true },
    note: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending_verification", "approved", "rejected", "information_requested"],
      default: "pending_verification",
      index: true,
    },
    isActive: { type: Boolean, default: true },
    attempt: { type: Number, required: true, min: 1 },
    submittedAt: { type: Date, default: Date.now, index: true },
    reviewedBy: { type: objectId, ref: "User" },
    reviewedAt: Date,
    reviewReason: { type: String, trim: true, maxlength: 1000 },
  },
  timestamps,
);
paymentProofSchema.index({ paymentId: 1, attempt: 1 }, { unique: true });
paymentProofSchema.index({ method: 1, transactionId: 1 });
paymentProofSchema.index(
  { paymentId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);
export type PaymentProofDocument = InferSchemaType<typeof paymentProofSchema>;
export const PaymentProofModel = modelFor("PaymentProof", paymentProofSchema);

export const invoiceSchema = new Schema(
  {
    invoiceNumber: { ...requiredString, unique: true, index: true },
    userId: { type: objectId, ref: "User", required: true, index: true },
    subscriptionId: { type: objectId, ref: "Subscription" },
    orderId: { type: objectId, ref: "Order" },
    paymentId: { type: objectId, ref: "Payment" },
    items: [
      {
        description: requiredString,
        quantity: { type: Number, min: 1 },
        unitPrice: { type: Number, min: 0 },
        total: { type: Number, min: 0 },
      },
    ],
    subtotal: money,
    discount: { type: Number, min: 0, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    total: money,
    currency: { type: String, enum: ["PKR"], default: "PKR" },
    status: { type: String, enum: ["draft", "issued", "paid", "void"], default: "issued" },
    issuedAt: { type: Date, default: Date.now },
    dueAt: Date,
    paidAt: Date,
  },
  timestamps,
);
export const InvoiceModel = modelFor("Invoice", invoiceSchema);

const orderItemSchema = new Schema(
  {
    artworkId: { type: objectId, ref: "Artwork", required: true },
    title: requiredString,
    image: String,
    price: money,
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: true, versionKey: false },
);
export const orderSchema = new Schema(
  {
    orderNumber: { ...requiredString, unique: true, index: true },
    checkoutKey: { type: String, trim: true, maxlength: 100 },
    buyerId: { type: objectId, ref: "User", required: true, index: true },
    sellerId: { type: objectId, ref: "User", required: true, index: true },
    storeId: { type: objectId, ref: "Store", required: true, index: true },
    items: {
      type: [orderItemSchema],
      validate: [(value: unknown[]) => value.length > 0, "Order needs an item"],
    },
    artworkSubtotal: money,
    discount: { type: Number, min: 0, default: 0 },
    eligibleArtworkAmount: { type: Number, min: 0 },
    affiliateId: { type: objectId, ref: "Affiliate", index: true },
    affiliateReferralId: { type: objectId, ref: "AffiliateReferral" },
    affiliateCode: { type: String, trim: true, uppercase: true, maxlength: 20 },
    affiliateCommissionRate: { type: Number, min: 0, max: 20 },
    affiliateDiscountRate: { type: Number, min: 0, max: 20 },
    shippingCost: { type: Number, min: 0, default: 0 },
    packagingCost: { type: Number, min: 0, default: 0 },
    handlingCost: { type: Number, min: 0, default: 0 },
    paymentProcessingFee: { type: Number, min: 0, default: 0 },
    platformCommission: { type: Number, min: 0, default: 0 },
    estimatedTax: { type: Number, min: 0, default: 0 },
    buyerTotal: money,
    sellerNetAmount: money,
    currency: { type: String, enum: ["PKR"], default: "PKR" },
    displayCurrency: { type: String, trim: true, maxlength: 3 },
    exchangeRate: { type: Number, min: 0 },
    isInternational: { type: Boolean, default: false, index: true },
    shippingQuoteId: { type: objectId, ref: "ShippingQuote" },
    customsResponsibility: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "Buyer is responsible for all customs duties and import taxes.",
    },
    trackingUrl: { type: String, trim: true, maxlength: 500 },
    dispatchDate: Date,
    deliveryEstimate: { type: String, trim: true, maxlength: 100 },
    status: {
      type: String,
      enum: [
        "awaiting_payment",
        "awaiting_payment_approval",
        "paid",
        "payment_confirmed",
        "seller_confirmed",
        "preparing",
        "ready_for_pickup",
        "shipped",
        "out_for_delivery",
        "delivered",
        "inspection_period",
        "completed",
        "return_requested",
        "returned",
        "refunded",
        "cancelled",
        "disputed",
      ],
      default: "awaiting_payment",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: [
        "unpaid",
        "pending",
        "pending_verification",
        "information_requested",
        "paid",
        "rejected",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "unpaid",
      index: true,
    },
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    buyerContactSnapshot: { type: Schema.Types.Mixed, select: false },
    sellerContactSnapshot: { type: Schema.Types.Mixed, select: false },
    inspectionEndsAt: Date,
    completedAt: Date,
    cancelledAt: Date,
  },
  timestamps,
);
orderSchema.index(
  { buyerId: 1, checkoutKey: 1, storeId: 1 },
  { unique: true, partialFilterExpression: { checkoutKey: { $type: "string" } } },
);
export type OrderDocument = InferSchemaType<typeof orderSchema>;
export const OrderModel = modelFor("Order", orderSchema);

export const AffiliateModel = modelFor(
  "Affiliate",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, unique: true, index: true },
      code: { ...requiredString, uppercase: true, maxlength: 20 },
      codeNormalized: {
        ...requiredString,
        uppercase: true,
        maxlength: 20,
        unique: true,
        index: true,
      },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "disabled"],
        default: "pending",
        index: true,
      },
      commissionRate: { type: Number, required: true, min: 0, max: 20, default: 5 },
      buyerDiscountRate: { type: Number, required: true, min: 0, max: 20, default: 10 },
      totalClicks: { type: Number, min: 0, default: 0 },
      uniqueClicks: { type: Number, min: 0, default: 0 },
      suspiciousActivityCount: { type: Number, min: 0, default: 0 },
      approvedAt: Date,
      rejectedAt: Date,
      disabledAt: Date,
      rejectionReason: { type: String, trim: true, maxlength: 1000 },
    },
    timestamps,
  ),
);
AffiliateModel.schema.index({ status: 1, createdAt: -1 });

export const AffiliateReferralModel = modelFor(
  "AffiliateReferral",
  new Schema(
    {
      affiliateId: { type: objectId, ref: "Affiliate", required: true, index: true },
      visitorHash: { ...requiredString, maxlength: 128, index: true },
      userId: { type: objectId, ref: "User", index: true },
      landingPage: { type: String, trim: true, maxlength: 500, default: "/" },
      source: { type: String, enum: ["url", "code"], required: true },
      ipHash: { type: String, trim: true, maxlength: 128, index: true },
      userAgentHash: { type: String, trim: true, maxlength: 128 },
      isUnique: { type: Boolean, default: true },
      referredAt: { type: Date, default: Date.now, index: true },
      lastSeenAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true, index: true },
    },
    timestamps,
  ),
);
AffiliateReferralModel.schema.index({ visitorHash: 1, expiresAt: -1 });
AffiliateReferralModel.schema.index({ affiliateId: 1, referredAt: -1 });

export const AffiliateCommissionModel = modelFor(
  "AffiliateCommission",
  new Schema(
    {
      affiliateId: { type: objectId, ref: "Affiliate", required: true, index: true },
      orderId: { type: objectId, ref: "Order", required: true, unique: true, index: true },
      artworkIds: [{ type: objectId, ref: "Artwork", required: true }],
      eligibleSaleAmount: money,
      commissionRate: { type: Number, required: true, min: 0, max: 20 },
      commissionAmount: money,
      buyerDiscountAmount: { type: Number, min: 0, default: 0 },
      currency: { type: String, enum: ["PKR"], default: "PKR" },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "paid"],
        default: "pending",
        index: true,
      },
      payoutId: { type: objectId, ref: "AffiliatePayout", index: true },
      rejectionReason: { type: String, trim: true, maxlength: 1000 },
      approvedAt: Date,
      rejectedAt: Date,
      paidAt: Date,
    },
    timestamps,
  ),
);
AffiliateCommissionModel.schema.index({ affiliateId: 1, status: 1, createdAt: -1 });

export const AffiliatePayoutModel = modelFor(
  "AffiliatePayout",
  new Schema(
    {
      affiliateId: { type: objectId, ref: "Affiliate", required: true, index: true },
      commissionIds: [{ type: objectId, ref: "AffiliateCommission", required: true }],
      amount: money,
      currency: { type: String, enum: ["PKR"], default: "PKR" },
      status: {
        type: String,
        enum: ["requested", "approved", "processing", "paid", "rejected", "cancelled"],
        default: "requested",
        index: true,
      },
      payoutMethod: {
        type: { type: String, enum: ["manual"], default: "manual" },
        label: { type: String, trim: true, maxlength: 100, default: "Manual transfer" },
      },
      requestedAt: { type: Date, default: Date.now, index: true },
      processedAt: Date,
      processedBy: { type: objectId, ref: "User" },
      transactionReference: { type: String, trim: true, maxlength: 200 },
      rejectionReason: { type: String, trim: true, maxlength: 1000 },
    },
    timestamps,
  ),
);
AffiliatePayoutModel.schema.index({ affiliateId: 1, status: 1, requestedAt: -1 });

export const AffiliateActivityModel = modelFor(
  "AffiliateActivity",
  new Schema(
    {
      affiliateId: { type: objectId, ref: "Affiliate", required: true, index: true },
      userId: { type: objectId, ref: "User", index: true },
      type: {
        type: String,
        enum: [
          "self_referral",
          "referral_override_attempt",
          "repeated_clicks",
          "duplicate_commission_attempt",
        ],
        required: true,
        index: true,
      },
      severity: { type: String, enum: ["low", "medium", "high"], default: "low", index: true },
      ipHash: { type: String, trim: true, maxlength: 128 },
      metadata: { type: Schema.Types.Mixed, default: {} },
      resolvedAt: Date,
      resolvedBy: { type: objectId, ref: "User" },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
  ),
);
AffiliateActivityModel.schema.index({ affiliateId: 1, createdAt: -1 });

export const ShipmentModel = modelFor(
  "Shipment",
  new Schema(
    {
      orderId: { type: objectId, ref: "Order", required: true, unique: true, index: true },
      courier: { type: String, trim: true, maxlength: 100, default: "Estimate only" },
      trackingNumber: { type: String, trim: true, maxlength: 100 },
      pickupCity: requiredString,
      deliveryCity: requiredString,
      weight: { type: Number, min: 0 },
      dimensions: {
        width: Number,
        height: Number,
        depth: Number,
        unit: { type: String, enum: ["cm", "in"], default: "cm" },
      },
      fragile: { type: Boolean, default: false },
      packagingType: { type: String, trim: true, maxlength: 100 },
      estimatedCost: { type: Number, min: 0, required: true },
      actualCost: { type: Number, min: 0 },
      status: {
        type: String,
        enum: [
          "estimate",
          "awaiting_pickup",
          "picked_up",
          "in_transit",
          "out_for_delivery",
          "delivered",
          "delayed",
          "damaged",
          "returned",
        ],
        default: "estimate",
        index: true,
      },
      pickedUpAt: Date,
      shippedAt: Date,
      deliveredAt: Date,
      trackingEvents: [{ status: String, description: String, occurredAt: Date }],
    },
    timestamps,
  ),
);

export const PayoutModel = modelFor(
  "Payout",
  new Schema(
    {
      sellerId: { type: objectId, ref: "User", required: true, index: true },
      orderId: { type: objectId, ref: "Order", required: true, unique: true, index: true },
      grossAmount: money,
      commissionDeduction: { type: Number, min: 0, default: 0 },
      paymentFeeDeduction: { type: Number, min: 0, default: 0 },
      shippingDeduction: { type: Number, min: 0, default: 0 },
      taxDeduction: { type: Number, min: 0, default: 0 },
      refundAdjustment: { type: Number, default: 0 },
      netAmount: money,
      status: {
        type: String,
        enum: ["pending", "on_hold", "available", "processing", "completed", "failed", "reversed"],
        default: "pending",
        index: true,
      },
      availableAt: Date,
      processedAt: Date,
      providerReference: String,
    },
    timestamps,
  ),
);

export const conversationSchema = new Schema(
  {
    participants: [{ type: objectId, ref: "User", required: true }],
    buyerId: { type: objectId, ref: "User", required: true, index: true },
    sellerId: { type: objectId, ref: "User", required: true, index: true },
    storeId: { type: objectId, ref: "Store", required: true },
    artworkId: { type: objectId, ref: "Artwork" },
    lastMessageAt: Date,
    lastMessagePreview: { type: String, trim: true, maxlength: 180 },
    status: {
      type: String,
      enum: ["active", "archived", "blocked", "reported"],
      default: "active",
      index: true,
    },
    blockedBy: [{ type: objectId, ref: "User" }],
    reportedBy: [{ type: objectId, ref: "User" }],
  },
  timestamps,
);
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ buyerId: 1, sellerId: 1, artworkId: 1 }, { unique: true, sparse: true });
export const ConversationModel = modelFor("Conversation", conversationSchema);

export const MessageModel = modelFor(
  "Message",
  new Schema(
    {
      conversationId: { type: objectId, ref: "Conversation", required: true, index: true },
      senderId: { type: objectId, ref: "User", required: true },
      recipientId: { type: objectId, ref: "User", required: true },
      type: {
        type: String,
        enum: ["text", "image", "document", "system", "offer", "video_request"],
        default: "text",
      },
      text: { type: String, trim: true, maxlength: 4000, default: "" },
      attachments: [{ url: String, name: String, mimeType: String, size: Number }],
      offerId: { type: objectId, ref: "Offer" },
      isRead: { type: Boolean, default: false, index: true },
      readAt: Date,
      moderationFlags: [
        { type: String, enum: ["phone", "email", "whatsapp", "external_payment", "spam"] },
      ],
    },
    timestamps,
  ),
);

export const OfferModel = modelFor(
  "Offer",
  new Schema(
    {
      conversationId: { type: objectId, ref: "Conversation", required: true, index: true },
      artworkId: { type: objectId, ref: "Artwork", required: true },
      buyerId: { type: objectId, ref: "User", required: true, index: true },
      sellerId: { type: objectId, ref: "User", required: true, index: true },
      originalPrice: money,
      offeredPrice: money,
      counterPrice: { type: Number, min: 0 },
      currency: { type: String, enum: ["PKR"], default: "PKR" },
      message: { type: String, trim: true, maxlength: 1000 },
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "countered", "withdrawn", "expired"],
        default: "pending",
        index: true,
      },
      expiresAt: { type: Date, required: true, index: true },
    },
    timestamps,
  ),
);

export const VideoConsultationModel = modelFor(
  "VideoConsultation",
  new Schema(
    {
      buyerId: { type: objectId, ref: "User", required: true },
      sellerId: { type: objectId, ref: "User", required: true },
      artworkId: { type: objectId, ref: "Artwork", required: true },
      conversationId: { type: objectId, ref: "Conversation", required: true, index: true },
      requestedDate: { type: Date, required: true },
      requestedTime: requiredString,
      timezone: requiredString,
      message: { type: String, trim: true, maxlength: 1000 },
      status: {
        type: String,
        enum: [
          "requested",
          "accepted",
          "rejected",
          "alternate_suggested",
          "cancelled",
          "completed",
        ],
        default: "requested",
      },
      meetingUrl: { type: String, trim: true, maxlength: 500, select: false },
      alternativeTimes: [{ requestedDate: Date, requestedTime: String, timezone: String }],
    },
    timestamps,
  ),
);

export const PromotionModel = modelFor(
  "Promotion",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, index: true },
      storeId: { type: objectId, ref: "Store", required: true },
      artworkId: { type: objectId, ref: "Artwork" },
      promotionType: {
        type: String,
        enum: [
          "boost_3",
          "boost_7",
          "category_top",
          "featured_artist",
          "homepage",
          "social",
          "newsletter",
        ],
        required: true,
      },
      placement: requiredString,
      price: money,
      currency: { type: String, enum: ["PKR"], default: "PKR" },
      startAt: Date,
      endAt: Date,
      status: {
        type: String,
        enum: [
          "draft",
          "pending_payment",
          "pending_approval",
          "scheduled",
          "active",
          "completed",
          "rejected",
          "cancelled",
        ],
        default: "draft",
        index: true,
      },
      paymentId: { type: objectId, ref: "Payment" },
      approvedBy: { type: objectId, ref: "User" },
      approvedAt: Date,
      rejectionReason: { type: String, trim: true, maxlength: 1000 },
      impressions: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      saves: { type: Number, min: 0, default: 0 },
      messages: { type: Number, min: 0, default: 0 },
    },
    timestamps,
  ),
);

export const ReviewModel = modelFor(
  "Review",
  new Schema(
    {
      orderId: { type: objectId, ref: "Order", required: true, index: true },
      buyerId: { type: objectId, ref: "User", required: true },
      sellerId: { type: objectId, ref: "User", required: true },
      storeId: { type: objectId, ref: "Store", required: true, index: true },
      artworkId: { type: objectId, ref: "Artwork", required: true },
      rating: { type: Number, required: true, min: 1, max: 5 },
      title: { type: String, trim: true, maxlength: 150 },
      comment: { type: String, trim: true, maxlength: 3000 },
      sellerResponse: { type: String, trim: true, maxlength: 2000 },
      status: {
        type: String,
        enum: ["pending", "approved", "suspended", "rejected"],
        default: "approved",
        index: true,
      },
    },
    timestamps,
  ),
);
ReviewModel.schema.index({ orderId: 1, artworkId: 1 }, { unique: true });

export const WishlistItemModel = modelFor(
  "WishlistItem",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, index: true },
      artworkId: { type: objectId, ref: "Artwork", required: true, index: true },
    },
    timestamps,
  ),
);
WishlistItemModel.schema.index({ userId: 1, artworkId: 1 }, { unique: true });

export const FollowModel = modelFor(
  "Follow",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, index: true },
      storeId: { type: objectId, ref: "Store", required: true, index: true },
    },
    timestamps,
  ),
);
FollowModel.schema.index({ userId: 1, storeId: 1 }, { unique: true });

export const VerificationRequestModel = modelFor(
  "VerificationRequest",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, index: true },
      storeId: { type: objectId, ref: "Store" },
      type: { type: String, enum: ["artist", "gallery", "identity", "phone"], required: true },
      submittedData: { type: Schema.Types.Mixed, default: {} },
      documentReferences: [{ type: objectId, ref: "Upload" }],
      status: verification,
      reviewedBy: { type: objectId, ref: "User" },
      reviewedAt: Date,
      rejectionReason: { type: String, trim: true, maxlength: 1200 },
      adminNotes: { type: String, trim: true, maxlength: 3000 },
    },
    timestamps,
  ),
);

export const NotificationModel = modelFor(
  "Notification",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, index: true },
      type: { ...requiredString, maxlength: 80 },
      title: { ...requiredString, maxlength: 180 },
      message: { ...requiredString, maxlength: 1000 },
      link: { type: String, trim: true, maxlength: 500 },
      isRead: { type: Boolean, default: false, index: true },
      readAt: Date,
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
  ),
);

export const SupportTicketModel = modelFor(
  "SupportTicket",
  new Schema(
    {
      ticketNumber: { ...requiredString, unique: true },
      userId: { type: objectId, ref: "User", required: true, index: true },
      category: requiredString,
      subject: { ...requiredString, maxlength: 180 },
      description: { ...requiredString, maxlength: 5000 },
      attachments: [{ url: String, name: String, mimeType: String, size: Number }],
      priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
      status: {
        type: String,
        enum: ["open", "waiting", "resolved", "closed"],
        default: "open",
        index: true,
      },
      assignedTo: { type: objectId, ref: "User" },
      messages: [{ senderId: { type: objectId, ref: "User" }, message: String, createdAt: Date }],
    },
    timestamps,
  ),
);

export const ExhibitionModel = modelFor(
  "Exhibition",
  new Schema(
    {
      galleryId: { type: objectId, ref: "GalleryProfile", required: true, index: true },
      name: { ...requiredString, maxlength: 180 },
      slug: { ...requiredString, unique: true, lowercase: true },
      coverImageUrl: String,
      description: { type: String, trim: true, maxlength: 5000 },
      venue: { type: String, trim: true, maxlength: 300 },
      startAt: Date,
      endAt: Date,
      artistIds: [{ type: objectId, ref: "User" }],
      artworkIds: [{ type: objectId, ref: "Artwork" }],
      type: { type: String, enum: ["online", "physical", "hybrid"], required: true },
      status: {
        type: String,
        enum: ["draft", "scheduled", "active", "completed", "cancelled"],
        default: "draft",
      },
      isPublished: { type: Boolean, default: false, index: true },
    },
    timestamps,
  ),
);

export const GalleryStaffModel = modelFor(
  "GalleryStaff",
  new Schema(
    {
      galleryId: { type: objectId, ref: "GalleryProfile", required: true, index: true },
      userId: { type: objectId, ref: "User", required: true, index: true },
      role: { ...requiredString, maxlength: 80 },
      permissions: [{ type: String, trim: true, maxlength: 80 }],
      status: {
        type: String,
        enum: ["invited", "active", "suspended", "revoked"],
        default: "invited",
      },
      invitedAt: Date,
      acceptedAt: Date,
    },
    timestamps,
  ),
);
GalleryStaffModel.schema.index({ galleryId: 1, userId: 1 }, { unique: true });

export const AuditLogModel = modelFor(
  "AuditLog",
  new Schema(
    {
      actorId: { type: objectId, ref: "User", index: true },
      actorRole: { type: String, trim: true, maxlength: 50 },
      action: { ...requiredString, maxlength: 120, index: true },
      entityType: { ...requiredString, maxlength: 80, index: true },
      entityId: { type: objectId, index: true },
      before: { type: Schema.Types.Mixed, select: false },
      after: { type: Schema.Types.Mixed, select: false },
      ipAddress: { type: String, trim: true, maxlength: 100 },
      userAgent: { type: String, trim: true, maxlength: 500 },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
  ),
);

export const AuthSessionModel = modelFor(
  "AuthSession",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, index: true },
      tokenHash: { type: String, required: true, unique: true, select: false },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
      lastSeenAt: { type: Date, default: Date.now },
      ipAddress: String,
      userAgent: String,
      revokedAt: Date,
    },
    timestamps,
  ),
);

export const OnboardingDraftModel = modelFor(
  "OnboardingDraft",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, unique: true, index: true },
      step: { type: Number, min: 0, max: 7, default: 0 },
      data: { type: Schema.Types.Mixed, default: {} },
      completedAt: Date,
    },
    timestamps,
  ),
);

export const CartModel = modelFor(
  "Cart",
  new Schema(
    {
      buyerId: { type: objectId, ref: "User", required: true, unique: true, index: true },
      items: [
        {
          artworkId: { type: objectId, ref: "Artwork", required: true },
          quantity: { type: Number, min: 1, max: 10, default: 1 },
          priceSnapshot: { type: Number, min: 0 },
        },
      ],
      expiresAt: Date,
    },
    timestamps,
  ),
);

export const UploadModel = modelFor(
  "Upload",
  new Schema(
    {
      ownerId: { type: objectId, ref: "User", required: true, index: true },
      publicId: { ...requiredString, unique: true },
      url: requiredString,
      storageKey: { ...requiredString, select: false },
      provider: {
        type: String,
        enum: ["local", "mongodb", "cloudinary", "s3"],
        default: "local",
      },
      originalName: { type: String, trim: true, maxlength: 255 },
      mimeType: requiredString,
      size: { type: Number, required: true, min: 1 },
      access: { type: String, enum: ["public", "private"], required: true, index: true },
      purpose: {
        type: String,
        enum: ["artwork", "profile", "cover", "message", "verification", "payment_proof"],
        required: true,
      },
      attachedTo: { type: objectId },
    },
    timestamps,
  ),
);

export const TaxonomyModel = modelFor(
  "Taxonomy",
  new Schema(
    {
      type: {
        type: String,
        enum: ["category", "medium", "style", "city", "province"],
        required: true,
        index: true,
      },
      name: { ...requiredString, maxlength: 100 },
      slug: { ...requiredString, lowercase: true, maxlength: 100 },
      province: { type: String, trim: true, maxlength: 100 },
      isActive: { type: Boolean, default: true },
      sortOrder: { type: Number, default: 0 },
    },
    timestamps,
  ),
);
TaxonomyModel.schema.index({ type: 1, slug: 1 }, { unique: true });

export const CollectionModel = modelFor(
  "Collection",
  new Schema(
    {
      name: { ...requiredString, maxlength: 160 },
      slug: { ...requiredString, unique: true, lowercase: true },
      description: { type: String, trim: true, maxlength: 2000 },
      artworkIds: [{ type: objectId, ref: "Artwork" }],
      coverImageUrl: String,
      isPublished: { type: Boolean, default: false, index: true },
      sortOrder: { type: Number, default: 0 },
    },
    timestamps,
  ),
);

export const AnalyticsEventModel = modelFor(
  "AnalyticsEvent",
  new Schema(
    {
      userId: { type: objectId, ref: "User", index: true },
      storeId: { type: objectId, ref: "Store", index: true },
      artworkId: { type: objectId, ref: "Artwork", index: true },
      type: {
        type: String,
        enum: [
          "store_view",
          "artwork_view",
          "save",
          "message",
          "offer",
          "video_request",
          "order",
          "promotion_click",
        ],
        required: true,
        index: true,
      },
      sessionHash: { type: String, index: true },
      source: { type: String, trim: true, maxlength: 100 },
      city: { type: String, trim: true, maxlength: 100 },
      country: { type: String, trim: true, maxlength: 80 },
      value: { type: Number, min: 0, default: 0 },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
  ),
);
AnalyticsEventModel.schema.index({ storeId: 1, createdAt: -1, type: 1 });

export const ShippingRuleModel = modelFor(
  "ShippingRule",
  new Schema(
    {
      name: requiredString,
      baseCost: money,
      perKgCost: { type: Number, min: 0, default: 0 },
      fragileSurcharge: { type: Number, min: 0, default: 0 },
      framingSurcharge: { type: Number, min: 0, default: 0 },
      city: { type: String, trim: true },
      province: { type: String, trim: true },
      isActive: { type: Boolean, default: true, index: true },
    },
    timestamps,
  ),
);

export const SystemSettingModel = modelFor(
  "SystemSetting",
  new Schema(
    {
      key: { ...requiredString, unique: true },
      value: Schema.Types.Mixed,
      isPublic: { type: Boolean, default: false },
      updatedBy: { type: objectId, ref: "User" },
    },
    timestamps,
  ),
);

export const NotificationPreferenceModel = modelFor(
  "NotificationPreference",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, unique: true },
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      orderUpdates: { type: Boolean, default: true },
      messageUpdates: { type: Boolean, default: true },
    },
    timestamps,
  ),
);

export const PendingPlanSelectionModel = modelFor(
  "PendingPlanSelection",
  new Schema(
    {
      tokenHash: { type: String, required: true, unique: true, select: false },
      planId: {
        type: String,
        enum: ["free", "professional", "gallery"],
        required: true,
      },
      billingCycle: { type: String, enum: ["free", "monthly", "annual"], required: true },
      userId: { type: objectId, ref: "User" },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    timestamps,
  ),
);

export const ListingQuotaModel = modelFor(
  "ListingQuota",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, unique: true },
      activeListings: { type: Number, min: 0, default: 0 },
    },
    timestamps,
  ),
);

export const GalleryArtistModel = modelFor(
  "GalleryArtist",
  new Schema(
    {
      galleryId: { type: objectId, ref: "GalleryProfile", required: true, index: true },
      artistId: { type: objectId, ref: "User", required: true, index: true },
      status: { type: String, enum: ["invited", "active", "removed"], default: "invited" },
      invitedAt: { type: Date, default: Date.now },
      acceptedAt: Date,
    },
    timestamps,
  ),
);
GalleryArtistModel.schema.index({ galleryId: 1, artistId: 1 }, { unique: true });

export const CustomerRecordModel = modelFor(
  "CustomerRecord",
  new Schema(
    {
      sellerId: { type: objectId, ref: "User", required: true, index: true },
      buyerId: { type: objectId, ref: "User", required: true, index: true },
      notes: { type: String, trim: true, maxlength: 3000 },
      tags: [{ type: String, trim: true, maxlength: 60 }],
      followUpAt: Date,
      marketingConsent: { type: Boolean, default: false },
    },
    timestamps,
  ),
);
CustomerRecordModel.schema.index({ sellerId: 1, buyerId: 1 }, { unique: true });

export const DisputeModel = modelFor(
  "Dispute",
  new Schema(
    {
      orderId: { type: objectId, ref: "Order", required: true, index: true },
      openedBy: { type: objectId, ref: "User", required: true },
      reason: { type: String, trim: true, maxlength: 3000, required: true },
      status: {
        type: String,
        enum: ["open", "under_review", "resolved", "closed"],
        default: "open",
        index: true,
      },
      resolution: { type: String, trim: true, maxlength: 3000 },
      assignedTo: { type: objectId, ref: "User" },
    },
    timestamps,
  ),
);

export const CorporateLeadModel = modelFor(
  "CorporateLead",
  new Schema(
    {
      name: { ...requiredString, maxlength: 160 },
      company: { type: String, trim: true, maxlength: 180 },
      email: { ...requiredString, maxlength: 254 },
      phone: { type: String, trim: true, maxlength: 30 },
      message: { type: String, trim: true, maxlength: 5000 },
      status: {
        type: String,
        enum: ["new", "contacted", "qualified", "closed"],
        default: "new",
        index: true,
      },
      assignedTo: { type: objectId, ref: "User" },
    },
    timestamps,
  ),
);

export const NewsletterSubscriptionModel = modelFor(
  "NewsletterSubscription",
  new Schema(
    {
      email: { ...requiredString, maxlength: 254 },
      emailNormalized: { ...requiredString, maxlength: 254, unique: true, index: true },
      userId: { type: objectId, ref: "User", index: true },
      source: { type: String, trim: true, maxlength: 80, default: "website" },
      status: {
        type: String,
        enum: ["subscribed", "unsubscribed"],
        default: "subscribed",
        index: true,
      },
      subscribedAt: { type: Date, default: Date.now },
      unsubscribedAt: Date,
    },
    timestamps,
  ),
);

export const ContentPageModel = modelFor(
  "ContentPage",
  new Schema(
    {
      slug: { ...requiredString, unique: true },
      title: { ...requiredString, maxlength: 180 },
      body: { type: String, trim: true, maxlength: 50_000, default: "" },
      status: {
        type: String,
        enum: ["draft", "published", "archived"],
        default: "draft",
        index: true,
      },
      updatedBy: { type: objectId, ref: "User" },
    },
    timestamps,
  ),
);

export const UserDraftModel = modelFor(
  "UserDraft",
  new Schema(
    {
      userId: { type: objectId, ref: "User", required: true, index: true },
      key: { ...requiredString, maxlength: 80 },
      data: { type: Schema.Types.Mixed, default: {} },
      expiresAt: { type: Date, index: { expires: 0 } },
    },
    timestamps,
  ),
);
UserDraftModel.schema.index({ userId: 1, key: 1 }, { unique: true });

export const GalleryStaffInviteModel = modelFor(
  "GalleryStaffInvite",
  new Schema(
    {
      galleryId: { type: objectId, ref: "GalleryProfile", required: true, index: true },
      emailNormalized: { ...requiredString, lowercase: true },
      role: { ...requiredString, maxlength: 80 },
      permissions: [{ type: String, trim: true, maxlength: 80 }],
      tokenHash: { type: String, required: true, select: false },
      status: {
        type: String,
        enum: ["pending", "accepted", "expired", "revoked"],
        default: "pending",
      },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    timestamps,
  ),
);
GalleryStaffInviteModel.schema.index({ galleryId: 1, emailNormalized: 1, status: 1 });

export const shippingQuoteSchema = new Schema(
  {
    buyerId: { type: objectId, ref: "User", index: true }, // Optional if guest request is allowed, though currently everything seems to require users
    sellerId: { type: objectId, ref: "User", required: true, index: true },
    artworkId: { type: objectId, ref: "Artwork", required: true, index: true },
    storeId: { type: objectId, ref: "Store", required: true, index: true },
    buyerName: { ...requiredString, maxlength: 120 },
    buyerEmail: { ...requiredString, maxlength: 254 },
    buyerPhone: { type: String, trim: true, maxlength: 30 },
    country: { ...requiredString, maxlength: 80 },
    city: { ...requiredString, maxlength: 100 },
    province: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 24 },
    shippingAddress: { type: String, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    quotedShippingCost: { type: Number, min: 0 },
    quotedPackagingCost: { type: Number, min: 0 },
    estimatedDeliveryTime: { type: String, trim: true, maxlength: 100 },
    adminNotes: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: [
        "new_request",
        "calculating_shipping",
        // `quote_sent` is retained for records created by older deployments.
        "quote_sent",
        "quote_provided",
        "rejected",
        "accepted",
        "awaiting_payment",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "new_request",
      index: true,
    },
    expiresAt: Date,
    orderId: { type: objectId, ref: "Order" },
  },
  timestamps,
);
export type ShippingQuoteDocument = InferSchemaType<typeof shippingQuoteSchema>;
export const ShippingQuoteModel = modelFor("ShippingQuote", shippingQuoteSchema);
