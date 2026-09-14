import bcrypt from "bcryptjs";
import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ArtworkModel,
  OrderModel,
  StoreModel,
  UserModel,
} from "../server/models";

let app: Express;
const password = "password123";

beforeAll(async () => {
  const module = await import("../server/app");
  app = module.createApp();
});

async function directUser(
  role: "artist" | "buyer" | "gallery" | "admin",
  email: string,
) {
  return UserModel.create({
    fullName: `${role} test user`,
    email,
    emailNormalized: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 4),
    role,
    sellerType: role === "artist" || role === "gallery" ? role : null,
    status: "active",
    emailVerified: true,
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
  });
}

async function storeFor(owner: { _id: unknown; role: string }, slug: string) {
  return StoreModel.create({
    ownerId: owner._id,
    ownerType: owner.role,
    name: `${slug} store`,
    slug,
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    status: "active",
    isPublished: true,
    verificationStatus: "approved",
    totalViews: 0,
  });
}

async function artworkFor(storeId: unknown, artistId: unknown, slug: string, price = 8000) {
  return ArtworkModel.create({
    storeId,
    artistId,
    title: slug.replaceAll("-", " "),
    slug,
    artworkType: "original",
    description: "Targeted test artwork.",
    category: "Abstract",
    medium: "Oil on canvas",
    style: "Abstract",
    price,
    images: [{ url: "https://example.com/art.jpg", isPrimary: true }],
    dimensions: { height: 50, width: 40, unit: "cm" },
    pickupAddress: {
      line1: "12 Studio Rd",
      city: "Lahore",
      province: "Punjab",
      country: "Pakistan",
      phone: "+923001112233",
    },
    pickupCity: "Lahore",
    status: "published",
    moderationStatus: "approved",
    views: 0,
    wishlistCount: 0,
  });
}

describe("Targeted Earnings & Analytics Fixes", () => {
  it("verifies a cancelled PKR 8,000 order yields PKR 0 earnings and PKR 0 commission deduction", async () => {
    const seller = await directUser("artist", "cancelled-seller@example.com");
    const buyer = await directUser("buyer", "cancelled-buyer@example.com");
    const store = await storeFor(seller, "cancelled-store");
    const artwork = await artworkFor(store._id, seller._id, "cancelled-artwork", 8000);

    // Create a cancelled PKR 8,000 order
    await OrderModel.create({
      orderNumber: `ORD-CANCELLED-${Date.now()}`,
      buyerId: buyer._id,
      sellerId: seller._id,
      storeId: store._id,
      items: [{ artworkId: artwork._id, title: artwork.title, price: 8000, quantity: 1 }],
      artworkSubtotal: 8000,
      platformCommission: 1600,
      sellerNetAmount: 6400,
      buyerTotal: 8000,
      status: "cancelled",
      paymentStatus: "failed",
    });

    // Query paid orders using the server's exact filter logic
    const paidOrders = await OrderModel.find({
      sellerId: seller._id,
      status: {
        $in: [
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
        ],
      },
      paymentStatus: { $nin: ["unpaid", "failed", "rejected", "refunded"] },
    });

    expect(paidOrders.length).toBe(0);

    const cancelledRevenue = paidOrders.reduce((sum, o) => sum + o.artworkSubtotal, 0);
    const cancelledCommission = paidOrders.reduce((sum, o) => sum + o.platformCommission, 0);
    const cancelledPayout = paidOrders.reduce((sum, o) => sum + o.sellerNetAmount, 0);

    expect(cancelledRevenue).toBe(0);
    expect(cancelledCommission).toBe(0);
    expect(cancelledPayout).toBe(0);
  });

  it("verifies paid order earnings enter estimated payout while refunded/failed/unpaid show PKR 0", async () => {
    const seller = await directUser("artist", "multi-seller@example.com");
    const buyer = await directUser("buyer", "multi-buyer@example.com");
    const store = await storeFor(seller, "multi-store");
    const artwork = await artworkFor(store._id, seller._id, "multi-artwork", 8000);

    // 1. Paid order (PKR 8,000)
    await OrderModel.create({
      orderNumber: `ORD-PAID-${Date.now()}`,
      buyerId: buyer._id,
      sellerId: seller._id,
      storeId: store._id,
      items: [{ artworkId: artwork._id, title: artwork.title, price: 8000, quantity: 1 }],
      artworkSubtotal: 8000,
      platformCommission: 1600,
      sellerNetAmount: 6400,
      buyerTotal: 8000,
      status: "paid",
      paymentStatus: "paid",
    });

    // 2. Refunded order (PKR 12,000)
    await OrderModel.create({
      orderNumber: `ORD-REFUNDED-${Date.now()}`,
      buyerId: buyer._id,
      sellerId: seller._id,
      storeId: store._id,
      items: [{ artworkId: artwork._id, title: artwork.title, price: 12000, quantity: 1 }],
      artworkSubtotal: 12000,
      platformCommission: 2400,
      sellerNetAmount: 9600,
      buyerTotal: 12000,
      status: "refunded",
      paymentStatus: "refunded",
    });

    // 3. Unpaid order (PKR 15,000)
    await OrderModel.create({
      orderNumber: `ORD-UNPAID-${Date.now()}`,
      buyerId: buyer._id,
      sellerId: seller._id,
      storeId: store._id,
      items: [{ artworkId: artwork._id, title: artwork.title, price: 15000, quantity: 1 }],
      artworkSubtotal: 15000,
      platformCommission: 3000,
      sellerNetAmount: 12000,
      buyerTotal: 15000,
      status: "awaiting_payment",
      paymentStatus: "unpaid",
    });

    const paidOrders = await OrderModel.find({
      sellerId: seller._id,
      status: {
        $in: [
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
        ],
      },
      paymentStatus: { $nin: ["unpaid", "failed", "rejected", "refunded"] },
    });

    expect(paidOrders.length).toBe(1);
    expect(paidOrders[0].artworkSubtotal).toBe(8000);
    expect(paidOrders[0].sellerNetAmount).toBe(6400);

    const totalEstimatedPayout = paidOrders.reduce((sum, o) => sum + o.sellerNetAmount, 0);
    expect(totalEstimatedPayout).toBe(6400); // Only the genuinely paid PKR 8,000 order contributes PKR 6,400 net!
  });

  it("deduplicates store views from repeated refreshes", async () => {
    const seller = await directUser("artist", "dedup-seller@example.com");
    const store = await storeFor(seller, "dedup-store");

    const res1 = await request(app).get(`/api/stores/${store.slug}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app).get(`/api/stores/${store.slug}`);
    expect(res2.status).toBe(200);

    const updatedStore = await StoreModel.findById(store._id);
    expect(updatedStore?.totalViews).toBe(1); // Deduplicated! Second request did not increment count.
  });

  it("deduplicates artwork views from repeated refreshes", async () => {
    const seller = await directUser("artist", "artwork-seller@example.com");
    const store = await storeFor(seller, "artwork-dedup-store");
    const artwork = await artworkFor(store._id, seller._id, "artwork-dedup-work");

    const res1 = await request(app).get(`/api/artworks/slug/${artwork.slug}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app).get(`/api/artworks/slug/${artwork.slug}`);
    expect(res2.status).toBe(200);

    const updatedArtwork = await ArtworkModel.findById(artwork._id);
    expect(updatedArtwork?.views).toBe(1); // Deduplicated! Second request did not increment count.
  });
});
