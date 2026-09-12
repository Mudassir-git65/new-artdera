import { Router } from "express";
import {
  ArtistProfileModel,
  ArtworkModel,
  CollectionModel,
  ConversationModel,
  ExhibitionModel,
  FollowModel,
  GalleryProfileModel,
  InvoiceModel,
  MessageModel,
  NotificationModel,
  OrderModel,
  PaymentModel,
  PayoutModel,
  PromotionModel,
  ReviewModel,
  ShipmentModel,
  StoreModel,
  SubscriptionModel,
  SubscriptionPlanModel,
  TaxonomyModel,
  WishlistItemModel,
} from "../models";
import { asyncRoute, ok } from "../lib/http";
import {
  publicArtwork,
  publicAssetUrl,
  publicStore as publicStoreRecord,
  serializeSubscription,
} from "../lib/serializers";
import { PROMOTION_PRICES } from "../config/plans";
import { getEnv } from "../config/env";
import { refreshPromotionStates } from "../services/sponsored";
import { isActiveProfessionalSubscription } from "../services/plans";

export const bootstrapRouter = Router();

bootstrapRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    // Fire-and-forget: refresh promotion states in the background so it
    // doesn't block the response. On cold starts this runs concurrently
    // with the DB queries below.
    void refreshPromotionStates().catch(() => undefined);

    const isPublicRequest = !req.auth;

    // For unauthenticated requests instruct browsers and CDN edges to cache
    // the public portion for 60 s, and serve stale for up to 5 min while
    // revalidating in the background. This cuts repeated cold-start latency
    // dramatically for anonymous visitors (homepage, discover, product pages).
    if (isPublicRequest) {
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      res.setHeader("Vary", "Accept-Encoding");
    }

    const [
      plans,
      stores,
      artworks,
      artistProfiles,
      galleryProfiles,
      taxonomies,
      collections,
      exhibitions,
    ] = await Promise.all([
      SubscriptionPlanModel.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
      StoreModel.find({ isPublished: true, status: "active" })
        .select("ownerId slug name tagline shortDescription logoUrl coverImageUrl city country status isPublished categories mediums createdAt")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      ArtworkModel.find({ status: "published", moderationStatus: "approved" })
        .select("storeId artistId galleryId title slug description story category medium style subject colours yearCreated artworkType editionType editionTotal price discountPrice width height measurementUnit isFramed images sponsored isSponsored tags status moderationStatus")
        .sort({ createdAt: -1 })
        .limit(24)
        .lean(),
      ArtistProfileModel.find({ onboardingCompleted: true })
        .select("userId displayName professionalTitle shortBio profileImageUrl coverImageUrl city country categories styles mediums verificationStatus")
        .populate("userId", "fullName city province country avatarUrl")
        .lean(),
      GalleryProfileModel.find({ onboardingCompleted: true })
        .select("userId galleryName description logoUrl coverImageUrl city country verificationStatus")
        .populate("userId", "fullName city province country avatarUrl")
        .lean(),
      TaxonomyModel.find({ isActive: true }).sort({ type: 1, sortOrder: 1, name: 1 }).lean(),
      CollectionModel.find({ isPublished: true }).sort({ sortOrder: 1 }).lean(),
      ExhibitionModel.find({ isPublished: true, status: { $in: ["scheduled", "active"] } })
        .sort({ startAt: 1 })
        .lean(),
    ]);
    const publicOwnerIds = stores.map((store) => store.ownerId);
    const publicSubscriptions = publicOwnerIds.length
      ? await SubscriptionModel.find({
          userId: { $in: publicOwnerIds },
          planId: "professional",
          status: "active",
          currentPeriodEnd: { $gt: new Date() },
        })
          .select("userId planId status currentPeriodEnd")
          .lean()
      : [];
    const publicSubscriptionByOwner = new Map(
      publicSubscriptions
        .filter((subscription) => isActiveProfessionalSubscription(subscription))
        .map((subscription) => [String(subscription.userId), subscription]),
    );
    const publicStore = (store: any) => {
      const serialized = publicStoreRecord(store);
      const subscription = publicSubscriptionByOwner.get(String(store.ownerId));
      return {
        ...serialized,
        approvedSeller: store.status === "active" && store.isPublished === true,
        planId: subscription?.planId,
        subscriptionStatus: subscription?.status,
        subscriptionExpiresAt: subscription?.currentPeriodEnd?.toISOString?.(),
      };
    };
    const publicData: Record<string, unknown> = {
      runtime: {
        demoPaymentMode: getEnv().DEMO_PAYMENT_MODE,
        promotionPlacements: Object.entries(PROMOTION_PRICES).map(([id, value]) => ({
          id: id.replaceAll("_", "-"),
          name: id.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
          priceMin: value.minimum,
          priceMax: value.maximum,
          durationDays: value.durationDays,
          requiresApproval: value.approval,
          description: value.approval
            ? "Subject to ArtDera approval."
            : "Sponsored marketplace placement.",
        })),
      },
      plans: plans.map((plan) => ({
        id: plan.planId,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        listingLimit: plan.listingLimit,
        commission: plan.commissionRate,
        profile: plan.planId === "gallery" ? "Gallery storefront" : `${plan.name} artist profile`,
        analytics: `${plan.analyticsLevel.charAt(0).toUpperCase()}${plan.analyticsLevel.slice(1)}`,
        payoutTime: `${plan.payoutMinimumDays}–${plan.payoutMaximumDays} working days`,
        staffLimit: plan.staffAccountMaximum
          ? `${plan.staffAccountMinimum}–${plan.staffAccountMaximum}`
          : undefined,
        recommended: plan.recommended,
        features: plan.features,
        billingOptions: plan.allowedBillingCycles,
        buttonLabel: plan.planId === "free" ? "Start Free" : `Choose ${plan.name}`,
        styleId: plan.planId,
        allowedModules: plan.permissions,
        lockedModules: [],
        sellerType: plan.planId === "gallery" ? "gallery" : "artist",
        verification: "Independent verification review available",
      })),
      stores: stores.map(publicStore),
      artworks: artworks.map(publicArtwork),
      // A populated reference becomes null when a legacy profile outlives its
      // user. Never expose those orphan records as public creators.
      creators: artistProfiles
        .filter((profile: any) => profile.userId)
        .map((profile: any) => ({
          id: String(profile.userId?._id ?? profile.userId),
          slug:
            stores.find(
              (store) => String(store.ownerId) === String(profile.userId?._id ?? profile.userId),
            )?.slug ??
            String(profile.displayName)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-"),
          name: profile.displayName,
          type: "Artist",
          title: profile.professionalTitle,
          bio: profile.shortBio,
          fullBio: profile.fullBio,
          location: [profile.city, profile.country].filter(Boolean).join(", "),
          portrait: publicAssetUrl(profile.profileImageUrl ?? profile.userId?.avatarUrl) ?? "",
          cover: publicAssetUrl(profile.coverImageUrl) ?? "",
          verified: profile.verificationStatus === "approved",
          accountType: "artist",
          approvedSeller: true,
          ...(() => {
            const subscription = publicSubscriptionByOwner.get(
              String(profile.userId?._id ?? profile.userId),
            );
            return {
              planId: subscription?.planId,
              subscriptionStatus: subscription?.status,
              subscriptionExpiresAt: subscription?.currentPeriodEnd?.toISOString?.(),
            };
          })(),
          categories: profile.categories,
          styles: profile.styles,
          mediums: profile.mediums,
        })),
      galleries: galleryProfiles
        .filter((profile: any) => profile.userId)
        .map((profile: any) => ({
          id: String(profile.userId?._id ?? profile.userId),
          name: profile.galleryName,
          type: "Gallery",
          bio: profile.description,
          location: [profile.city, profile.country].filter(Boolean).join(", "),
          portrait: publicAssetUrl(profile.logoUrl ?? profile.userId?.avatarUrl) ?? "",
          cover: publicAssetUrl(profile.coverImageUrl) ?? "",
          verified: profile.verificationStatus === "approved",
          accountType: "gallery",
          approvedSeller: true,
        })),
      taxonomy: taxonomies.map((item) => ({
        id: String(item._id),
        type: item.type,
        name: item.name,
        slug: item.slug,
        province: item.province,
      })),
      collections: collections.map((item) => ({
        id: String(item._id),
        name: item.name,
        slug: item.slug,
        description: item.description,
        artworkIds: item.artworkIds.map(String),
        coverImage: publicAssetUrl(item.coverImageUrl),
      })),
      exhibitions: exhibitions.map((item) => ({
        id: String(item._id),
        galleryId: String(item.galleryId),
        name: item.name,
        slug: item.slug,
        coverImage: publicAssetUrl(item.coverImageUrl),
        description: item.description,
        venue: item.venue,
        startDate: item.startAt?.toISOString(),
        endDate: item.endAt?.toISOString(),
        artistIds: item.artistIds.map(String),
        artworkIds: item.artworkIds.map(String),
        format:
          item.type === "online" ? "Online" : item.type === "physical" ? "Physical" : "Hybrid",
        published: item.isPublished,
      })),
    };
    if (!req.auth) return ok(res, { ...publicData, private: null });
    const userId = req.auth.user._id;
    const role = req.auth.user.role;
    const seller =
      ["artist", "gallery", "gallery_staff"].includes(role) ||
      ["artist", "gallery"].includes(String(req.auth.user.sellerType ?? ""));
    const accountOrderFilter =
      role === "admin"
        ? {}
        : seller
          ? { $or: [{ buyerId: userId }, { sellerId: userId }] }
          : { buyerId: userId };
    const [
      subscription,
      ownedStores,
      orders,
      conversations,
      notifications,
      payments,
      invoices,
      promotions,
      payouts,
      reviews,
      wishlist,
      follows,
    ] = await Promise.all([
      SubscriptionModel.findOne({ userId }).sort({ createdAt: -1 }).lean(),
      seller ? StoreModel.find({ ownerId: userId }).lean() : Promise.resolve([]),
      OrderModel.find(accountOrderFilter).sort({ createdAt: -1 }).limit(200).lean(),
      ConversationModel.find({ participants: userId })
        .sort({ lastMessageAt: -1 })
        .limit(200)
        .lean(),
      NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
      PaymentModel.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
      InvoiceModel.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
      seller ? PromotionModel.find({ userId }).sort({ createdAt: -1 }).lean() : Promise.resolve([]),
      seller
        ? PayoutModel.find({ sellerId: userId }).sort({ createdAt: -1 }).lean()
        : Promise.resolve([]),
      ReviewModel.find(accountOrderFilter).sort({ createdAt: -1 }).lean(),
      WishlistItemModel.find({ userId }).lean(),
      FollowModel.find({ userId }).lean(),
    ]);
    const shipments = orders.length
      ? await ShipmentModel.find({ orderId: { $in: orders.map((order) => order._id) } }).lean()
      : [];
    const privateArtworkStoreIds = ownedStores.map((store) => store._id);
    const privateArtworks = privateArtworkStoreIds.length
      ? await ArtworkModel.find({ storeId: { $in: privateArtworkStoreIds } })
          .sort({ createdAt: -1 })
          .lean()
      : [];
    const conversationIds = conversations.map((conversation) => conversation._id);
    const messages = conversationIds.length
      ? await MessageModel.find({ conversationId: { $in: conversationIds } })
          .sort({ createdAt: 1 })
          .limit(1000)
          .lean()
      : [];
    return ok(res, {
      ...publicData,
      private: {
        subscription: subscription ? serializeSubscription(subscription) : null,
        stores: ownedStores.map(publicStore),
        artworks: privateArtworks.map(publicArtwork),
        orders: orders.map((order) => ({
          id: String(order._id),
          orderNumber: order.orderNumber,
          buyerId: String(order.buyerId),
          sellerId: String(order.sellerId),
          storeId: String(order.storeId),
          items: order.items.map((item: any) => ({
            id: String(item._id),
            artworkId: String(item.artworkId),
            title: item.title,
            image: publicAssetUrl(item.image),
            price: item.price,
            quantity: item.quantity,
          })),
          status: order.status,
          paymentStatus: order.paymentStatus,
          artworkSubtotal: order.artworkSubtotal,
          discount: order.discount,
          shippingCost: order.shippingCost,
          packagingCost: order.packagingCost,
          platformCommission: order.platformCommission,
          buyerTotal: order.buyerTotal,
          deliveryCity: order.shippingAddress?.city ?? "",
          inspectionEndsAt: order.inspectionEndsAt,
          createdAt: order.createdAt,
        })),
        conversations: conversations.map((item) => ({
          id: String(item._id),
          participantIds: item.participants.map(String),
          buyerId: String(item.buyerId),
          sellerId: String(item.sellerId),
          storeId: String(item.storeId),
          artworkId: item.artworkId ? String(item.artworkId) : undefined,
          lastMessageAt: item.lastMessageAt ?? item.updatedAt,
          unreadCount: item.unreadCount ?? 0,
          status:
            item.status === "active"
              ? "Active"
              : item.status === "archived"
                ? "Archived"
                : item.status === "blocked"
                  ? "Blocked"
                  : "Spam",
        })),
        messages: messages.map((item) => ({
          id: String(item._id),
          conversationId: String(item.conversationId),
          senderId: String(item.senderId),
          body: item.text,
          createdAt: item.createdAt.toISOString(),
          read: item.isRead,
          moderationFlags: item.moderationFlags,
        })),
        notifications: notifications.map((item) => ({
          id: String(item._id),
          userId: String(item.userId),
          type: item.type,
          title: item.title,
          body: item.message,
          read: item.isRead,
          createdAt: item.createdAt.toISOString(),
          href: item.link,
        })),
        payments: payments.map((item) => ({ ...item, id: String(item._id), _id: undefined })),
        invoices: invoices.map((item) => ({ ...item, id: String(item._id), _id: undefined })),
        promotions: promotions.map((item) => ({ ...item, id: String(item._id), _id: undefined })),
        payouts: payouts.map((item) => ({ ...item, id: String(item._id), _id: undefined })),
        shipments: shipments.map((item) => ({
          id: String(item._id),
          orderId: String(item.orderId),
          courier: item.courier,
          trackingNumber: item.trackingNumber,
          pickupCity: item.pickupCity,
          deliveryCity: item.deliveryCity,
          estimatedCost: item.estimatedCost,
          actualCost: item.actualCost,
          status: item.status,
          trackingEvents: item.trackingEvents,
          updatedAt: item.updatedAt,
        })),
        reviews: reviews.map((item) => ({
          id: String(item._id),
          orderId: String(item.orderId),
          artworkId: String(item.artworkId),
          buyerId: String(item.buyerId),
          sellerId: String(item.sellerId),
          rating: item.rating,
          title: item.title,
          body: item.comment,
          sellerResponse: item.sellerResponse,
          status:
            item.status === "approved"
              ? "Published"
              : item.status === "suspended"
                ? "Reported"
                : "Pending",
          createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
        })),
        wishlistIds: wishlist.map((item) => String(item.artworkId)),
        followedStoreIds: follows.map((item) => String(item.storeId)),
      },
    });
  }),
);
