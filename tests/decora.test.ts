import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../server/app";
import {
  ArtworkModel,
  AuthSessionModel,
  CollectionModel,
  OrderModel,
  PromotionModel,
  StoreModel,
  SubscriptionModel,
  SubscriptionPlanModel,
  UserModel,
} from "../server/models";
import { hashToken } from "../server/lib/security";
import { loadCatalogPage, loadHomeCatalog, loadCollectionCatalog } from "../src/lib/catalog.server";
import { customizationOptionsSchema } from "../src/lib/decora";

const app = createApp();
const options = [
  { label: "Embroidered name", required: true, choices: [] },
  { label: "Colour", required: true, choices: ["Ivory", "Sage"] },
];
const selections = [
  { label: "Embroidered name", value: "Ayesha" },
  { label: "Colour", value: "Sage" },
];
const shippingAddress = {
  fullName: "Décora Buyer",
  line1: "12 Art Street",
  city: "Lahore",
  province: "Punjab",
  country: "Pakistan",
  phone: "+923001112233",
};

async function account(role: "artist" | "buyer", name: string) {
  const user = await UserModel.create({
    fullName: name,
    email: `${name}@test.com`,
    emailNormalized: `${name}@test.com`,
    passwordHash: "unused",
    role,
    status: "active",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
  });
  const token = randomUUID();
  await AuthSessionModel.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return { user, cookie: `artdera_session=${token}` };
}

async function fixture() {
  const seller = await account("artist", "decora-seller");
  const plan = await SubscriptionPlanModel.findOne({ planId: "free" }).lean();
  await SubscriptionModel.create({
    userId: seller.user._id,
    planId: "free",
    billingCycle: "free",
    status: "active",
    price: 0,
    commissionRate: plan!.commissionRate,
    listingLimit: plan!.listingLimit,
    featuresSnapshot: plan!.permissions,
  });
  const store = await StoreModel.create({
    ownerId: seller.user._id,
    ownerType: "artist",
    name: "Décora Studio",
    slug: "decora-studio",
    city: "Lahore",
    status: "active",
    isPublished: true,
  });
  const buyer = await account("buyer", "decora-buyer");
  const payload = {
    title: "Personalized prayer mat",
    category: "Customized prayer mats",
    medium: "Embroidered cotton",
    price: 2499,
    section: "decora",
    decoraCategory: "prayer-mats",
    customizationOptions: options,
    quantity: 5,
    images: [{ url: "/images/art-1.jpg" }],
    status: "published",
  };
  return { seller, buyer, store, payload };
}

describe("ArtDera Décora", () => {
  it("enforces the inclusive price ceiling on create and partial updates without changing artwork pricing", async () => {
    const { seller, payload } = await fixture();
    for (const price of [0, 3000.01, 3001]) {
      const rejected = await request(app)
        .post("/api/artworks")
        .set("Cookie", seller.cookie)
        .send({ ...payload, price });
      expect(rejected.status).toBe(422);
    }
    expect(
      (
        await request(app)
          .post("/api/artworks")
          .set("Cookie", seller.cookie)
          .send({ ...payload, decoraCategory: undefined })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post("/api/artworks")
          .set("Cookie", seller.cookie)
          .send({ ...payload, discountPrice: 2800 })
      ).status,
    ).toBe(422);
    const saved = await request(app)
      .post("/api/artworks")
      .set("Cookie", seller.cookie)
      .send({ ...payload, price: 3000 })
      .expect(201);
    const id = saved.body.data.id;
    expect(saved.body.data.kind).toBe("Handmade");
    expect(saved.body.data.customizationOptions).toEqual(options);
    await request(app)
      .patch(`/api/artworks/${id}`)
      .set("Cookie", seller.cookie)
      .send({ price: 3000 })
      .expect(200);
    await request(app)
      .patch(`/api/artworks/${id}`)
      .set("Cookie", seller.cookie)
      .send({ price: 3000.01 })
      .expect(422);
    await request(app)
      .patch(`/api/artworks/${id}`)
      .set("Cookie", seller.cookie)
      .send({ price: 1999, discountPrice: 1499 })
      .expect(200);
    expect((await ArtworkModel.findById(id))?.section).toBe("decora");
    const premium = await request(app)
      .post("/api/artworks")
      .set("Cookie", seller.cookie)
      .send({
        title: "Premium painting",
        category: "Painting",
        medium: "Oil",
        kind: "Original",
        price: 150_000,
        status: "draft",
      })
      .expect(201);
    expect(premium.body.data.price).toBe(150_000);
    const outsider = await account("artist", "other-seller");
    await request(app)
      .patch(`/api/artworks/${id}`)
      .set("Cookie", outsider.cookie)
      .send({ price: 999 })
      .expect(404);
  });

  it("keeps Décora scoped, approved, filtered and paginated independently of premium artwork", async () => {
    const { seller, store, payload } = await fixture();
    for (let i = 0; i < 4; i++)
      await request(app)
        .post("/api/artworks")
        .set("Cookie", seller.cookie)
        .send({
          ...payload,
          title: `Décora find ${i}`,
          price: 500 + i * 600,
          decoraCategory: i === 0 ? "booklets" : "prayer-mats",
          status: "draft",
        })
        .expect(201);
    await ArtworkModel.updateMany(
      { storeId: store._id },
      { status: "published", moderationStatus: "approved" },
    );
    await ArtworkModel.create({
      storeId: store._id,
      title: "Premium original",
      slug: "premium-original",
      category: "Painting",
      medium: "Oil",
      artworkType: "original",
      price: 90000,
      status: "published",
      moderationStatus: "approved",
    });
    await ArtworkModel.create({
      storeId: store._id,
      title: "Pending Décora",
      slug: "pending-decora",
      category: "Craft",
      section: "decora",
      decoraCategory: "handmade-crafts",
      medium: "Clay",
      artworkType: "handmade",
      price: 800,
      status: "pending_review",
      moderationStatus: "pending",
    });
    const page = await loadCatalogPage({ section: "decora", limit: 2, sort: "price_asc" });
    expect(page.total).toBe(4);
    expect(page.products.map((item) => item.price)).toEqual([500, 1100]);
    const next = await loadCatalogPage({
      section: "decora",
      limit: 2,
      sort: "price_asc",
      cursor: page.nextCursor!,
    });
    expect(next.products.map((item) => item.price)).toEqual([1700, 2300]);
    expect(next.nextCursor).toBeNull();
    expect(
      (
        await loadCatalogPage({
          section: "decora",
          decoraCategory: "prayer-mats",
          min: 1000,
          max: 1999,
        })
      ).products,
    ).toHaveLength(2);
    expect((await loadCatalogPage({ section: "decora", q: "find 0" })).products).toHaveLength(1);
    const artworkPage = await request(app).get("/api/artworks").expect(200);
    expect(artworkPage.body.data.items.map((item: any) => item.title)).toEqual([
      "Premium original",
    ]);
    const decoraPage = await request(app)
      .get("/api/artworks?section=decora&maxPrice=9999")
      .expect(200);
    expect(decoraPage.body.data.total).toBe(4);
    expect(
      (await loadHomeCatalog()).products.every((item) => item.artwork?.section !== "decora"),
    ).toBe(true);
  });

  it("validates personalization and carries it through quantities, checkout, payment and seller order views", async () => {
    const { seller, buyer, payload } = await fixture();
    const saved = await request(app)
      .post("/api/artworks")
      .set("Cookie", seller.cookie)
      .send(payload)
      .expect(201);
    const artworkId = saved.body.data.id;
    for (const customization of [
      [],
      [{ label: "Unknown", value: "x" }],
      [
        { label: "Embroidered name", value: "Ayesha" },
        { label: "Colour", value: "Blue" },
      ],
      [...selections, selections[0]],
    ]) {
      await request(app)
        .post("/api/cart/items")
        .set("Cookie", buyer.cookie)
        .send({ artworkId, customization })
        .expect(422);
    }
    await request(app)
      .post("/api/cart/items")
      .set("Cookie", buyer.cookie)
      .send({ artworkId, quantity: 2, customization: selections })
      .expect(201);
    const cart = await request(app).get("/api/cart").set("Cookie", buyer.cookie).expect(200);
    expect(cart.body.data.items[0].customization).toEqual(selections);
    expect(cart.body.data.subtotal).toBe(4998);
    const checkout = await request(app)
      .post("/api/checkout")
      .set("Cookie", buyer.cookie)
      .send({ shippingAddress, method: "jazzcash", idempotencyKey: randomUUID() })
      .expect((response) => expect(response.status, JSON.stringify(response.body)).toBe(201));
    const { order, payment } = checkout.body.data.orders[0];
    expect(order.items[0].customization).toEqual(selections);
    expect(order.total).toBe(4998);
    expect(payment.id).toBeTruthy();
    expect(checkout.body.data.orders[0].paymentInstructions.method).toBe("jazzcash");
    expect(
      (await OrderModel.findById(order.id))?.items[0].customization.map((item: any) => ({
        label: item.label,
        value: item.value,
      })),
    ).toEqual(selections);
    for (const cookie of [seller.cookie, buyer.cookie]) {
      const response = await request(app).get("/api/orders").set("Cookie", cookie).expect(200);
      expect(response.body.data[0].items[0].customization).toEqual(selections);
    }
    const bootstrap = await request(app)
      .get("/api/bootstrap")
      .set("Cookie", seller.cookie)
      .expect(200);
    expect(bootstrap.body.data.private.orders[0].items[0].customization).toEqual(selections);
  });

  it("rechecks changed customization requirements at checkout and rejects ambiguous field definitions", async () => {
    const { seller, buyer, payload } = await fixture();
    const saved = await request(app)
      .post("/api/artworks")
      .set("Cookie", seller.cookie)
      .send(payload)
      .expect(201);
    const artworkId = saved.body.data.id;
    await request(app)
      .post("/api/cart/items")
      .set("Cookie", buyer.cookie)
      .send({ artworkId, customization: selections })
      .expect(201);
    await request(app)
      .patch(`/api/artworks/${artworkId}`)
      .set("Cookie", seller.cookie)
      .send({
        customizationOptions: [...options, { label: "Gift message", required: true, choices: [] }],
      })
      .expect(200);
    const rejected = await request(app)
      .post("/api/checkout")
      .set("Cookie", buyer.cookie)
      .send({ shippingAddress, method: "jazzcash", idempotencyKey: randomUUID() })
      .expect(422);
    expect(rejected.body.error.code).toBe("CUSTOMIZATION_REQUIRED");
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(
      customizationOptionsSchema.safeParse([
        ...options,
        { ...options[0], label: "embroidered name" },
      ]).success,
    ).toBe(false);
  });

  it("filters and sorts discounted Décora products by their displayed price", async () => {
    const { seller, payload } = await fixture();
    for (const [title, price, discountPrice] of [
      ["Low price", 1200, 900],
      ["Sale find", 2800, 500],
      ["No discount", 1500, undefined],
    ] as const) {
      await request(app)
        .post("/api/artworks")
        .set("Cookie", seller.cookie)
        .send({ ...payload, title, price, discountPrice, status: "draft" })
        .expect(201);
    }
    await ArtworkModel.updateMany(
      { section: "decora" },
      { status: "published", moderationStatus: "approved" },
    );
    const page = await loadCatalogPage({
      section: "decora",
      min: 0,
      max: 999,
      sort: "price_asc",
      limit: 1,
    });
    expect(page.total).toBe(2);
    expect(page.products[0].price).toBe(500);
    const next = await loadCatalogPage({
      section: "decora",
      min: 0,
      max: 999,
      sort: "price_asc",
      limit: 1,
      cursor: page.nextCursor!,
    });
    expect(next.products[0].price).toBe(900);
    const api = await request(app)
      .get("/api/artworks?section=decora&maxPrice=999&sort=price_asc")
      .expect(200);
    expect(api.body.data.items.map((item: any) => item.discountPrice ?? item.price)).toEqual([
      500, 900,
    ]);
  });

  it("puts Zeenora first in Décora's popular order with stable pagination and scoped filters", async () => {
    const { store } = await fixture();
    const zeenora = await account("artist", "zeenora");
    const zeenoraStore = await StoreModel.create({
      ownerId: zeenora.user._id,
      ownerType: "artist",
      name: "ZEENORA",
      slug: "zeenora-candles",
      status: "active",
      isPublished: true,
    });
    const items = await ArtworkModel.create(
      [
        { title: "Popular artwork", slug: "popular-artwork", price: 150, views: 100 },
        { title: "Another artwork", slug: "another-artwork", price: 600, views: 50 },
        {
          title: "Décora craft",
          slug: "decora-craft",
          price: 2500,
          section: "decora",
          decoraCategory: "handmade-crafts",
        },
        {
          title: "Paraffin candle",
          slug: "paraffin-candle",
          storeId: zeenoraStore._id,
          price: 500,
          discountPrice: 400,
        },
        {
          title: "Floral candle",
          slug: "floral-candle",
          storeId: zeenoraStore._id,
          price: 2000,
          discountPrice: 1800,
          views: 1,
        },
        {
          title: "Expensive candle",
          slug: "expensive-candle",
          storeId: zeenoraStore._id,
          price: 3001,
        },
        {
          title: "Pending candle",
          slug: "pending-candle",
          storeId: zeenoraStore._id,
          status: "pending_review",
          moderationStatus: "pending",
        },
        {
          title: "Demo candle",
          slug: "demo-candle",
          storeId: zeenoraStore._id,
          isDemo: true,
        },
      ].map((artwork) => ({
        storeId: store._id,
        category: "Decorative Arts",
        medium: "Wax",
        artworkType: "original",
        price: 500,
        status: "published",
        moderationStatus: "approved",
        createdAt: new Date("2026-01-01"),
        ...artwork,
      })),
    );
    const expected = [items[4], items[3], items[0], items[1], items[2]].map((item) =>
      String(item._id),
    );
    await PromotionModel.create({
      userId: zeenora.user._id,
      storeId: zeenoraStore._id,
      artworkId: items[4]._id,
      promotionType: "homepage",
      placement: "homepage",
      status: "active",
      startAt: new Date(Date.now() - 1000),
      endAt: new Date(Date.now() + 86_400_000),
      price: 1000,
      currency: "PKR",
    });
    const featured = await loadCatalogPage({ section: "decora", sort: "popular", limit: 4 });
    expect(featured.total).toBe(5);
    expect(featured.products.map((product) => product.id)).toEqual(expected.slice(0, 4));
    expect(featured.products.slice(0, 2).map((product) => product.creatorSlug)).toEqual([
      "zeenora-candles",
      "zeenora-candles",
    ]);
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await loadCatalogPage({ section: "decora", sort: "popular", limit: 1, cursor });
      ids.push(...page.products.map((product) => product.id!));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(ids).toEqual(expected);
    const api = await request(app).get("/api/artworks?section=decora&sort=popular").expect(200);
    expect(api.body.data.items.map((item: any) => item.id)).toEqual(expected);
    await PromotionModel.deleteMany({ artworkId: items[4]._id });
    const filtered = await loadCatalogPage({
      section: "decora",
      sort: "popular",
      q: "Paraffin",
      max: 999,
    });
    expect(filtered.products.map((product) => product.id)).toEqual([String(items[3]._id)]);
    const category = await loadCatalogPage({
      section: "decora",
      sort: "popular",
      decoraCategory: "handmade-crafts",
    });
    expect(category.products.map((product) => product.id)).toEqual([String(items[2]._id)]);
    const price = await loadCatalogPage({ section: "decora", sort: "price_asc" });
    expect(price.products.map((product) => product.price)).toEqual([150, 400, 600, 1800, 2500]);
    const ordinary = await loadCatalogPage({ sort: "popular" });
    expect(ordinary.products[0].id).toBe(String(items[0]._id));
    expect((await ArtworkModel.findById(items[3]._id))?.views).toBe(0);
  });

  it("includes collection artwork up to PKR 3,000 without moving or duplicating the original listings", async () => {
    const { seller, store, payload } = await fixture();
    const artworks = await ArtworkModel.create(
      [
        { title: "Affordable original", slug: "affordable-original", price: 1500 },
        { title: "Exactly three thousand", slug: "exactly-three-thousand", price: 3000 },
        { title: "Over the limit", slug: "over-the-limit", price: 3000.01 },
        {
          title: "Discounted collection work",
          slug: "discounted-collection-work",
          price: 5000,
          discountPrice: 500,
        },
        {
          title: "Awaiting review",
          slug: "awaiting-review",
          price: 800,
          status: "pending_review",
          moderationStatus: "pending",
        },
        { title: "Demo work", slug: "demo-work", price: 700, isDemo: true },
      ].map((artwork) => ({
        storeId: store._id,
        artistId: seller.user._id,
        category: "Painting",
        medium: "Oil",
        artworkType: "original",
        status: "published",
        moderationStatus: "approved",
        ...artwork,
      })),
    );
    await CollectionModel.create({
      name: "Existing collection",
      slug: "existing-collection",
      isPublished: true,
      artworkIds: artworks.slice(0, 4).map((artwork: { _id: unknown }) => artwork._id),
    });
    const originalCollection = await loadCollectionCatalog();
    const listing = await request(app)
      .post("/api/artworks")
      .set("Cookie", seller.cookie)
      .send(payload)
      .expect(201);
    const first = await loadCatalogPage({ section: "decora", sort: "price_asc", limit: 2 });
    expect(first.total).toBe(4);
    expect(first.products.map((product) => product.price)).toEqual([500, 1500]);
    const second = await loadCatalogPage({
      section: "decora",
      sort: "price_asc",
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(second.products.map((product) => product.price)).toEqual([2499, 3000]);
    expect(second.nextCursor).toBeNull();
    const collectionOnly = await loadCatalogPage({ section: "decora", decoraCategory: "artworks" });
    expect(collectionOnly.products.map((product) => product.title).sort()).toEqual([
      "Affordable original",
      "Discounted collection work",
      "Exactly three thousand",
    ]);
    const api = await request(app)
      .get(`/api/artworks?section=decora&storeId=${store._id}&maxPrice=99999`)
      .expect(200);
    expect(api.body.data.total).toBe(4);
    expect(new Set(api.body.data.items.map((item: any) => item.id)).size).toBe(4);
    const category = await request(app)
      .get("/api/artworks?section=decora&decoraCategory=prayer-mats")
      .expect(200);
    expect(category.body.data.items.map((item: any) => item.id)).toEqual([listing.body.data.id]);
    expect((await loadCollectionCatalog()).collections).toEqual(originalCollection.collections);
    expect((await ArtworkModel.findById(artworks[0]._id))?.section).toBe("artwork");
    expect(await ArtworkModel.countDocuments()).toBe(7);
  });
});
