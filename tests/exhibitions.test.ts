import { describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../server/app";
import {
  ArtworkModel,
  AuthSessionModel,
  ExhibitionModel,
  ExhibitionRegistrationModel,
  ExhibitionLaunchLeadModel,
  NewsletterSubscriptionModel,
  ListingQuotaModel,
  StoreModel,
  SubscriptionModel,
  UserModel,
} from "../server/models";
import { hashToken } from "../server/lib/security";
import { readExhibitionLanding } from "../server/services/exhibitions";
import { exhibitionPhase } from "../src/marketplace/exhibition-types";
import {
  EXHIBITION_LAUNCH_START,
  EXHIBITION_LAUNCH_SLUG,
  exhibitionLaunchIsLive,
  launchCountdownParts,
} from "../src/marketplace/exhibition-launch";

async function fixture() {
  const user = await UserModel.create({
    fullName: "Exhibition Artist",
    email: "artist@exhibition.test",
    emailNormalized: "artist@exhibition.test",
    passwordHash: "unused",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    role: "artist",
    status: "active",
  });
  const admin = await UserModel.create({
    fullName: "Curator",
    email: "admin@exhibition.test",
    emailNormalized: "admin@exhibition.test",
    passwordHash: "unused",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    role: "admin",
    status: "active",
  });
  const store = await StoreModel.create({
    ownerId: user._id,
    ownerType: "artist",
    name: "Exhibition Studio",
    slug: "exhibition-studio",
    isPublished: true,
    status: "active",
    logoUrl: "/images/artist.png",
  });
  const works = await ArtworkModel.insertMany(
    ["published", "reserved", "sold", "pending_review"].map((status, index) => ({
      storeId: store._id,
      artistId: user._id,
      title: `Exhibition work ${index}`,
      slug: `exhibition-work-${index}`,
      category: "Painting",
      medium: "Oil on canvas",
      artworkType: "original",
      price: 150000,
      quantity: status === "sold" ? 0 : 1,
      status,
      moderationStatus: status === "pending_review" ? "pending" : "approved",
      yearCreated: 2026,
      width: 80,
      height: 100,
      images: [{ url: "/images/art-1.jpg" }],
    })),
  );
  await AuthSessionModel.create({
    userId: admin._id,
    tokenHash: hashToken("exhibition-admin"),
    expiresAt: new Date(Date.now() + 3600000),
  });
  await AuthSessionModel.create({
    userId: user._id,
    tokenHash: hashToken("exhibition-artist"),
    expiresAt: new Date(Date.now() + 3600000),
  });
  const input = {
    name: "Between Worlds",
    slug: "between-worlds",
    theme: "Perspectives in contemporary art",
    coverImageUrl: "/images/art-1.jpg",
    startAt: new Date(Date.now() - 86400000).toISOString(),
    endAt: new Date(Date.now() + 86400000).toISOString(),
    status: "active",
    isPublished: true,
    artistIds: [String(user._id)],
    artworkIds: works.slice(0, 3).map((work) => String(work._id)),
    rooms: [
      {
        key: "featured",
        name: "Featured Collection",
        description: "A curated introduction",
        artworkIds: [String(works[0]._id)],
      },
    ],
  };
  await SubscriptionModel.create({
    userId: user._id,
    planId: "free",
    billingCycle: "free",
    status: "active",
    price: 0,
    commissionRate: 0,
    listingLimit: 10,
  });
  await ListingQuotaModel.create({ userId: user._id, activeListings: 3 });
  return {
    app: createApp(),
    input,
    works,
    store,
    user,
    adminCookie: "artdera_session=exhibition-admin",
    artistCookie: "artdera_session=exhibition-artist",
  };
}

describe("online exhibition system", () => {
  it("renders locked marketing CTAs before opening and the live viewing room at the exact launch instant", async () => {
    await fixture();
    const [
      { createElement },
      { renderToString },
      { QueryClient, QueryClientProvider },
      { CurrencyProvider },
      { AuthProvider },
      { ExhibitionLaunchPage },
    ] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@tanstack/react-query"),
      import("../src/marketplace/currency"),
      import("../src/marketplace/auth"),
      import("../src/components/exhibition/ExhibitionLaunchPage"),
    ]);
    const data = await readExhibitionLanding();
    const render = (now: number) =>
      renderToString(
        createElement(
          QueryClientProvider,
          { client: new QueryClient() },
          createElement(
            CurrencyProvider,
            null,
            createElement(
              AuthProvider,
              null,
              createElement(ExhibitionLaunchPage, {
                initial: { ...data, launch: { ...data.launch, serverNow: now } },
              }),
            ),
          ),
        ),
      );
    const before = render(Date.parse(EXHIBITION_LAUNCH_START) - 1000);
    expect(before).toContain("Get Early Access");
    expect(before).toContain("Notify Me");
    expect(before).toContain("The Doors Open");
    expect(before).not.toContain("Exhibition Now Live — Enter Exhibition.");
    const live = render(Date.parse(EXHIBITION_LAUNCH_START));
    expect(live).toContain("Exhibition Now Live — Enter Exhibition.");
    expect(live).toContain("Enter Exhibition");
    expect(live).not.toContain("The Doors Open");
    expect(live).not.toContain("Notify Me");
  });
  it("builds the 2026 launch preview from real public works without inventing an exhibition record", async () => {
    const { app, works } = await fixture();
    const result = await request(app).get("/api/exhibitions").expect(200);
    const launch = result.body.data.launch;
    expect(launch.curated).toBe(false);
    expect(launch.detail.exhibition.name).toBe("ArtDera Online Exhibition 2026");
    expect(launch.detail.exhibition.startAt).toBe(EXHIBITION_LAUNCH_START);
    expect(launch.detail.artworks.map((work: any) => work.id)).toEqual([String(works[0]._id)]);
    expect(await ExhibitionModel.countDocuments()).toBe(0);
    const instant = Date.parse(EXHIBITION_LAUNCH_START);
    expect(new Date(instant).toISOString()).toBe("2026-11-23T19:00:00.000Z");
    expect(exhibitionLaunchIsLive(instant - 1)).toBe(false);
    expect(exhibitionLaunchIsLive(instant)).toBe(true);
    expect(launchCountdownParts(instant - 90061000)).toEqual([1, 1, 1, 1]);
    expect(launchCountdownParts(instant + 1)).toEqual([0, 0, 0, 0]);
  });
  it("saves early access, notification and private preview requests before a curated exhibition is published", async () => {
    const { app, adminCookie, artistCookie } = await fixture();
    const input = { kind: "notify", email: "Launch@example.com", consent: true };
    await request(app)
      .post("/api/exhibitions/launch/registrations")
      .send({ ...input, consent: false })
      .expect(422);
    await request(app).post("/api/exhibitions/launch/registrations").send(input).expect(201);
    await request(app).post("/api/exhibitions/launch/registrations").send(input).expect(201);
    expect(await ExhibitionLaunchLeadModel.countDocuments()).toBe(1);
    expect(
      (await NewsletterSubscriptionModel.findOne({ emailNormalized: "launch@example.com" }))
        ?.source,
    ).toBe("exhibition-2026-notify");
    await request(app)
      .post("/api/exhibitions/launch/registrations")
      .send({ ...input, kind: "early-access" })
      .expect(201);
    await request(app)
      .post("/api/exhibitions/launch/registrations")
      .send({ ...input, kind: "preview" })
      .expect(422);
    await request(app)
      .post("/api/exhibitions/launch/registrations")
      .send({ ...input, kind: "preview", name: "Private Collector" })
      .expect(201);
    await request(app).get("/api/admin/exhibitions/launch-registrations").expect(401);
    await request(app)
      .get("/api/admin/exhibitions/launch-registrations")
      .set("Cookie", artistCookie)
      .expect(403);
    const registrations = await request(app)
      .get("/api/admin/exhibitions/launch-registrations")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(registrations.body.data.total).toBe(3);
    expect(JSON.stringify((await request(app).get("/api/exhibitions")).body)).not.toContain(
      "launch@example.com",
    );
  });
  it("lets an admin choose a curated campaign and configure media without publishing draft selections", async () => {
    const { app, input, adminCookie, works } = await fixture();
    const exhibition = await ExhibitionModel.create({
      ...input,
      slug: EXHIBITION_LAUNCH_SLUG,
      type: "online",
      isPublished: false,
    });
    const config = {
      exhibitionSlug: EXHIBITION_LAUNCH_SLUG,
      heroVideoUrl: "",
      trailerVideoUrl: "/hero.mp4",
      trailerPosterUrl: "/images/art-1.jpg",
      advisorWhatsapp: "923001234567",
    };
    await request(app).patch("/api/admin/exhibitions/launch-settings").send(config).expect(401);
    await request(app)
      .patch("/api/admin/exhibitions/launch-settings")
      .set("Cookie", adminCookie)
      .send({ ...config, trailerVideoUrl: "javascript:alert(1)" })
      .expect(422);
    await request(app)
      .patch("/api/admin/exhibitions/launch-settings")
      .set("Cookie", adminCookie)
      .send(config)
      .expect(200);
    expect((await request(app).get("/api/exhibitions")).body.data.launch.curated).toBe(false);
    await ExhibitionModel.updateOne({ _id: exhibition._id }, { isPublished: true });
    const launch = (await request(app).get("/api/exhibitions")).body.data.launch;
    expect(launch.curated).toBe(true);
    expect(launch.detail.artworks).toHaveLength(3);
    expect(launch.settings.advisorWhatsapp).toBe(config.advisorWhatsapp);
    await request(app)
      .post("/api/exhibitions/launch/registrations")
      .send({
        kind: "enquiry",
        name: "Collector",
        email: "enquiry@example.com",
        consent: true,
        artworkId: String(works[2]._id),
      })
      .expect(201);
    await request(app)
      .post("/api/exhibitions/launch/registrations")
      .send({
        kind: "enquiry",
        name: "Collector",
        email: "enquiry@example.com",
        consent: true,
        artworkId: String(works[3]._id),
      })
      .expect(422);
  });
  it("creates, edits, unpublishes and schedules exhibitions through admin-only APIs", async () => {
    const { app, input, adminCookie, artistCookie } = await fixture();
    await request(app).post("/api/admin/exhibitions").send(input).expect(401);
    await request(app)
      .post("/api/admin/exhibitions")
      .set("Cookie", artistCookie)
      .send(input)
      .expect(403);
    const created = await request(app)
      .post("/api/admin/exhibitions")
      .set("Cookie", adminCookie)
      .send(input)
      .expect(201);
    const id = created.body.data.id;
    await request(app).get("/api/exhibitions/between-worlds").expect(200);
    await request(app)
      .patch(`/api/admin/exhibitions/${id}`)
      .set("Cookie", adminCookie)
      .send({ theme: "New perspectives", isPublished: false })
      .expect(200);
    await request(app).get("/api/exhibitions/between-worlds").expect(404);
    const landing = await request(app).get("/api/exhibitions").expect(200);
    expect(landing.body.data.featured).toBeNull();
    const future = {
      ...input,
      slug: "future-worlds",
      status: "scheduled",
      startAt: new Date(Date.now() + 86400000).toISOString(),
      endAt: new Date(Date.now() + 172800000).toISOString(),
    };
    await request(app)
      .post("/api/admin/exhibitions")
      .set("Cookie", adminCookie)
      .send(future)
      .expect(201);
    expect((await readExhibitionLanding()).featured?.exhibition.slug).toBe("future-worlds");
  });

  it("keeps sold and reserved works in the gallery and excludes unapproved, demo and unpublished stores", async () => {
    const { app, input, works, store } = await fixture();
    await ExhibitionModel.create({
      ...input,
      type: "online",
      artworkIds: works.map((work) => work._id),
    });
    const detail = await request(app).get("/api/exhibitions/between-worlds").expect(200);
    expect(detail.body.data.artworks.map((work: any) => work.availability)).toEqual([
      "Available",
      "Reserved",
      "Sold",
    ]);
    expect(detail.body.data.artists[0].slug).toBe(store.slug);
    expect(JSON.stringify(detail.body.data)).not.toContain("artist@exhibition.test");
    expect(JSON.stringify(detail.body.data)).not.toContain("passwordHash");
    await ArtworkModel.updateOne({ _id: works[0]._id }, { isDemo: true });
    expect(
      (await request(app).get("/api/exhibitions/between-worlds")).body.data.artworks,
    ).toHaveLength(2);
    await StoreModel.updateOne({ _id: store._id }, { isPublished: false });
    const hidden = await request(app).get("/api/exhibitions/between-worlds");
    expect(hidden.body.data.artworks).toHaveLength(0);
    expect(hidden.body.data.artists).toHaveLength(0);
  });

  it("rejects invalid dates, room assignments, private artwork selections, duplicate slugs and unsafe URLs", async () => {
    const { app, input, works, adminCookie } = await fixture();
    const create = (body: Record<string, unknown>) =>
      request(app).post("/api/admin/exhibitions").set("Cookie", adminCookie).send(body);
    await create({ ...input, endAt: input.startAt }).expect(422);
    await create({
      ...input,
      rooms: [{ key: "bad", name: "Private", artworkIds: [String(works[3]._id)] }],
    }).expect(422);
    await create({ ...input, artworkIds: [String(works[3]._id)], rooms: [] }).expect(422);
    await create({ ...input, coverImageUrl: "javascript:alert(1)" }).expect(422);
    await create({
      ...input,
      events: [
        {
          title: "Opening",
          startAt: input.startAt,
          timezone: "invalid",
          url: "https://example.com",
        },
      ],
    }).expect(422);
    const created = await create(input).expect(201);
    await create(input).expect(409);
    await request(app)
      .patch(`/api/admin/exhibitions/${created.body.data.id}`)
      .set("Cookie", adminCookie)
      .send({ startAt: input.endAt })
      .expect(422);
  });

  it("persists preview requests and artwork enquiries with consent, deduplication and private admin access", async () => {
    const { app, input, works, adminCookie } = await fixture();
    const exhibition = await ExhibitionModel.create({ ...input, type: "online" });
    const registration = {
      kind: "preview",
      name: "Collector",
      email: "Collector@example.com",
      country: "Pakistan",
      message: "I would like a private viewing.",
      consent: true,
    };
    await request(app)
      .post("/api/exhibitions/between-worlds/registrations")
      .send({ ...registration, consent: false })
      .expect(422);
    await request(app)
      .post("/api/exhibitions/between-worlds/registrations")
      .send(registration)
      .expect(201);
    await request(app)
      .post("/api/exhibitions/between-worlds/registrations")
      .send(registration)
      .expect(201);
    expect(await ExhibitionRegistrationModel.countDocuments()).toBe(1);
    await request(app)
      .post("/api/exhibitions/between-worlds/registrations")
      .send({ ...registration, kind: "enquiry", artworkId: String(works[2]._id) })
      .expect(201);
    await request(app)
      .post("/api/exhibitions/between-worlds/registrations")
      .send({ ...registration, kind: "enquiry", artworkId: String(new mongoose.Types.ObjectId()) })
      .expect(422);
    await request(app).get(`/api/admin/exhibitions/${exhibition._id}/registrations`).expect(401);
    const requests = await request(app)
      .get(`/api/admin/exhibitions/${exhibition._id}/registrations`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(requests.body.data.total).toBe(2);
    expect(requests.body.data.items[0].email).toBe("collector@example.com");
    await ExhibitionModel.updateOne(
      { _id: exhibition._id },
      { endAt: new Date(Date.now() - 1000) },
    );
    await request(app)
      .post("/api/exhibitions/between-worlds/registrations")
      .send(registration)
      .expect(409);
  });

  it("updates marketplace availability and prevents changes to checkout-owned artwork", async () => {
    const { app, input, works, user, adminCookie } = await fixture();
    const exhibition = await ExhibitionModel.create({ ...input, type: "online" });
    const path = `/api/admin/exhibitions/${exhibition._id}/artworks/${works[0]._id}/availability`;
    await request(app).patch(path).send({ availability: "Sold" }).expect(401);
    await request(app)
      .patch(path)
      .set("Cookie", adminCookie)
      .send({ availability: "Reserved" })
      .expect(200);
    expect((await ArtworkModel.findById(works[0]._id))?.status).toBe("reserved");
    await request(app)
      .patch(path)
      .set("Cookie", adminCookie)
      .send({ availability: "Sold" })
      .expect(200);
    expect((await ListingQuotaModel.findOne({ userId: user._id }))?.activeListings).toBe(2);
    expect(
      (await request(app).get("/api/exhibitions/between-worlds")).body.data.artworks[0]
        .availability,
    ).toBe("Sold");
    await request(app)
      .patch(path)
      .set("Cookie", adminCookie)
      .send({ availability: "Available" })
      .expect(200);
    expect((await ListingQuotaModel.findOne({ userId: user._id }))?.activeListings).toBe(3);
    await ArtworkModel.updateOne(
      { _id: works[0]._id },
      { status: "reserved", reservedBy: user._id, reservedUntil: new Date(Date.now() + 600000) },
    );
    await request(app)
      .patch(path)
      .set("Cookie", adminCookie)
      .send({ availability: "Available" })
      .expect(409);
    expect((await ArtworkModel.findById(works[0]._id))?.reservedBy?.toString()).toBe(
      String(user._id),
    );
  });

  it("selects a live exhibition ahead of upcoming and archived shows and handles exact opening boundaries", async () => {
    const { input } = await fixture();
    await ExhibitionModel.create({ ...input, type: "online" });
    await ExhibitionModel.create({
      ...input,
      slug: "upcoming",
      type: "online",
      status: "scheduled",
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 172800000),
    });
    await ExhibitionModel.create({ ...input, slug: "private", type: "online", isPublished: false });
    await ExhibitionModel.create({
      ...input,
      slug: "cancelled",
      type: "online",
      status: "cancelled",
    });
    const landing = await readExhibitionLanding();
    expect(landing.exhibitions).toHaveLength(2);
    expect(landing.featured?.exhibition.slug).toBe(input.slug);
    const state = {
      status: "scheduled",
      startAt: "2026-11-01T00:00:00Z",
      endAt: "2026-12-01T00:00:00Z",
    };
    expect(exhibitionPhase(state, Date.parse(state.startAt) - 1)).toBe("upcoming");
    expect(exhibitionPhase(state, Date.parse(state.startAt))).toBe("live");
    expect(exhibitionPhase(state, Date.parse(state.endAt))).toBe("closed");
  });

  it("stores collectors circle email signups in the existing newsletter system", async () => {
    const { app } = await fixture();
    await request(app)
      .post("/api/newsletter")
      .send({ email: "circle@example.com", source: "exhibition-collectors-circle" })
      .expect(201);
    expect(
      (await NewsletterSubscriptionModel.findOne({ emailNormalized: "circle@example.com" }))
        ?.source,
    ).toBe("exhibition-collectors-circle");
  });
});
