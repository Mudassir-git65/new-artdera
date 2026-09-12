import type { HydratedDocument } from "mongoose";
import type { UserDocument } from "../models";

function id(value: unknown) {
  if (value && typeof value === "object" && "toString" in value) return String(value);
  return value ? String(value) : undefined;
}

export function publicAssetUrl(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = value.replace(/^\/src\/assets\/([^?#]+)(.*)$/i, "/images/$1$2");
  return normalized.replace(/creator-1\.jpg/gi, "artist.png");
}

export function serializeUser(user: HydratedDocument<UserDocument> | Record<string, unknown>) {
  const source = "toObject" in user && typeof user.toObject === "function" ? user.toObject() : user;
  return {
    id: id(source._id),
    fullName: source.fullName,
    email: source.email,
    mobile: source.phone,
    city: source.city ?? "",
    province: source.province,
    country: source.country ?? "Pakistan",
    role: source.role,
    sellerType: source.sellerType ?? null,
    avatar: publicAssetUrl(source.avatarUrl),
    status: source.status,
    emailVerified: source.emailVerified,
    phoneVerified: source.phoneVerified,
    createdAt: source.createdAt instanceof Date ? source.createdAt.toISOString() : source.createdAt,
  };
}

export function publicStore(store: Record<string, unknown>) {
  return {
    id: id(store._id),
    ownerId: id(store.ownerId),
    slug: store.slug,
    name: store.name,
    tagline: store.tagline ?? "",
    bio: store.shortDescription ?? "",
    story: store.fullDescription ?? "",
    location: [store.city, store.country].filter(Boolean).join(", "),
    city: store.city,
    province: store.province,
    country: store.country,
    categories: store.categories ?? [],
    mediums: store.mediums ?? [],
    coverImage: publicAssetUrl(store.coverImageUrl) ?? "",
    profileImage: publicAssetUrl(store.logoUrl) ?? "",
    featuredArtworkId: id(store.featuredArtworkId),
    verified: store.verificationStatus === "approved",
    status:
      store.status === "active"
        ? "Published"
        : store.status === "suspended"
          ? "Suspended"
          : "Draft",
    followers: store.totalFollowers ?? 0,
    rating: store.rating ?? 0,
    reviewCount: store.reviewCount ?? 0,
    ownerType: store.ownerType,
    domesticShipping: store.domesticShipping,
    internationalShipping: store.internationalShipping,
  };
}

const artworkStatus: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  published: "Published",
  rejected: "Rejected",
  sold: "Sold",
  reserved: "Reserved",
  archived: "Archived",
};

export function publicArtwork(artwork: Record<string, any>) {
  const images = Array.isArray(artwork.images) ? artwork.images : [];
  return {
    id: id(artwork._id),
    storeId: id(artwork.storeId?._id ?? artwork.storeId),
    artistId: id(artwork.artistId?._id ?? artwork.artistId),
    galleryId: id(artwork.galleryId?._id ?? artwork.galleryId),
    creatorName:
      artwork.artistId?.fullName ??
      artwork.storeId?.name ??
      artwork.creatorName ??
      "ArtDera creator",
    slug: artwork.slug,
    title: artwork.title,
    description: artwork.description ?? "",
    story: artwork.story?.text
      ? {
          text: artwork.story.text,
          updatedAt:
            artwork.story.updatedAt instanceof Date
              ? artwork.story.updatedAt.toISOString()
              : artwork.story.updatedAt,
        }
      : undefined,
    category: artwork.category,
    medium: artwork.medium,
    style: artwork.style ?? "",
    subject: artwork.subject ?? "",
    colours: artwork.colours ?? [],
    year: artwork.yearCreated,
    kind:
      artwork.artworkType === "limited_edition"
        ? "Limited Edition"
        : artwork.artworkType === "print"
          ? "Print"
          : "Original",
    price: artwork.price,
    discountPrice: artwork.discountPrice,
    dimensions:
      artwork.width && artwork.height
        ? `${artwork.width} × ${artwork.height}${artwork.depth ? ` × ${artwork.depth}` : ""} inches`
        : "",
    width: artwork.width,
    height: artwork.height,
    depth: artwork.depth,
    weightKg:
      artwork.weightUnit === "lb" ? Number(artwork.weight ?? 0) * 0.453592 : (artwork.weight ?? 0),
    framed: artwork.isFramed ?? false,
    orientation:
      artwork.orientation === "landscape"
        ? "Landscape"
        : artwork.orientation === "square"
          ? "Square"
          : "Portrait",
    images: images.map((image: Record<string, unknown>) => ({
      id: id(image._id ?? image.publicId) ?? image.url,
      url: publicAssetUrl(image.url),
      alt: image.alt ?? artwork.title,
      isPrimary: Boolean(image.isPrimary),
    })),
    status: artworkStatus[artwork.status] ?? artwork.status,
    moderationStatus: artwork.moderationStatus,
    rejectionReason: artwork.rejectionReason,
    quantity: artwork.quantity ?? 0,
    domesticShipping: artwork.domesticShipping ?? true,
    internationalShipping: artwork.internationalShipping ?? false,
    certificate: artwork.certificateAvailable ?? false,
    tags: artwork.tags ?? [],
    customOrders: artwork.customOrders ?? false,
    views: artwork.views ?? 0,
    saves: artwork.wishlistCount ?? 0,
    messages: artwork.messageCount ?? 0,
    sponsored: artwork.isSponsored ?? false,
    createdAt:
      artwork.createdAt instanceof Date ? artwork.createdAt.toISOString() : artwork.createdAt,
  };
}

const subscriptionStatus: Record<string, string> = {
  pending: "Pending Payment",
  active: "Active",
  payment_review: "Payment Review",
  payment_failed: "Payment Failed",
  past_due: "Past Due",
  cancelled: "Cancelled",
  expired: "Expired",
  suspended: "Suspended",
};

export function serializeSubscription(subscription: Record<string, any>) {
  return {
    id: id(subscription._id),
    userId: id(subscription.userId),
    storeId: id(subscription.storeId),
    planId: subscription.planId,
    billingCycle: subscription.billingCycle,
    status: subscriptionStatus[subscription.status] ?? subscription.status,
    startedAt: subscription.startedAt?.toISOString?.() ?? subscription.startedAt,
    renewsAt: subscription.currentPeriodEnd?.toISOString?.() ?? subscription.currentPeriodEnd,
    price: subscription.price,
    commission: subscription.commissionRate,
    listingLimit: subscription.listingLimit,
    featureIds: subscription.featuresSnapshot ?? [],
    cancelledAt: subscription.cancelledAt?.toISOString?.() ?? subscription.cancelledAt,
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    pendingPlanId: subscription.pendingPlanId,
    pendingChangeAt: subscription.pendingChangeAt?.toISOString?.() ?? subscription.pendingChangeAt,
  };
}
