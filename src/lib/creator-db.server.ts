import type { CreatorMetaResolved } from "./creator-meta";
import { connectDatabase } from "../../server/db";
import { findPublicStore } from "../../server/services/catalog";
import {
  ArtistProfileModel,
  GalleryProfileModel,
  SubscriptionModel,
  UserModel,
} from "../../server/models";
import { isActiveProfessionalSubscription } from "../../server/services/plans";

export async function queryCreatorFromDatabase(
  cleanSlug: string,
): Promise<CreatorMetaResolved | null> {
  await connectDatabase();
  const store = await findPublicStore(cleanSlug.trim().toLowerCase());
  if (!store) return null;
  const [profile, owner, subscription] = await Promise.all([
    store.ownerType === "artist"
      ? ArtistProfileModel.findOne({ userId: store.ownerId }).lean()
      : GalleryProfileModel.findOne({ userId: store.ownerId }).lean(),
    UserModel.findById(store.ownerId).select("avatarUrl").lean(),
    SubscriptionModel.findOne({
      userId: store.ownerId,
      planId: "professional",
      status: "active",
      currentPeriodEnd: { $gt: new Date() },
    }).lean(),
  ]);
  const details = profile as Record<string, any> | null;
  const pro = subscription && isActiveProfessionalSubscription(subscription);
  return {
    name: details?.displayName || details?.galleryName || store.name,
    slug: store.slug,
    bio:
      details?.shortBio ||
      details?.fullBio ||
      details?.description ||
      store.shortDescription ||
      store.fullDescription ||
      store.tagline,
    profileImage:
      details?.profileImageUrl || details?.logoUrl || store.logoUrl || owner?.avatarUrl || "",
    coverImage: details?.coverImageUrl || store.coverImageUrl || "",
    location: [store.city, store.country].filter(Boolean).join(", "),
    discipline:
      details?.professionalTitle ||
      details?.mediums?.[0] ||
      (store.ownerType === "gallery" ? "Art Gallery" : "Visual Art"),
    verified: store.verificationStatus === "approved",
    planId: pro ? "professional" : undefined,
    subscriptionStatus: pro ? subscription.status : undefined,
    subscriptionExpiresAt: pro ? subscription.currentPeriodEnd?.toISOString() : undefined,
  };
}
