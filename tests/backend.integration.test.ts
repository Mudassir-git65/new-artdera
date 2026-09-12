import bcrypt from "bcryptjs";
import type { Express } from "express";
import request, { type Agent } from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import {
  AffiliateCommissionModel,
  AffiliateModel,
  AffiliatePayoutModel,
  AffiliateReferralModel,
  ArtistProfileModel,
  ArtworkModel,
  AuthSessionModel,
  DisputeModel,
  GalleryProfileModel,
  GalleryStaffModel,
  InvoiceModel,
  ListingQuotaModel,
  OrderModel,
  PaymentModel,
  PaymentProofModel,
  PayoutModel,
  PromotionModel,
  ReviewModel,
  ShippingQuoteModel,
  ShippingRuleModel,
  StoreModel,
  SubscriptionModel,
  SubscriptionPlanModel,
  UserModel,
  VerificationRequestModel,
} from "../server/models";
import { reserveListingSlot } from "../server/services/plans";
import { mergeSponsoredResults } from "../server/services/sponsored";

let app: Express;

beforeAll(async () => {
  const module = await import("../server/app");
  app = module.createApp();
});

describe("affiliate ambassador program", () => {
  it("tracks a protected referral through payment, approval, payout, and duplicate verification", async () => {
    const affiliateUser = await directUser("buyer", "ambassador@example.com");
    const affiliateAgent = await login(affiliateUser.email);
    const application = await affiliateAgent
      .post("/api/affiliate/apply")
      .send({ requestedCode: "ARTLOVER5" });
    expect(application.status).toBe(201);
    expect(application.body.data.status).toBe("approved");
    expect(application.body.data.buyerDiscountRate).toBe(10);

    const admin = await directUser("admin", "affiliate-admin@example.com");
    const adminAgent = await login(admin.email);

    const seller = await directUser("artist", "affiliate-seller@example.com");
    const sellerAgent = await login(seller.email);
    await activeSubscription(seller._id, "free");
    const store = await storeFor(seller, "affiliate-studio");
    const artwork = await artworkFor(store._id, seller._id, "affiliate-work");
    artwork.price = 200_000;
    await artwork.save();

    const buyer = await directUser("buyer", "affiliate-buyer@example.com");
    const buyerAgent = await login(buyer.email);
    const captured = await buyerAgent
      .post("/api/affiliate/referrals/capture")
      .send({ code: "artlover5", landingPage: "/product/affiliate-work?ref=ARTLOVER5" });
    expect(captured.status).toBe(200);
    await buyerAgent.post("/api/cart/items").send({ artworkId: String(artwork._id), quantity: 1 });

    const preview = await buyerAgent.post("/api/affiliate/checkout-preview").send({});
    expect(preview.status).toBe(200);
    expect(preview.body.data.originalArtworkPrice).toBe(200_000);
    expect(preview.body.data.affiliateDiscount).toBe(20_000);
    expect(preview.body.data.finalArtworkPrice).toBe(180_000);
    expect(preview.body.data.attribution.code).toBe("ARTLOVER5");
    expect(preview.body.data.attribution.discountRate).toBe(10);
    expect(preview.body.data.attribution.message).toContain("10% off");

    const checkout = await buyerAgent.post("/api/checkout").send({
      shippingAddress: {
        fullName: "Affiliate Buyer",
        line1: "12 Art Street",
        city: "Lahore",
        province: "Punjab",
        country: "Pakistan",
        phone: "+923001112233",
      },
      method: "card",
      affiliateCode: "ARTLOVER5",
      idempotencyKey: "a71ac9d2-7677-41f7-ae55-c9278b0b9420",
    });
    expect(checkout.status).toBe(201);
    const { order, payment } = checkout.body.data.orders[0];
    expect(order.discount).toBe(20_000);
    expect(order.total).toBe(180_000);

    expect(
      (
        await buyerAgent
          .post(`/api/order-payments/${payment.id}/confirm-demo`)
          .send({ outcome: "success" })
      ).status,
    ).toBe(200);
    expect(await AffiliateCommissionModel.countDocuments({ orderId: order.id })).toBe(1);
    const pending = await AffiliateCommissionModel.findOne({ orderId: order.id }).lean();
    expect(pending?.status).toBe("pending");
    expect(pending?.eligibleSaleAmount).toBe(180_000);
    expect(pending?.commissionAmount).toBe(9_000);

    // Retrying verified payment is idempotent and cannot mint a second commission.
    await buyerAgent
      .post(`/api/order-payments/${payment.id}/confirm-demo`)
      .send({ outcome: "success" });
    expect(await AffiliateCommissionModel.countDocuments({ orderId: order.id })).toBe(1);

    for (const status of [
      "seller_confirmed",
      "preparing",
      "ready_for_pickup",
      "shipped",
      "delivered",
    ]) {
      const changed = await sellerAgent.patch(`/api/orders/${order.id}/status`).send({ status });
      expect(changed.status).toBe(200);
    }
    expect(
      (
        await buyerAgent
          .patch(`/api/orders/${order.id}/status`)
          .send({ status: "inspection_period" })
      ).status,
    ).toBe(200);
    await OrderModel.updateOne(
      { _id: order.id },
      { $set: { inspectionEndsAt: new Date(Date.now() - 60_000) } },
    );
    expect(
      (await buyerAgent.patch(`/api/orders/${order.id}/status`).send({ status: "completed" }))
        .status,
    ).toBe(200);
    expect((await AffiliateCommissionModel.findOne({ orderId: order.id }).lean())?.status).toBe(
      "approved",
    );

    const payout = await affiliateAgent
      .post("/api/affiliate/payouts")
      .send({ payoutMethod: "manual" });
    expect(payout.status).toBe(201);
    expect(payout.body.data.amount).toBe(9_000);
    expect((await AffiliatePayoutModel.findById(payout.body.data.id).lean())?.status).toBe(
      "requested",
    );
    expect(
      (
        await adminAgent
          .patch(`/api/admin/affiliate/payouts/${payout.body.data.id}`)
          .send({ action: "approve" })
      ).status,
    ).toBe(200);
    expect(
      (
        await adminAgent
          .patch(`/api/admin/affiliate/payouts/${payout.body.data.id}`)
          .send({ action: "mark_paid", transactionReference: "HBL-AFF-0001" })
      ).status,
    ).toBe(200);
    expect((await AffiliateCommissionModel.findOne({ orderId: order.id }).lean())?.status).toBe(
      "paid",
    );

    const dashboard = await affiliateAgent.get("/api/affiliate/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.metrics.paidCommissions).toBe(9_000);
    expect(dashboard.body.data.payouts[0].transactionReference).toBe("HBL-AFF-0001");
    expect(JSON.stringify(dashboard.body.data)).not.toContain("affiliate-buyer@example.com");
  });

  it("activates legacy pending codes with the current 10% buyer discount", async () => {
    const owner = await directUser("buyer", "legacy-affiliate@example.com");
    const legacy = await AffiliateModel.create({
      userId: owner._id,
      code: "LEGACYART5",
      codeNormalized: "LEGACYART5",
      status: "pending",
      commissionRate: 5,
      buyerDiscountRate: 5,
    });

    const response = await request(app)
      .post("/api/affiliate/referrals/capture")
      .send({ code: "LEGACYART5", landingPage: "/discover" });
    expect(response.status).toBe(200);

    const activated = await AffiliateModel.findById(legacy._id).lean();
    expect(activated?.status).toBe("approved");
    expect(activated?.buyerDiscountRate).toBe(10);
    expect(activated?.approvedAt).toBeInstanceOf(Date);
  });

  it("blocks self-referrals and preserves the first valid affiliate attribution", async () => {
    const firstUser = await directUser("buyer", "first-affiliate@example.com");
    const secondUser = await directUser("buyer", "second-affiliate@example.com");
    const first = await AffiliateModel.create({
      userId: firstUser._id,
      code: "FIRSTART5",
      codeNormalized: "FIRSTART5",
      status: "approved",
      commissionRate: 5,
      buyerDiscountRate: 5,
    });
    await AffiliateModel.create({
      userId: secondUser._id,
      code: "SECONDART5",
      codeNormalized: "SECONDART5",
      status: "approved",
      commissionRate: 5,
      buyerDiscountRate: 5,
    });
    const firstAgent = await login(firstUser.email);
    const selfReferral = await firstAgent
      .post("/api/affiliate/checkout-preview")
      .send({ code: "FIRSTART5" });
    // The code is rejected before cart pricing can be manipulated.
    expect(selfReferral.status).toBe(422);
    expect(selfReferral.body.error.code).toBe("SELF_REFERRAL_NOT_ALLOWED");

    const visitor = request.agent(app);
    expect(
      (
        await visitor
          .post("/api/affiliate/referrals/capture")
          .send({ code: "FIRSTART5", landingPage: "/discover?ref=FIRSTART5" })
      ).status,
    ).toBe(200);
    const hijack = await visitor
      .post("/api/affiliate/referrals/capture")
      .send({ code: "SECONDART5", landingPage: "/discover?ref=SECONDART5" });
    expect(hijack.status).toBe(200);
    expect(hijack.body.data.preserved).toBe(true);
    expect((await AffiliateModel.findById(first._id).lean())?.totalClicks).toBe(1);

    await AffiliateReferralModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1) } });
    const afterExpiry = await visitor
      .post("/api/affiliate/referrals/capture")
      .send({ code: "SECONDART5", landingPage: "/discover?ref=SECONDART5" });
    expect(afterExpiry.status).toBe(200);
    expect(afterExpiry.body.data.preserved).toBe(false);
    expect((await AffiliateModel.findOne({ code: "SECONDART5" }).lean())?.totalClicks).toBe(1);

    const invalid = await visitor
      .post("/api/affiliate/referrals/capture")
      .send({ code: "bad!", landingPage: "/discover" });
    expect(invalid.status).toBe(422);
  });

  it("rejects a commission when an attributed paid order is returned and refunded", async () => {
    const ambassador = await directUser("buyer", "refund-ambassador@example.com");
    await AffiliateModel.create({
      userId: ambassador._id,
      code: "RETURNART5",
      codeNormalized: "RETURNART5",
      status: "approved",
      commissionRate: 5,
      buyerDiscountRate: 5,
    });
    const seller = await directUser("artist", "refund-affiliate-seller@example.com");
    const sellerAgent = await login(seller.email);
    await activeSubscription(seller._id, "free");
    const store = await storeFor(seller, "refund-affiliate-studio");
    const artwork = await artworkFor(store._id, seller._id, "refund-affiliate-work");
    const buyer = await directUser("buyer", "refund-affiliate-buyer@example.com");
    const buyerAgent = await login(buyer.email);
    await buyerAgent
      .post("/api/affiliate/referrals/capture")
      .send({ code: "RETURNART5", landingPage: "/product/refund-affiliate-work" });
    await buyerAgent.post("/api/cart/items").send({ artworkId: String(artwork._id), quantity: 1 });
    const checkout = await buyerAgent.post("/api/checkout").send({
      shippingAddress: {
        fullName: "Return Buyer",
        line1: "14 Return Street",
        city: "Lahore",
        province: "Punjab",
        country: "Pakistan",
        phone: "+923001112244",
      },
      method: "card",
      idempotencyKey: "66353f24-081b-4ae3-92f1-39e60e485314",
    });
    const { order, payment } = checkout.body.data.orders[0];
    await buyerAgent
      .post(`/api/order-payments/${payment.id}/confirm-demo`)
      .send({ outcome: "success" });
    for (const status of [
      "seller_confirmed",
      "preparing",
      "ready_for_pickup",
      "shipped",
      "delivered",
    ])
      expect(
        (await sellerAgent.patch(`/api/orders/${order.id}/status`).send({ status })).status,
      ).toBe(200);
    for (const status of ["return_requested", "returned", "refunded"])
      expect(
        (await buyerAgent.patch(`/api/orders/${order.id}/status`).send({ status })).status,
      ).toBe(200);
    const commission = await AffiliateCommissionModel.findOne({ orderId: order.id }).lean();
    expect(commission?.status).toBe("rejected");
    expect(commission?.rejectionReason).toContain("returned");
  });
});

const password = "ValidPass!123";

function registration(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Test Collector",
    email: `person-${Math.random().toString(36).slice(2)}@example.com`,
    phone: `+923${Math.floor(100000000 + Math.random() * 899999999)}`,
    password,
    role: "buyer",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    termsAccepted: true,
    privacyAccepted: true,
    ...overrides,
  };
}

async function registerAndVerify(agent: Agent, overrides: Record<string, unknown> = {}) {
  const payload = registration(overrides);
  const registered = await agent.post("/api/auth/register").send(payload);
  expect(registered.status).toBe(201);
  return { payload, user: registered.body.data };
}

async function directUser(
  role: "artist" | "buyer" | "gallery" | "gallery_staff" | "admin",
  email: string,
) {
  return UserModel.create({
    fullName: `${role} fixture`,
    email,
    emailNormalized: email,
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

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return agent;
}

async function activeSubscription(
  userId: unknown,
  planId: "free" | "professional" | "gallery" = "free",
) {
  const plan = await SubscriptionPlanModel.findOne({ planId }).lean();
  return SubscriptionModel.create({
    userId,
    planId,
    billingCycle: planId === "free" ? "free" : "monthly",
    status: "active",
    price: plan!.monthlyPrice,
    commissionRate: plan!.commissionRate,
    listingLimit: plan!.listingLimit,
    currency: "PKR",
    startedAt: new Date(),
    currentPeriodStart: new Date(),
    featuresSnapshot: plan!.permissions,
  });
}

async function storeFor(owner: { _id: unknown; role: string }, slug: string) {
  return StoreModel.create({
    ownerId: owner._id,
    ownerType: owner.role,
    name: `${slug} studio`,
    slug,
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    status: "active",
    isPublished: true,
    verificationStatus: "approved",
  });
}

async function artworkFor(storeId: unknown, artistId: unknown, slug: string, status = "published") {
  return ArtworkModel.create({
    storeId,
    artistId,
    title: slug.replaceAll("-", " "),
    slug,
    description: "A database-backed test artwork.",
    category: "Abstract",
    medium: "Acrylic",
    style: "Modern",
    yearCreated: 2026,
    artworkType: "original",
    price: 100_000,
    currency: "PKR",
    width: 60,
    height: 80,
    weight: 2,
    weightUnit: "kg",
    orientation: "portrait",
    isFramed: true,
    isFragile: true,
    quantity: 1,
    images: [{ url: "/test-art.jpg", alt: "Test artwork", isPrimary: true }],
    pickupCity: "Lahore",
    domesticShipping: true,
    status,
    moderationStatus: status === "published" ? "approved" : "not_submitted",
  });
}

describe("authentication and sessions", () => {
  it("registers an active account, persists a cookie session, and never returns a password hash", async () => {
    const agent = request.agent(app);
    const { payload, user } = await registerAndVerify(agent);
    expect(user).not.toHaveProperty("passwordHash");
    expect(user.email).toBe(String(payload.email).toLowerCase());
    const session = await agent.get("/api/auth/session");
    expect(session.body.data.user.emailVerified).toBe(true);
    expect(await AuthSessionModel.countDocuments()).toBe(1);
    const stored = await UserModel.findOne({ emailNormalized: payload.email }).select(
      "+passwordHash",
    );
    expect(stored!.passwordHash).not.toBe(password);
    expect(await bcrypt.compare(password, stored!.passwordHash)).toBe(true);
  });

  it("rejects duplicate accounts and incorrect passwords with safe errors", async () => {
    const agent = request.agent(app);
    const payload = registration({ email: "duplicate@example.com" });
    expect((await agent.post("/api/auth/register").send(payload)).status).toBe(201);
    const duplicate = await request(app)
      .post("/api/auth/register")
      .send({ ...payload, phone: "+923009999998" });
    expect(duplicate.status).toBe(409);
    const badLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: "WrongPass!123" });
    expect(badLogin.status).toBe(401);
    expect(JSON.stringify(badLogin.body)).not.toMatch(/mongo|stack|passwordHash/i);
  });

  it("validates payload for email password-recovery endpoints", async () => {
    expect((await request(app).post("/api/auth/forgot-password").send({})).status).toBe(422);
    expect((await request(app).post("/api/auth/reset-password").send({})).status).toBe(422);
  });

  it("blocks suspended accounts", async () => {
    const user = await directUser("buyer", "suspended@example.com");
    user.status = "suspended";
    await user.save();
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("persists a clean notification-preference contract", async () => {
    const agent = request.agent(app);
    await registerAndVerify(agent, { email: "preferences@example.com" });
    const defaults = await agent.get("/api/notification-preferences");
    expect(defaults.status).toBe(200);
    expect(defaults.body.data).toEqual({
      email: true,
      inApp: true,
      marketing: false,
      orderUpdates: true,
      messageUpdates: true,
    });
    const updated = await agent
      .patch("/api/notification-preferences")
      .send({ marketing: true, email: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ marketing: true, email: false });
    expect(updated.body.data).not.toHaveProperty("_id");
    expect(updated.body.data).not.toHaveProperty("userId");
  });

  it("upgrades a buyer in place and preserves buyer data and the active session", async () => {
    const agent = request.agent(app);
    const { user } = await registerAndVerify(agent, {
      email: "collector-to-seller@example.com",
    });
    const otherSeller = await directUser("artist", "conversion-catalog-seller@example.com");
    await activeSubscription(otherSeller._id);
    const otherStore = await storeFor(otherSeller, "conversion-catalog-store");
    const artwork = await artworkFor(otherStore._id, otherSeller._id, "conversion-saved-artwork");
    expect((await agent.post(`/api/wishlist/${String(artwork._id)}`).send({})).status).toBe(201);
    expect(
      (await agent.post("/api/cart/items").send({ artworkId: String(artwork._id), quantity: 1 }))
        .status,
    ).toBe(201);
    expect(
      (await agent.post("/api/plans/select").send({ planId: "free", billingCycle: "free" })).status,
    ).toBe(200);

    const converted = await agent.post("/api/auth/become-seller").send({});
    expect(converted.status).toBe(200);
    expect(converted.body.data.user).toMatchObject({
      id: user.id,
      role: "artist",
      sellerType: "artist",
    });
    expect(converted.body.data.destination).toBe("/artist/onboarding");
    expect((await agent.get("/api/auth/session")).body.data.user.id).toBe(user.id);
    expect((await agent.get("/api/wishlist")).body.data).toHaveLength(1);
    expect((await agent.get("/api/cart")).body.data.items).toHaveLength(1);
    expect(
      await UserModel.countDocuments({ emailNormalized: "collector-to-seller@example.com" }),
    ).toBe(1);
    expect(await ArtistProfileModel.countDocuments({ userId: user.id })).toBe(1);
    expect(await SubscriptionModel.countDocuments({ userId: user.id })).toBe(1);

    const retried = await agent.post("/api/auth/become-seller").send({});
    expect(retried.status).toBe(200);
    expect(await ArtistProfileModel.countDocuments({ userId: user.id })).toBe(1);
    expect(await SubscriptionModel.countDocuments({ userId: user.id })).toBe(1);
  });
});

describe("plans, payments, and listing limits", () => {
  it("reports taken store URLs before onboarding and rechecks them on creation", async () => {
    const owner = await directUser("artist", "store-url-owner@example.com");
    const otherSeller = await directUser("artist", "store-url-other@example.com");
    await activeSubscription(owner._id);
    await activeSubscription(otherSeller._id);
    await storeFor(owner, "art");
    const ownerAgent = await login(owner.email);
    const otherAgent = await login(otherSeller.email);

    expect((await ownerAgent.get("/api/stores/slug-available/art")).body.data.available).toBe(true);
    expect((await otherAgent.get("/api/stores/slug-available/art")).body.data.available).toBe(
      false,
    );

    const attemptedCreation = await otherAgent.post("/api/stores/onboarding/complete").send({
      data: {
        displayName: "Another Artist",
        storeName: "Another Studio",
        slug: "art",
        shortBio: "An independent artist creating original contemporary artwork.",
        city: "Lahore",
      },
    });
    expect(attemptedCreation.status).toBe(409);
    expect(attemptedCreation.body.error.code).toBe("SLUG_TAKEN");
  });

  it("creates a Free store while safely ignoring stale plan-restricted onboarding options", async () => {
    const agent = request.agent(app);
    await registerAndVerify(agent, {
      role: "artist",
      email: "free-onboarding@example.com",
      planId: "free",
      billingCycle: "free",
    });

    const completed = await agent.post("/api/stores/onboarding/complete").send({
      data: {
        displayName: "Free Artist",
        storeName: "Free Artist Studio",
        slug: "free-artist-studio",
        shortBio: "An independent artist creating original contemporary artwork.",
        city: "Lahore",
        domesticShipping: true,
        internationalInterest: true,
        addArtwork: false,
      },
    });

    expect(completed.status).toBe(201);
    expect(completed.body.data.store).toMatchObject({
      slug: "free-artist-studio",
      internationalShipping: false,
    });
    expect(completed.body.data.ignoredFeatures).toEqual(["international-tools"]);
    expect(await StoreModel.countDocuments({ slug: "free-artist-studio" })).toBe(1);
  });

  it("activates Free at signup and keeps a paid plan pending until payment succeeds", async () => {
    const freeAgent = request.agent(app);
    const free = registration({
      role: "artist",
      email: "free@example.com",
      planId: "free",
      billingCycle: "free",
    });
    expect((await freeAgent.post("/api/auth/register").send(free)).status).toBe(201);
    expect((await SubscriptionModel.findOne({ planId: "free" }))!.status).toBe("active");

    const paidAgent = request.agent(app);
    const paid = registration({
      role: "artist",
      email: "paid@example.com",
      phone: "+923001111111",
      planId: "professional",
      billingCycle: "annual",
    });
    await paidAgent.post("/api/auth/register").send(paid);
    expect((await SubscriptionModel.findOne({ planId: "professional" }))!.status).toBe("pending");
    const initiation = await paidAgent.post("/api/subscriptions/payment").send({ method: "card" });
    expect(initiation.status).toBe(201);
    expect((await SubscriptionModel.findOne({ planId: "professional" }))!.status).toBe("pending");
    const confirmation = await paidAgent
      .post(`/api/subscriptions/payment/${initiation.body.data.id}/confirm-demo`)
      .send({ outcome: "success" });
    expect(confirmation.status).toBe(200);
    expect((await SubscriptionModel.findOne({ planId: "professional" }))!.status).toBe("active");
    expect(await InvoiceModel.countDocuments({ userId: initiation.body.data.userId })).toBe(1);
  });

  it("keeps a signed-in seller's Professional upgrade selected across a page reload", async () => {
    const seller = await directUser("artist", "upgrade-session@example.com");
    await activeSubscription(seller._id, "free");
    const agent = await login(seller.email);

    const selected = await agent
      .post("/api/plans/select")
      .send({ planId: "professional", billingCycle: "annual" });
    expect(selected.status).toBe(200);

    const session = await agent.get("/api/auth/session");
    expect(session.status).toBe(200);
    expect(session.body.data.subscription).toMatchObject({
      planId: "free",
      status: "Active",
    });
    expect(session.body.data.planSelection).toMatchObject({
      planId: "professional",
      billingCycle: "annual",
      price: 500,
    });
  });

  it("routes a seller with pending Professional payment straight back to checkout on login", async () => {
    const seller = await directUser("artist", "pending-login@example.com");
    const plan = await SubscriptionPlanModel.findOne({ planId: "professional" }).lean();
    await SubscriptionModel.create({
      userId: seller._id,
      planId: "professional",
      billingCycle: "annual",
      status: "pending",
      price: plan!.annualPrice,
      commissionRate: plan!.commissionRate,
      listingLimit: plan!.listingLimit,
      currency: "PKR",
      startedAt: new Date(),
      currentPeriodStart: new Date(),
      featuresSnapshot: plan!.permissions,
    });

    const agent = request.agent(app);
    const signedIn = await agent.post("/api/auth/login").send({ email: seller.email, password });
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.data.destination).toBe("/artist/checkout");

    const session = await agent.get("/api/auth/session");
    expect(session.body.data.destination).toBe("/artist/checkout");
    expect(session.body.data.subscription).toMatchObject({
      planId: "professional",
      billingCycle: "annual",
      status: "Pending Payment",
    });
  });

  it("calculates seller shipping estimates from an active database rule", async () => {
    const seller = await directUser("artist", "shipping-estimate@example.com");
    await activeSubscription(seller._id);
    await ShippingRuleModel.create({
      name: "Islamabad fixture",
      city: "Islamabad",
      baseCost: 1000,
      perKgCost: 200,
      fragileSurcharge: 300,
      framingSurcharge: 150,
      isActive: true,
    });
    const agent = await login(seller.email);
    const response = await agent.post("/api/shipping/estimate").send({
      city: "Islamabad",
      province: "Islamabad Capital Territory",
      weightKg: 3,
      fragile: true,
      framed: true,
      packagingType: "art_box",
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      courierCost: 2050,
      packagingCost: 500,
      total: 2550,
      ruleName: "Islamabad fixture",
      isCourierQuote: false,
    });
  });

  it("publishes artwork with a collision-safe URL generated by the server", async () => {
    const seller = await directUser("artist", "publish-artwork@example.com");
    await activeSubscription(seller._id);
    const store = await storeFor(seller, "publish-artwork-store");
    const agent = await login(seller.email);
    const response = await agent.post("/api/artworks").send({
      storeId: String(store._id),
      title: "🎨🎨",
      description: "An original artwork ready for moderation.",
      category: "Abstract",
      medium: "Acrylic",
      style: "Contemporary",
      subject: "Colour",
      year: 2026,
      kind: "Original",
      price: 25_000,
      dimensions: "20 x 30 x 2 cm",
      weightKg: 1,
      framed: false,
      orientation: "Portrait",
      images: [{ url: "/test-art.jpg", alt: "Colour study", isPrimary: true }],
      status: "Pending Review",
      quantity: 1,
      domesticShipping: true,
      internationalShipping: false,
      certificate: true,
      tags: ["colour"],
      customOrders: false,
    });
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("Pending Review");
    expect(response.body.data.slug).toMatch(/^artwork-[a-z0-9]+-[a-f0-9]{6}$/);
  });

  it("rejects invalid plans and billing cycles", async () => {
    expect(
      (
        await request(app)
          .post("/api/plans/select")
          .send({ planId: "enterprise", billingCycle: "monthly" })
      ).status,
    ).toBe(422);
    const invalidCycle = await request(app)
      .post("/api/plans/select")
      .send({ planId: "free", billingCycle: "monthly" });
    expect(invalidCycle.status).toBe(422);
    expect(invalidCycle.body.error.code).toBe("INVALID_BILLING_CYCLE");
  });

  it("allows five Free listings, blocks the sixth, and honors the Professional limit", async () => {
    const agent = request.agent(app);
    const { user } = await registerAndVerify(agent, {
      role: "artist",
      email: "limit@example.com",
      planId: "free",
      billingCycle: "free",
    });
    const createdStore = await agent
      .post("/api/stores")
      .send({ name: "Limit Studio", slug: "limit-studio", city: "Lahore", status: "active" });
    expect(createdStore.status).toBe(201);
    for (let index = 1; index <= 5; index += 1) {
      const response = await agent.post("/api/artworks").send({
        storeId: createdStore.body.data.id,
        title: `Free work ${index}`,
        description: "Original work",
        category: "Abstract",
        medium: "Acrylic",
        style: "Modern",
        subject: "Form",
        year: 2026,
        kind: "Original",
        price: 10_000 + index,
        dimensions: "20 x 30",
        weightKg: 1,
        framed: false,
        orientation: "Portrait",
        images: [],
        status: "Pending Review",
        quantity: 1,
        domesticShipping: true,
        internationalShipping: false,
        certificate: true,
        tags: [],
        customOrders: false,
      });
      expect(response.status).toBe(201);
    }
    const sixth = await agent.post("/api/artworks").send({
      storeId: createdStore.body.data.id,
      title: "Sixth work",
      description: "Original work",
      category: "Abstract",
      medium: "Acrylic",
      style: "Modern",
      subject: "Form",
      year: 2026,
      kind: "Original",
      price: 20_000,
      dimensions: "20 x 30",
      weightKg: 1,
      framed: false,
      orientation: "Portrait",
      images: [],
      status: "Pending Review",
      quantity: 1,
      domesticShipping: true,
      internationalShipping: false,
      certificate: true,
      tags: [],
      customOrders: false,
    });
    expect(sixth.status).toBe(409);
    expect(sixth.body.error.code).toBe("LISTING_LIMIT_REACHED");

    const professional = await SubscriptionPlanModel.findOne({ planId: "professional" }).lean();
    await SubscriptionModel.updateOne(
      { userId: user.id },
      {
        $set: {
          planId: "professional",
          listingLimit: 50,
          featuresSnapshot: professional!.permissions,
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60_000),
        },
      },
    );
    await ListingQuotaModel.updateOne({ userId: user.id }, { $set: { activeListings: 49 } });
    await expect(reserveListingSlot(user.id)).resolves.toBeTruthy();
    await expect(reserveListingSlot(user.id)).rejects.toMatchObject({
      code: "LISTING_LIMIT_REACHED",
    });
  });
});

describe("object authorization and gallery permissions", () => {
  it("prevents cross-seller edits, buyer payout reads, and seller admin access", async () => {
    const owner = await directUser("artist", "owner@example.com");
    const intruder = await directUser("artist", "intruder@example.com");
    const buyer = await directUser("buyer", "buyer-auth@example.com");
    await Promise.all([activeSubscription(owner._id), activeSubscription(intruder._id)]);
    const store = await storeFor(owner, "owner-studio");
    const artwork = await artworkFor(store._id, owner._id, "owner-work", "draft");
    const intruderAgent = await login(intruder.email);
    expect(
      (await intruderAgent.patch(`/api/artworks/${artwork._id}`).send({ title: "Stolen edit" }))
        .status,
    ).toBe(404);
    const buyerAgent = await login(buyer.email);
    expect((await buyerAgent.get("/api/payouts")).status).toBe(403);
    expect((await intruderAgent.get("/api/admin/dashboard")).status).toBe(403);
  });

  it("enforces assigned gallery staff permissions", async () => {
    const galleryOwner = await directUser("gallery", "gallery-owner@example.com");
    const staffUser = await directUser("gallery_staff", "gallery-staff@example.com");
    await activeSubscription(galleryOwner._id, "gallery");
    const profile = await GalleryProfileModel.create({
      userId: galleryOwner._id,
      galleryName: "Test Gallery",
      city: "Lahore",
      country: "Pakistan",
      onboardingCompleted: true,
    });
    await GalleryStaffModel.create({
      galleryId: profile._id,
      userId: staffUser._id,
      role: "Inventory",
      permissions: ["manage_inventory"],
      status: "active",
    });
    const agent = await login(staffUser.email);
    const denied = await agent.get("/api/gallery/artists");
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("GALLERY_PERMISSION_REQUIRED");
  });
});

describe("orders, reviews, promotions, and security", () => {
  it("lets seller and admin accounts collect artwork while still blocking self-purchases", async () => {
    const seller = await directUser("artist", "role-purchase-seller@example.com");
    await activeSubscription(seller._id, "free");
    const store = await storeFor(seller, "role-purchase-store");
    const sellerArtwork = await artworkFor(store._id, seller._id, "role-purchase-seller-work");
    const adminArtwork = await artworkFor(store._id, seller._id, "role-purchase-admin-work");
    const ownArtwork = await artworkFor(store._id, seller._id, "role-purchase-own-work");

    const artistCollector = await directUser("artist", "artist-collector@example.com");
    const adminCollector = await directUser("admin", "admin-collector@example.com");

    for (const [collector, artwork] of [
      [artistCollector, sellerArtwork],
      [adminCollector, adminArtwork],
    ] as const) {
      const agent = await login(collector.email);
      expect(
        (await agent.post("/api/cart/items").send({ artworkId: String(artwork._id), quantity: 1 }))
          .status,
      ).toBe(201);
      expect((await agent.get("/api/cart")).status).toBe(200);
      const checkout = await agent.post("/api/checkout").send({
        shippingAddress: {
          fullName: collector.fullName,
          line1: "Collector Street 1",
          city: "Lahore",
          province: "Punjab",
          country: "Pakistan",
          phone: "+923001234567",
        },
        method: "jazzcash",
      });
      expect(checkout.status).toBe(201);
      expect((await agent.get("/api/orders?view=buyer")).body.data).toHaveLength(1);
    }

    const sellerAgent = await login(seller.email);
    const ownPurchase = await sellerAgent
      .post("/api/cart/items")
      .send({ artworkId: String(ownArtwork._id), quantity: 1 });
    expect(ownPurchase.status).toBe(422);
    expect(ownPurchase.body.error.code).toBe("SELF_PURCHASE_NOT_ALLOWED");
  });

  it("recalculates checkout totals, blocks invalid transitions, creates payout, and gates reviews", async () => {
    const seller = await directUser("artist", "order-seller@example.com");
    const buyer = await directUser("buyer", "order-buyer@example.com");
    await activeSubscription(seller._id, "free");
    const store = await storeFor(seller, "order-studio");
    const artwork = await artworkFor(store._id, seller._id, "order-work");
    const buyerAgent = await login(buyer.email);
    expect(
      (
        await buyerAgent
          .post("/api/cart/items")
          .send({ artworkId: String(artwork._id), quantity: 1 })
      ).status,
    ).toBe(201);
    const idempotencyKey = "00000000-0000-4000-8000-000000000001";
    const checkoutInput = {
      shippingAddress: {
        fullName: "Order Buyer",
        line1: "Street 1",
        city: "Lahore",
        province: "Punjab",
        country: "Pakistan",
        phone: "+923001234567",
      },
      method: "card",
      idempotencyKey,
    };
    const checkout = await buyerAgent.post("/api/checkout").send(checkoutInput);
    expect(checkout.status).toBe(201);
    const created = checkout.body.data.orders[0];
    expect(created.order.subtotal).toBe(100_000);
    expect(created.order.total).toBe(100_000);
    const retriedCheckout = await buyerAgent.post("/api/checkout").send(checkoutInput);
    expect(retriedCheckout.status).toBe(200);
    expect(retriedCheckout.body.data.orders[0].order.id).toBe(created.order.id);
    expect(
      await OrderModel.countDocuments({ buyerId: buyer._id, checkoutKey: idempotencyKey }),
    ).toBe(1);
    await buyerAgent
      .post(`/api/order-payments/${created.payment.id}/confirm-demo`)
      .send({ outcome: "success" });
    expect((await ArtworkModel.findById(artwork._id))!.status).toBe("sold");
    const invalid = await buyerAgent
      .patch(`/api/orders/${created.order.id}/status`)
      .send({ status: "completed" });
    expect(invalid.status).toBe(409);
    const earlyReview = await buyerAgent.post("/api/reviews").send({
      orderId: created.order.id,
      artworkId: String(artwork._id),
      rating: 5,
      title: "Too early",
      comment: "Not completed",
    });
    expect(earlyReview.status).toBe(403);
    await OrderModel.updateOne(
      { _id: created.order.id },
      { $set: { status: "inspection_period" } },
    );
    expect(
      (
        await buyerAgent
          .patch(`/api/orders/${created.order.id}/status`)
          .send({ status: "completed" })
      ).status,
    ).toBe(200);
    expect(await PayoutModel.countDocuments({ orderId: created.order.id })).toBe(1);
    expect(
      (
        await buyerAgent.post("/api/reviews").send({
          orderId: created.order.id,
          artworkId: String(artwork._id),
          rating: 5,
          title: "Collected",
          comment: "Arrived safely",
        })
      ).status,
    ).toBe(201);
    expect(await ReviewModel.countDocuments({ orderId: created.order.id })).toBe(1);
  });

  it("stores manual payment proof, prevents duplicates, supports rejection/resubmission, and requires admin approval", async () => {
    const seller = await directUser("gallery", "manual-gallery@example.com");
    const buyer = await directUser("buyer", "manual-buyer@example.com");
    const admin = await directUser("admin", "manual-admin@example.com");
    await activeSubscription(seller._id, "gallery");
    const store = await storeFor(seller, "manual-gallery");
    const artwork = await artworkFor(store._id, seller._id, "manual-payment-work");
    const buyerAgent = await login(buyer.email);
    const adminAgent = await login(admin.email);
    await buyerAgent.post("/api/cart/items").send({ artworkId: String(artwork._id), quantity: 1 });
    const checkout = await buyerAgent.post("/api/checkout").send({
      shippingAddress: {
        fullName: "Manual Buyer",
        line1: "Street 2",
        city: "Lahore",
        province: "Punjab",
        country: "Pakistan",
        phone: "+923001234568",
      },
      method: "jazzcash",
    });
    expect(checkout.status).toBe(201);
    const created = checkout.body.data.orders[0];
    expect(created.paymentInstructions).toMatchObject({
      label: "JazzCash",
      accountTitle: "ArtDera Test",
      accountNumber: "03001234567",
      orderId: created.order.orderNumber,
      amount: created.payment.amount,
    });
    expect(created.order.total).toBe(100_000);
    expect(created.payment.amount).toBe(100_000);

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ]);
    const uploadProof = (filename: string) =>
      buyerAgent
        .post("/api/uploads")
        .field("purpose", "payment_proof")
        .field("access", "private")
        .attach("file", png, { filename, contentType: "image/png" });
    const firstUpload = await uploadProof("jazzcash-proof-1.png");
    expect(firstUpload.status).toBe(201);
    const submitted = await buyerAgent
      .post(`/api/order-payments/${created.payment.id}/proof`)
      .send({
        fullName: "Manual Buyer",
        mobileNumber: "03009999999",
        transactionId: "JC-TEST-1001",
        screenshotId: firstUpload.body.data.id,
        note: "Paid from my JazzCash wallet",
      });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data).toMatchObject({
      orderId: created.order.orderNumber,
      paymentStatus: "Pending Verification",
      orderStatus: "Awaiting Payment Approval",
    });
    expect((await PaymentModel.findById(created.payment.id))!.status).toBe("pending_verification");
    expect((await OrderModel.findById(created.order.id))!.status).toBe("awaiting_payment_approval");

    const duplicateUpload = await uploadProof("jazzcash-proof-duplicate.png");
    const duplicate = await buyerAgent
      .post(`/api/order-payments/${created.payment.id}/proof`)
      .send({
        fullName: "Manual Buyer",
        mobileNumber: "03009999999",
        transactionId: "JC-TEST-1002",
        screenshotId: duplicateUpload.body.data.id,
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("PAYMENT_PROOF_ALREADY_SUBMITTED");

    const queue = await adminAgent.get("/api/admin/payment-proofs");
    expect(queue.status).toBe(200);
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.data[0]).toMatchObject({
      customerName: "Manual Buyer",
      orderId: created.order.orderNumber,
      method: "jazzcash",
      transactionId: "JC-TEST-1001",
      status: "pending_verification",
    });
    expect((await adminAgent.get(queue.body.data[0].screenshotUrl)).status).toBe(200);

    const rejected = await adminAgent
      .patch(`/api/admin/payment-proofs/${queue.body.data[0].id}`)
      .send({
        action: "reject",
        reason: "The transaction details are not legible.",
      });
    expect(rejected.status).toBe(200);
    expect((await PaymentModel.findById(created.payment.id))!.status).toBe("rejected");
    const retryDetails = await buyerAgent.get(`/api/order-payments/${created.payment.id}/manual`);
    expect(retryDetails.body.data.canSubmit).toBe(true);
    expect(retryDetails.body.data.latestProof.rejectionReason).toBe(
      "The transaction details are not legible.",
    );

    const resubmitted = await buyerAgent
      .post(`/api/order-payments/${created.payment.id}/proof`)
      .send({
        fullName: "Manual Buyer",
        mobileNumber: "03009999999",
        transactionId: "JC-TEST-1001",
        screenshotId: duplicateUpload.body.data.id,
        note: "Clearer screenshot attached",
      });
    expect(resubmitted.status).toBe(201);
    expect(await PaymentProofModel.countDocuments({ paymentId: created.payment.id })).toBe(2);
    const secondProofId = resubmitted.body.data.proof.id;
    const approved = await adminAgent.patch(`/api/admin/payment-proofs/${secondProofId}`).send({
      action: "approve",
    });
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({
      paymentStatus: "Paid",
      orderStatus: "Payment Confirmed",
    });
    expect((await PaymentModel.findById(created.payment.id))!.status).toBe("successful");
    const approvedOrder = await OrderModel.findById(created.order.id);
    expect(approvedOrder!.paymentStatus).toBe("paid");
    expect(approvedOrder!.status).toBe("payment_confirmed");
    expect((await ArtworkModel.findById(artwork._id))!.status).toBe("sold");
    expect(
      (
        await adminAgent.patch(`/api/admin/payment-proofs/${secondProofId}`).send({
          action: "approve",
        })
      ).status,
    ).toBe(409);
  });

  it("activates a paid seller subscription only after manual proof is approved", async () => {
    const artist = await directUser("artist", "manual-subscription@example.com");
    const admin = await directUser("admin", "manual-subscription-admin@example.com");
    await activeSubscription(artist._id, "professional");
    const artistAgent = await login(artist.email);
    const adminAgent = await login(admin.email);

    const initiated = await artistAgent.post("/api/subscriptions/payment").send({
      planId: "professional",
      billingCycle: "annual",
      method: "easypaisa",
    });
    expect(initiated.status).toBe(201);
    expect(initiated.body.data.paymentInstructions).toMatchObject({
      label: "Easypaisa",
      accountTitle: "ArtDera Test",
      accountNumber: "03111234567",
      amount: 500,
    });

    const paymentId = initiated.body.data.id;
    const details = await artistAgent.get(`/api/payments/${paymentId}/manual`);
    expect(details.status).toBe(200);
    expect(details.body.data).toMatchObject({
      paymentType: "subscription",
      canSubmit: true,
      paymentInstructions: {
        referenceLabel: "professional annual subscription",
        amount: 500,
      },
    });

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ]);
    const upload = await artistAgent
      .post("/api/uploads")
      .field("purpose", "payment_proof")
      .field("access", "private")
      .attach("file", png, { filename: "subscription-proof.png", contentType: "image/png" });
    expect(upload.status).toBe(201);

    const submitted = await artistAgent.post(`/api/payments/${paymentId}/proof`).send({
      fullName: "Manual Subscription Artist",
      mobileNumber: "03119999999",
      transactionId: "EP-SUBSCRIPTION-1001",
      screenshotId: upload.body.data.id,
    });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.proof.paymentType).toBe("subscription");
    expect((await PaymentModel.findById(paymentId))!.status).toBe("pending_verification");
    expect((await SubscriptionModel.findOne({ userId: artist._id }))!.status).toBe(
      "payment_review",
    );

    const proofId = submitted.body.data.proof.id;
    const approved = await adminAgent.patch(`/api/admin/payment-proofs/${proofId}`).send({
      action: "approve",
    });
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({
      paymentStatus: "Paid",
      purchaseStatus: "active",
    });
    expect((await PaymentModel.findById(paymentId))!.status).toBe("successful");
    expect(await SubscriptionModel.findOne({ userId: artist._id })).toMatchObject({
      planId: "professional",
      billingCycle: "annual",
      status: "active",
      price: 500,
    });
    expect(await InvoiceModel.findOne({ paymentId })).toMatchObject({
      status: "paid",
      total: 500,
    });
  });

  it("activates a promotion only after its manual payment proof is approved", async () => {
    const artist = await directUser("artist", "manual-promotion@example.com");
    const admin = await directUser("admin", "manual-promotion-admin@example.com");
    await activeSubscription(artist._id, "free");
    const store = await storeFor(artist, "manual-promotion-studio");
    const artwork = await artworkFor(store._id, artist._id, "manual-promotion-work");
    const artistAgent = await login(artist.email);
    const adminAgent = await login(admin.email);

    const initiated = await artistAgent.post("/api/promotions").send({
      artworkId: String(artwork._id),
      promotionType: "boost_3",
      requestedPrice: 299,
      placement: "Three-day boost",
      method: "jazzcash",
    });
    expect(initiated.status).toBe(201);
    expect(initiated.body.data.payment.paymentInstructions).toMatchObject({
      label: "JazzCash",
      amount: 299,
      referenceLabel: "Three-day boost promotion",
    });

    const paymentId = initiated.body.data.payment.id;
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ]);
    const upload = await artistAgent
      .post("/api/uploads")
      .field("purpose", "payment_proof")
      .field("access", "private")
      .attach("file", png, { filename: "promotion-proof.png", contentType: "image/png" });
    const submitted = await artistAgent.post(`/api/payments/${paymentId}/proof`).send({
      fullName: "Manual Promotion Artist",
      mobileNumber: "03009999998",
      transactionId: "JC-PROMOTION-1001",
      screenshotId: upload.body.data.id,
    });
    expect(submitted.status).toBe(201);

    const approved = await adminAgent
      .patch(`/api/admin/payment-proofs/${submitted.body.data.proof.id}`)
      .send({ action: "approve" });
    expect(approved.status).toBe(200);
    expect((await PaymentModel.findById(paymentId))!.status).toBe("successful");
    expect(await PromotionModel.findById(initiated.body.data.promotion.id)).toMatchObject({
      status: "active",
    });
    expect(await ArtworkModel.findById(artwork._id)).toMatchObject({
      isSponsored: true,
    });
  });

  it("rejects sold artworks and keeps sponsored interleaving at or below twenty percent", async () => {
    const seller = await directUser("artist", "sold-seller@example.com");
    const buyer = await directUser("buyer", "sold-buyer@example.com");
    await activeSubscription(seller._id);
    const store = await storeFor(seller, "sold-studio");
    const sold = await artworkFor(store._id, seller._id, "sold-work", "sold");
    const agent = await login(buyer.email);
    expect(
      (await agent.post("/api/cart/items").send({ artworkId: String(sold._id), quantity: 1 }))
        .status,
    ).toBe(409);
    const organic = Array.from({ length: 20 }, (_, id) => ({ id: `o${id}` }));
    const sponsored = Array.from({ length: 20 }, (_, id) => ({ id: `s${id}` }));
    const merged = mergeSponsoredResults(organic, sponsored, 20);
    expect(merged).toHaveLength(20);
    expect(merged.filter((item) => item.id.startsWith("s")).length).toBeLessThanOrEqual(4);
  });

  it("rejects NoSQL operators and invalid object IDs without exposing internals", async () => {
    const injection = await request(app)
      .post("/api/auth/login")
      .send({ email: { $ne: null }, password: "anything" });
    expect(injection.status).toBe(422);
    expect(injection.body.error.code).toBe("INVALID_PAYLOAD");
    const user = await directUser("artist", "invalid-id@example.com");
    await activeSubscription(user._id);
    const agent = await login(user.email);
    const invalidId = await agent
      .patch("/api/artworks/not-a-valid-object-id")
      .send({ title: "No" });
    expect(invalidId.status).toBe(422);
    expect(JSON.stringify(invalidId.body)).not.toMatch(/mongoose|mongodb|stack|server\\/i);
  });

  it("rate limits repeated authentication abuse", async () => {
    const isolated = (await import("../server/app")).createApp();
    let response: request.Response | undefined;
    for (let index = 0; index < 21; index += 1) {
      response = await request(isolated)
        .post("/api/auth/login")
        .send({ email: "invalid", password: "x" });
    }
    expect(response!.status).toBe(429);
    expect(response!.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("admin directories and international shipping quotes", () => {
  it("returns role-filtered users and complete dashboard metrics", async () => {
    const admin = await directUser("admin", "directory-admin@example.com");
    const artist = await directUser("artist", "filtered-active-artist@example.com");
    const suspendedArtist = await directUser("artist", "filtered-suspended-artist@example.com");
    const buyer = await directUser("buyer", "filtered-buyer@example.com");
    suspendedArtist.status = "suspended";
    await suspendedArtist.save();

    const store = await storeFor(artist, "directory-metrics-store");
    await Promise.all([
      artworkFor(store._id, artist._id, "published-directory-work"),
      artworkFor(store._id, artist._id, "draft-directory-work", "draft"),
      VerificationRequestModel.create({
        userId: artist._id,
        storeId: store._id,
        type: "artist",
        status: "pending",
      }),
      VerificationRequestModel.create({
        userId: artist._id,
        storeId: store._id,
        type: "artist",
        status: "approved",
      }),
      DisputeModel.create({ orderId: store._id, openedBy: buyer._id, reason: "Open dispute" }),
      DisputeModel.create({
        orderId: artist._id,
        openedBy: buyer._id,
        reason: "Closed dispute",
        status: "closed",
      }),
    ]);

    const agent = await login(admin.email);
    const artists = await agent.get("/api/admin/resources/users?role=artist&page=1&limit=50");
    expect(artists.status).toBe(200);
    expect(artists.body.data.total).toBe(2);
    expect(artists.body.data.items.every((item: { role: string }) => item.role === "artist")).toBe(
      true,
    );

    const searched = await agent.get(
      "/api/admin/resources/users?role=artist&q=filtered-active&page=1&limit=50",
    );
    expect(searched.body.data.total).toBe(1);
    expect(searched.body.data.items[0].email).toBe("filtered-active-artist@example.com");

    const dashboard = await agent.get("/api/admin/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.metrics).toMatchObject({
      totalUsers: 4,
      artists: 1,
      buyers: 1,
      artworks: 2,
      publishedArtworks: 1,
      pendingVerification: 1,
      openDisputes: 1,
    });
  });

  it("connects quote submission, admin pricing, buyer acceptance, and checkout", async () => {
    const seller = await directUser("artist", "quote-seller@example.com");
    const buyer = await directUser("buyer", "quote-buyer@example.com");
    const admin = await directUser("admin", "quote-admin@example.com");
    await activeSubscription(seller._id);
    const store = await storeFor(seller, "international-quote-store");
    const artwork = await artworkFor(store._id, seller._id, "international-quote-work");
    const buyerAgent = await login(buyer.email);
    const adminAgent = await login(admin.email);

    const requested = await buyerAgent.post("/api/shipping-quotes").send({
      artworkId: String(artwork._id),
      quantity: 1,
      shippingAddress: {
        fullName: "International Buyer",
        line1: "10 Market Street",
        city: "London",
        province: "Greater London",
        postalCode: "SW1A 1AA",
        country: "United Kingdom",
        phone: "+442071234567",
      },
    });
    expect(requested.status).toBe(201);
    const quoteId = requested.body.data.quoteId as string;

    const adminQueue = await adminAgent.get("/api/admin/resources/shippingQuotes?page=1&limit=50");
    expect(adminQueue.status).toBe(200);
    expect(adminQueue.body.data.items[0]).toMatchObject({
      id: quoteId,
      status: "new_request",
      province: "Greater London",
    });

    const priced = await adminAgent.patch(`/api/admin/shipping-quotes/${quoteId}`).send({
      status: "quote_provided",
      quotedShippingCost: 25_000,
      quotedPackagingCost: 5_000,
      estimatedDeliveryTime: "10-14 working days",
    });
    expect(priced.status).toBe(200);
    expect(await ShippingQuoteModel.findById(quoteId).lean()).toMatchObject({
      status: "quote_provided",
      quotedShippingCost: 25_000,
      quotedPackagingCost: 5_000,
    });

    const buyerQuotes = await buyerAgent.get("/api/shipping-quotes");
    expect(buyerQuotes.status).toBe(200);
    expect(buyerQuotes.body.data[0]).toMatchObject({
      id: quoteId,
      status: "quote_provided",
      province: "Greater London",
    });

    const accepted = await buyerAgent.patch(`/api/shipping-quotes/${quoteId}/accept`).send({});
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe("accepted");

    const checkout = await buyerAgent.post("/api/checkout").send({
      shippingQuoteId: quoteId,
      shippingAddress: {
        fullName: "International Buyer",
        line1: "10 Market Street",
        city: "London",
        province: "Greater London",
        postalCode: "SW1A 1AA",
        country: "United Kingdom",
        phone: "+442071234567",
      },
      method: "hbl",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });
    expect(checkout.status).toBe(201);
    expect(checkout.body.data.orders[0].order).toMatchObject({
      shipping: 25_000,
      packaging: 5_000,
      total: 130_000,
    });
    expect(await ShippingQuoteModel.findById(quoteId).lean()).toMatchObject({
      status: "awaiting_payment",
    });
  });
});

describe("deployment transport and storage", () => {
  it("allows loopback frontend ports during development without weakening foreign-origin checks", async () => {
    const local = await request(app)
      .post("/api/newsletter")
      .set("Origin", "http://localhost:8081")
      .send({ email: "local-origin@example.com", source: "development-test" });
    expect(local.status).toBe(201);
    expect(local.headers["access-control-allow-origin"]).toBe("http://localhost:8081");

    const lookalike = await request(app)
      .post("/api/newsletter")
      .set("Origin", "http://localhost.attacker.example:8081")
      .send({ email: "lookalike-origin@example.com", source: "development-test" });
    expect(lookalike.status).toBe(403);
    expect(lookalike.body.error.code).toBe("INVALID_ORIGIN");
  });

  it("allows same-origin Vercel mutations and rejects foreign origins", async () => {
    const allowed = await request(app)
      .post("/api/newsletter")
      .set("Host", "preview.example.vercel.app")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://preview.example.vercel.app")
      .send({ email: "same-origin@example.com", source: "deployment-test" });
    expect(allowed.status).toBe(201);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://preview.example.vercel.app",
    );

    const blocked = await request(app)
      .post("/api/newsletter")
      .set("Host", "www.artdera.com")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://attacker.example")
      .send({ email: "blocked-origin@example.com", source: "deployment-test" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("INVALID_ORIGIN");
  });

  it("persists public uploads in MongoDB GridFS and deletes them cleanly", async () => {
    const agent = request.agent(app);
    await registerAndVerify(agent, { email: "gridfs-upload@example.com" });
    const { resetEnvForTests } = await import("../server/config/env");
    process.env.UPLOAD_PROVIDER = "mongodb";
    resetEnvForTests();
    try {
      const png = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
      ]);
      const uploaded = await agent
        .post("/api/uploads")
        .field("purpose", "profile")
        .field("access", "public")
        .attach("file", png, { filename: "avatar.png", contentType: "image/png" });
      expect(uploaded.status).toBe(201);
      expect(uploaded.body.data.url).toBe(`/api/uploads/${uploaded.body.data.publicId}/content`);

      const downloaded = await agent.get(uploaded.body.data.url);
      expect(downloaded.status).toBe(200);
      expect(downloaded.headers["content-type"]).toMatch(/^image\/png/);

      const deleted = await agent.delete(`/api/uploads/${uploaded.body.data.publicId}`);
      expect(deleted.status).toBe(200);
      expect(deleted.body.data.deleted).toBe(true);
      expect((await agent.get(uploaded.body.data.url)).status).toBe(404);
    } finally {
      process.env.UPLOAD_PROVIDER = "local";
      resetEnvForTests();
    }
  });
});
