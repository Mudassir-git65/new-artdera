import bcrypt from "bcryptjs";
import { PLAN_DEFINITIONS } from "../config/plans";
import {
  AnalyticsEventModel,
  ArtworkModel,
  CollectionModel,
  ConversationModel,
  ExhibitionModel,
  GalleryProfileModel,
  InvoiceModel,
  ListingQuotaModel,
  MessageModel,
  NotificationModel,
  OfferModel,
  OrderModel,
  PaymentModel,
  PayoutModel,
  PromotionModel,
  ShippingRuleModel,
  StoreModel,
  SubscriptionModel,
  SubscriptionPlanModel,
  TaxonomyModel,
  UserModel,
  ArtistProfileModel,
} from "../models";
import { normalizeEmail } from "../lib/security";

export type SeedCredentials = {
  artist: { email: string; password: string };
  gallery: { email: string; password: string };
  buyer: { email: string; password: string };
  admin: { email: string; password: string };
};

const taxonomy = {
  category: [
    "Abstract",
    "Calligraphy",
    "Contemporary",
    "Landscape",
    "Photography",
    "Portrait",
    "Prints",
    "Sculpture",
  ],
  medium: [
    "Acrylic",
    "Charcoal",
    "Digital",
    "Ink",
    "Mixed Media",
    "Oil",
    "Photography",
    "Watercolour",
  ],
  style: [
    "Contemporary",
    "Expressionist",
    "Geometric",
    "Minimal",
    "Modern",
    "Realist",
    "Traditional",
  ],
  province: [
    "Balochistan",
    "Gilgit-Baltistan",
    "Islamabad Capital Territory",
    "Khyber Pakhtunkhwa",
    "Punjab",
    "Sindh",
  ],
} as const;
const cities: Array<[string, string]> = [
  ["Islamabad", "Islamabad Capital Territory"],
  ["Karachi", "Sindh"],
  ["Hyderabad", "Sindh"],
  ["Lahore", "Punjab"],
  ["Rawalpindi", "Punjab"],
  ["Faisalabad", "Punjab"],
  ["Multan", "Punjab"],
  ["Peshawar", "Khyber Pakhtunkhwa"],
  ["Quetta", "Balochistan"],
  ["Gilgit", "Gilgit-Baltistan"],
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function seedPlansAndTaxonomy() {
  for (const plan of PLAN_DEFINITIONS) {
    await SubscriptionPlanModel.updateOne(
      { planId: plan.planId },
      { $set: plan },
      { upsert: true, runValidators: true },
    );
  }
  for (const [type, names] of Object.entries(taxonomy)) {
    for (const [sortOrder, name] of names.entries()) {
      await TaxonomyModel.updateOne(
        { type, slug: slugify(name) },
        { $set: { type, name, slug: slugify(name), isActive: true, sortOrder } },
        { upsert: true },
      );
    }
  }
  for (const [sortOrder, [name, province]] of cities.entries()) {
    await TaxonomyModel.updateOne(
      { type: "city", slug: slugify(name) },
      { $set: { type: "city", name, slug: slugify(name), province, isActive: true, sortOrder } },
      { upsert: true },
    );
  }
  await ShippingRuleModel.updateOne(
    { name: "Pakistan default art-safe estimate" },
    {
      $set: {
        name: "Pakistan default art-safe estimate",
        baseCost: 1500,
        perKgCost: 250,
        fragileSurcharge: 500,
        framingSurcharge: 300,
        isActive: true,
      },
    },
    { upsert: true },
  );
}

async function upsertUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: "artist" | "gallery" | "buyer" | "admin";
  city: string;
  province: string;
}) {
  const emailNormalized = normalizeEmail(input.email);
  const existing = await UserModel.findOne({ emailNormalized });
  if (existing) return existing;
  return UserModel.create({
    fullName: input.fullName,
    email: emailNormalized,
    emailNormalized,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: input.role,
    sellerType: input.role === "artist" || input.role === "gallery" ? input.role : null,
    status: "active",
    emailVerified: true,
    phoneVerified: false,
    city: input.city,
    province: input.province,
    country: "Pakistan",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
  });
}

export async function seedDemoData(credentials: SeedCredentials) {
  await seedPlansAndTaxonomy();
  const [artist, gallery, buyer, admin] = await Promise.all([
    upsertUser({
      ...credentials.artist,
      fullName: "Ayla Raza",
      role: "artist",
      city: "Lahore",
      province: "Punjab",
    }),
    upsertUser({
      ...credentials.gallery,
      fullName: "Mehr Gallery",
      role: "gallery",
      city: "Karachi",
      province: "Sindh",
    }),
    upsertUser({
      ...credentials.buyer,
      fullName: "Hamza Ahmed",
      role: "buyer",
      city: "Islamabad",
      province: "Islamabad Capital Territory",
    }),
    upsertUser({
      ...credentials.admin,
      fullName: "ArtDera Administrator",
      role: "admin",
      city: "Islamabad",
      province: "Islamabad Capital Territory",
    }),
  ]);
  await ArtistProfileModel.updateOne(
    { userId: artist._id },
    {
      $set: {
        userId: artist._id,
        displayName: "Ayla Raza",
        professionalTitle: "Contemporary Visual Artist",
        shortBio: "A Lahore-based artist exploring memory, rhythm and the architecture of place.",
        fullBio:
          "Ayla Raza works across acrylic and mixed media, translating remembered landscapes into calm, tactile compositions.",
        profileImageUrl: "/images/artist.png",
        coverImageUrl: "/images/hero-studio.jpg",
        city: "Lahore",
        province: "Punjab",
        country: "Pakistan",
        languages: ["English", "Urdu"],
        yearStarted: 2018,
        categories: ["Abstract", "Contemporary"],
        styles: ["Minimal", "Expressionist"],
        mediums: ["Acrylic", "Mixed Media"],
        themes: ["Memory", "Place"],
        verificationStatus: "approved",
        verificationBadge: true,
        onboardingCompleted: true,
        onboardingStep: 7,
      },
    },
    { upsert: true },
  );
  await GalleryProfileModel.updateOne(
    { userId: gallery._id },
    {
      $set: {
        userId: gallery._id,
        galleryName: "Mehr Gallery",
        description: "A Karachi gallery presenting thoughtful contemporary practice from Pakistan.",
        logoUrl: "/images/creator-3.jpg",
        coverImageUrl: "/images/hero-interior.jpg",
        city: "Karachi",
        province: "Sindh",
        country: "Pakistan",
        verificationStatus: "approved",
        onboardingCompleted: true,
      },
    },
    { upsert: true },
  );
  const artistStore = await StoreModel.findOneAndUpdate(
    { slug: "ayla-raza-studio" },
    {
      $set: {
        ownerId: artist._id,
        ownerType: "artist",
        name: "Ayla Raza Studio",
        slug: "ayla-raza-studio",
        tagline: "Abstract works shaped by memory and place",
        shortDescription: "Original contemporary paintings from Lahore.",
        fullDescription: "A considered studio collection of original works and small editions.",
        logoUrl: "/images/artist.png",
        coverImageUrl: "/images/hero-studio.jpg",
        categories: ["Abstract", "Contemporary"],
        styles: ["Minimal", "Expressionist"],
        mediums: ["Acrylic", "Mixed Media"],
        themes: ["Memory", "Place"],
        city: "Lahore",
        province: "Punjab",
        country: "Pakistan",
        status: "active",
        verificationStatus: "approved",
        isPublished: true,
        domesticShipping: true,
        internationalShipping: true,
        processingTime: "3–5 working days",
        totalFollowers: 126,
        totalViews: 2840,
        rating: 4.9,
        reviewCount: 18,
      },
    },
    { returnDocument: "after", upsert: true, runValidators: true },
  );
  const galleryStore = await StoreModel.findOneAndUpdate(
    { slug: "mehr-gallery" },
    {
      $set: {
        ownerId: gallery._id,
        ownerType: "gallery",
        name: "Mehr Gallery",
        slug: "mehr-gallery",
        tagline: "Contemporary practice from Pakistan",
        shortDescription: "Curated originals and limited editions.",
        fullDescription: "Mehr Gallery connects collectors with established and emerging voices.",
        logoUrl: "/images/creator-3.jpg",
        coverImageUrl: "/images/hero-interior.jpg",
        categories: ["Contemporary", "Photography"],
        styles: ["Modern"],
        mediums: ["Oil", "Photography"],
        city: "Karachi",
        province: "Sindh",
        country: "Pakistan",
        status: "active",
        verificationStatus: "approved",
        isPublished: true,
        domesticShipping: true,
        internationalShipping: true,
        processingTime: "5–7 working days",
        totalFollowers: 310,
        totalViews: 5210,
        rating: 4.8,
        reviewCount: 31,
      },
    },
    { returnDocument: "after", upsert: true, runValidators: true },
  );
  const professional = await SubscriptionPlanModel.findOne({ planId: "professional" }).lean();
  const galleryPlan = await SubscriptionPlanModel.findOne({ planId: "gallery" }).lean();
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  await SubscriptionModel.updateOne(
    { userId: artist._id },
    {
      $set: {
        userId: artist._id,
        storeId: artistStore._id,
        planId: "professional",
        billingCycle: "annual",
        status: "active",
        price: professional!.annualPrice ?? 500,
        currency: "PKR",
        commissionRate: professional!.commissionRate,
        listingLimit: professional!.listingLimit,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        nextBillingAt: nextMonth,
        paymentProvider: "demo",
        featuresSnapshot: professional!.permissions,
      },
    },
    { upsert: true },
  );
  await SubscriptionModel.updateOne(
    { userId: gallery._id },
    {
      $set: {
        userId: gallery._id,
        storeId: galleryStore._id,
        planId: "gallery",
        billingCycle: "monthly",
        status: "active",
        price: galleryPlan!.monthlyPrice,
        currency: "PKR",
        commissionRate: galleryPlan!.commissionRate,
        listingLimit: galleryPlan!.listingLimit,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        nextBillingAt: nextMonth,
        paymentProvider: "demo",
        featuresSnapshot: galleryPlan!.permissions,
      },
    },
    { upsert: true },
  );
  const artworkSeeds = [
    [
      artistStore,
      artist,
      "Silent Geometry",
      "silent-geometry",
      "Acrylic layers hold a quiet architectural rhythm.",
      "Abstract",
      "Acrylic",
      "Minimal",
      145000,
      "/images/art-1.jpg",
    ],
    [
      artistStore,
      artist,
      "Monsoon Memory",
      "monsoon-memory",
      "A luminous memory of rain crossing Lahore at dusk.",
      "Contemporary",
      "Mixed Media",
      "Expressionist",
      210000,
      "/images/art-2.jpg",
    ],
    [
      artistStore,
      artist,
      "Ochre Horizon",
      "ochre-horizon",
      "Earth and sky reduced to warm, balanced fields.",
      "Landscape",
      "Acrylic",
      "Modern",
      98000,
      "/images/art-3.jpg",
    ],
    [
      galleryStore,
      gallery,
      "City After Rain",
      "city-after-rain",
      "A photographic study of Karachi streets after a summer storm.",
      "Photography",
      "Photography",
      "Contemporary",
      76000,
      "/images/art-4.jpg",
    ],
    [
      galleryStore,
      gallery,
      "River Script",
      "river-script",
      "Gestural ink and calligraphic movement on archival paper.",
      "Calligraphy",
      "Ink",
      "Traditional",
      125000,
      "/images/art-5.jpg",
    ],
    [
      galleryStore,
      gallery,
      "Blue Interval",
      "blue-interval",
      "An expansive blue composition with restrained surface detail.",
      "Abstract",
      "Oil",
      "Minimal",
      260000,
      "/images/art-6.jpg",
    ],
  ] as const;
  const artworks = [];
  for (const [
    store,
    owner,
    title,
    slug,
    description,
    category,
    medium,
    style,
    price,
    image,
  ] of artworkSeeds) {
    const artwork = await ArtworkModel.findOneAndUpdate(
      { slug },
      {
        $set: {
          storeId: store._id,
          artistId: owner.role === "artist" ? owner._id : undefined,
          title,
          slug,
          description,
          category,
          medium,
          style,
          subject: category,
          themes: ["Place", "Memory"],
          yearCreated: 2026,
          artworkType: "original",
          editionType: "unique",
          price,
          currency: "PKR",
          width: 60,
          height: 76,
          depth: 3,
          measurementUnit: "cm",
          weight: 2.5,
          weightUnit: "kg",
          orientation: "portrait",
          isFramed: false,
          isFragile: true,
          quantity: 1,
          images: [{ url: image, alt: title, isPrimary: true }],
          certificateAvailable: true,
          pickupCity: store.city,
          domesticShipping: true,
          internationalShipping: true,
          processingTime: store.processingTime,
          tags: [slug, category.toLowerCase(), "pakistan"],
          status: "published",
          moderationStatus: "approved",
          isSponsored: false,
          views: 320,
          wishlistCount: 24,
          messageCount: 6,
        },
      },
      { returnDocument: "after", upsert: true, runValidators: true },
    );
    artworks.push(artwork);
  }
  await ListingQuotaModel.updateOne(
    { userId: artist._id },
    { $set: { activeListings: 3 } },
    { upsert: true },
  );
  await ListingQuotaModel.updateOne(
    { userId: gallery._id },
    { $set: { activeListings: 3 } },
    { upsert: true },
  );
  await CollectionModel.updateOne(
    { slug: "new-pakistani-abstraction" },
    {
      $set: {
        name: "New Pakistani Abstraction",
        slug: "new-pakistani-abstraction",
        description: "A measured selection of contemporary abstract practice.",
        artworkIds: artworks.slice(0, 4).map((item) => item._id),
        coverImageUrl: "/images/art-1.jpg",
        isPublished: true,
        sortOrder: 1,
      },
    },
    { upsert: true },
  );
  await ExhibitionModel.updateOne(
    { slug: "lines-of-memory" },
    {
      $set: {
        galleryId: (await GalleryProfileModel.findOne({ userId: gallery._id }))!._id,
        name: "Lines of Memory",
        slug: "lines-of-memory",
        coverImageUrl: "/images/hero-interior.jpg",
        description: "A hybrid exhibition tracing memory through material and mark.",
        venue: "Mehr Gallery, Karachi",
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        endAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        artistIds: [artist._id],
        artworkIds: artworks.slice(0, 4).map((item) => item._id),
        type: "hybrid",
        status: "scheduled",
        isPublished: true,
      },
    },
    { upsert: true },
  );
  const conversation = await ConversationModel.findOneAndUpdate(
    { buyerId: buyer._id, sellerId: artist._id, artworkId: artworks[0]._id },
    {
      $setOnInsert: {
        participants: [buyer._id, artist._id],
        buyerId: buyer._id,
        sellerId: artist._id,
        storeId: artistStore._id,
        artworkId: artworks[0]._id,
        lastMessageAt: now,
        lastMessagePreview: "Is this work available for a video view?",
        status: "active",
      },
    },
    { returnDocument: "after", upsert: true },
  );
  if (!(await MessageModel.exists({ conversationId: conversation._id }))) {
    await MessageModel.create({
      conversationId: conversation._id,
      senderId: buyer._id,
      recipientId: artist._id,
      type: "text",
      text: "Is this work available for a video view?",
      isRead: false,
      moderationFlags: [],
    });
  }
  await OfferModel.updateOne(
    { conversationId: conversation._id, buyerId: buyer._id, status: "pending" },
    {
      $setOnInsert: {
        conversationId: conversation._id,
        artworkId: artworks[0]._id,
        buyerId: buyer._id,
        sellerId: artist._id,
        originalPrice: artworks[0].price,
        offeredPrice: 135000,
        currency: "PKR",
        message: "A respectful offer for consideration.",
        status: "pending",
        expiresAt: new Date(Date.now() + 48 * 60 * 60_000),
      },
    },
    { upsert: true },
  );
  const order = await OrderModel.findOneAndUpdate(
    { orderNumber: "AD-DEMO-0001" },
    {
      $setOnInsert: {
        orderNumber: "AD-DEMO-0001",
        buyerId: buyer._id,
        sellerId: artist._id,
        storeId: artistStore._id,
        items: [
          {
            artworkId: artworks[1]._id,
            title: artworks[1].title,
            image: artworks[1].images[0]?.url,
            price: artworks[1].price,
            quantity: 1,
          },
        ],
        artworkSubtotal: artworks[1].price,
        discount: 0,
        shippingCost: 2500,
        packagingCost: 500,
        handlingCost: 0,
        paymentProcessingFee: 4200,
        platformCommission: 3150,
        estimatedTax: 0,
        buyerTotal: artworks[1].price + 7200,
        sellerNetAmount: artworks[1].price - 7350,
        currency: "PKR",
        status: "completed",
        paymentStatus: "paid",
        shippingAddress: {
          fullName: buyer.fullName,
          line1: "Demo address",
          city: "Islamabad",
          province: "Islamabad Capital Territory",
          country: "Pakistan",
          phone: "+920000000000",
        },
        billingAddress: {
          fullName: buyer.fullName,
          line1: "Demo address",
          city: "Islamabad",
          province: "Islamabad Capital Territory",
          country: "Pakistan",
          phone: "+920000000000",
        },
        inspectionEndsAt: new Date(Date.now() - 2 * 24 * 60 * 60_000),
        completedAt: new Date(Date.now() - 24 * 60 * 60_000),
      },
    },
    { returnDocument: "after", upsert: true },
  );
  const payment = await PaymentModel.findOneAndUpdate(
    { providerReference: "demo_seed_order_0001" },
    {
      $set: {
        userId: buyer._id,
        orderId: order._id,
        paymentType: "order",
        provider: "demo",
        providerReference: "demo_seed_order_0001",
        amount: order.buyerTotal,
        currency: "PKR",
        status: "successful",
        paidAt: order.createdAt,
      },
    },
    { returnDocument: "after", upsert: true },
  );
  await InvoiceModel.updateOne(
    { invoiceNumber: "INV-DEMO-0001" },
    {
      $set: {
        invoiceNumber: "INV-DEMO-0001",
        userId: buyer._id,
        orderId: order._id,
        paymentId: payment._id,
        items: [
          {
            description: artworks[1].title,
            quantity: 1,
            unitPrice: artworks[1].price,
            total: artworks[1].price,
          },
        ],
        subtotal: order.artworkSubtotal,
        discount: 0,
        tax: 0,
        total: order.buyerTotal,
        currency: "PKR",
        status: "paid",
        issuedAt: order.createdAt,
        paidAt: order.createdAt,
      },
    },
    { upsert: true },
  );
  await PayoutModel.updateOne(
    { orderId: order._id },
    {
      $set: {
        sellerId: artist._id,
        orderId: order._id,
        grossAmount: order.artworkSubtotal,
        commissionDeduction: order.platformCommission,
        paymentFeeDeduction: order.paymentProcessingFee,
        shippingDeduction: 0,
        taxDeduction: 0,
        refundAdjustment: 0,
        netAmount: order.sellerNetAmount,
        status: "available",
        availableAt: new Date(),
      },
    },
    { upsert: true },
  );
  const promotionPayment = await PaymentModel.findOneAndUpdate(
    { providerReference: "demo_seed_promotion_0001" },
    {
      $set: {
        userId: artist._id,
        paymentType: "promotion",
        provider: "demo",
        providerReference: "demo_seed_promotion_0001",
        amount: 699,
        currency: "PKR",
        status: "successful",
        paidAt: now,
      },
    },
    { returnDocument: "after", upsert: true },
  );
  const promotion = await PromotionModel.findOneAndUpdate(
    { userId: artist._id, artworkId: artworks[0]._id, promotionType: "boost_7" },
    {
      $set: {
        userId: artist._id,
        storeId: artistStore._id,
        artworkId: artworks[0]._id,
        promotionType: "boost_7",
        placement: "Search boost",
        price: 699,
        currency: "PKR",
        startAt: new Date(Date.now() - 24 * 60 * 60_000),
        endAt: new Date(Date.now() + 6 * 24 * 60 * 60_000),
        status: "active",
        paymentId: promotionPayment._id,
        impressions: 820,
        clicks: 74,
        saves: 12,
        messages: 4,
      },
    },
    { returnDocument: "after", upsert: true },
  );
  promotionPayment.promotionId = promotion._id;
  await promotionPayment.save();
  await ArtworkModel.updateOne(
    { _id: artworks[0]._id },
    { $set: { isSponsored: true, promotionId: promotion._id } },
  );
  if (!(await AnalyticsEventModel.exists({ storeId: artistStore._id }))) {
    await AnalyticsEventModel.insertMany([
      {
        storeId: artistStore._id,
        artworkId: artworks[0]._id,
        type: "store_view",
        sessionHash: "seed-a",
        source: "ArtDera search",
        city: "Islamabad",
        country: "Pakistan",
        value: 0,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60_000),
      },
      {
        storeId: artistStore._id,
        artworkId: artworks[0]._id,
        type: "artwork_view",
        sessionHash: "seed-b",
        source: "Homepage",
        city: "Karachi",
        country: "Pakistan",
        value: 0,
        createdAt: new Date(Date.now() - 24 * 60 * 60_000),
      },
      {
        storeId: artistStore._id,
        artworkId: artworks[1]._id,
        type: "order",
        sessionHash: "seed-order",
        source: "Direct",
        city: "Islamabad",
        country: "Pakistan",
        value: order.artworkSubtotal,
        createdAt: order.createdAt,
      },
    ]);
  }
  for (const [userId, type, title, message, link] of [
    [
      artist._id,
      "payout_available",
      "Payout available",
      "Your demo order payout is available.",
      "/artist/dashboard/payouts",
    ],
    [
      buyer._id,
      "order_completed",
      "Order completed",
      "Your demo order is complete and eligible for review.",
      "/account/orders",
    ],
    [
      gallery._id,
      "store_approved",
      "Gallery storefront approved",
      "Your gallery storefront is live.",
      "/artist/dashboard",
    ],
    [
      admin._id,
      "verification_queue",
      "Moderation queue",
      "Demo marketplace records are ready for review.",
      "/admin/verification",
    ],
  ] as const) {
    if (!(await NotificationModel.exists({ userId, type })))
      await NotificationModel.create({ userId, type, title, message, link });
  }
  return { artist, gallery, buyer, admin, artistStore, galleryStore, artworks, order, promotion };
}
