import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import sharp from "sharp";
import { createApp } from "../server/app";
import {
  ArtworkModel,
  AuthSessionModel,
  CollectionModel,
  PromotionModel,
  StoreModel,
  UploadModel,
  UserModel,
} from "../server/models";
import { loadCollectionCatalog, loadProduct, loadStoreCatalog } from "../src/lib/catalog.server";
import { catalogSearchFilter, readArtworkPage } from "../server/services/catalog";
import { uniqueById } from "../src/lib/catalog-product";
import { hashToken } from "../server/lib/security";
import { disconnectDatabase } from "../server/db";
import { mkdir, writeFile } from "node:fs/promises";

async function fixture(count = 21) {
  const user = await UserModel.create({
    fullName: "Catalog Artist",
    email: "catalog@test.com",
    emailNormalized: "catalog@test.com",
    passwordHash: "unused",
    role: "artist",
    status: "active",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
  });
  const store = await StoreModel.create({
    ownerId: user._id,
    ownerType: "artist",
    name: "Catalog Studio",
    slug: "catalog-studio",
    status: "active",
    isPublished: true,
  });
  const items = await ArtworkModel.insertMany(
    Array.from({ length: count }, (_, i) => ({
      storeId: store._id,
      artistId: user._id,
      title: `Artwork ${i}`,
      slug: `catalog-artwork-${i}`,
      category: "Painting",
      medium: "Oil on canvas",
      artworkType: "original",
      price: 1000 + i,
      status: "published",
      moderationStatus: "approved",
      createdAt: new Date("2026-01-01"),
      images: [{ url: "/api/uploads/test-image/content", alt: `Artwork ${i}` }],
    })),
  );
  const token = "catalog-owner-session";
  await AuthSessionModel.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 3600000),
  });
  return { user, store, items, cookie: `artdera_session=${token}` };
}

describe("authoritative artwork catalog", () => {
  it("shows every eligible studio artwork exactly once across 30 concurrent loads", async () => {
    const { store, items } = await fixture();
    await ArtworkModel.create({
      storeId: store._id,
      title: "Pending",
      slug: "pending-work",
      category: "Painting",
      medium: "Oil",
      artworkType: "original",
      price: 1000,
      status: "pending_review",
      moderationStatus: "pending",
    });
    const app = createApp();
    const expected = items.map((item) => String(item._id)).sort();
    const responses = await Promise.all(
      Array.from({ length: 30 }, () => request(app).get("/api/stores/catalog-studio").expect(200)),
    );
    for (const response of responses) {
      const ids = response.body.data.artworks.map((item: any) => item.id);
      expect(ids).toHaveLength(21);
      expect(new Set(ids).size).toBe(21);
      expect([...ids].sort()).toEqual(expected);
      expect(response.body.data.total).toBe(21);
      expect(response.body.data.nextCursor).toBeNull();
    }
    const ssr = await loadStoreCatalog("catalog-studio");
    expect(ssr?.works.map((work) => work.id).sort()).toEqual(expected);
    const mine = await request(app)
      .get("/api/artworks/mine")
      .set("Cookie", "artdera_session=catalog-owner-session")
      .expect(200);
    expect(mine.body.data).toHaveLength(22);
  });

  it("connects on a cold SSR request and never fabricates products or creators", async () => {
    await fixture();
    await disconnectDatabase();
    expect((await loadStoreCatalog("catalog-studio"))?.total).toBe(21);
    expect(await loadStoreCatalog("missing-studio")).toBeNull();
    expect(await loadProduct("quiet-horizon")).toBeNull();
    const failure = vi.spyOn(StoreModel, "findOne").mockImplementationOnce(() => {
      throw new Error("temporary database failure");
    });
    await expect(loadStoreCatalog("catalog-studio")).rejects.toThrow("temporary database failure");
    failure.mockRestore();
  });

  it("casts ownership filters and counts approved works consistently with the public store", async () => {
    const { store, user } = await fixture();
    const app = createApp();
    for (const query of [
      `storeId=${store._id}`,
      `artistId=${user._id}`,
      `storeId=${store._id}&verified=true`,
    ]) {
      if (query.includes("verified"))
        await StoreModel.updateOne({ _id: store._id }, { verificationStatus: "approved" });
      const result = await request(app).get(`/api/artworks?${query}`).expect(200);
      expect(result.body.data.total).toBe(21);
      expect(result.body.data.items).toHaveLength(21);
    }
  });

  it("paginates tied timestamps without overlaps, including promoted works and new insertions", async () => {
    const { store, items } = await fixture(83);
    await PromotionModel.create({
      userId: store.ownerId,
      storeId: store._id,
      artworkId: items[81]._id,
      promotionType: "homepage",
      placement: "homepage",
      status: "active",
      startAt: new Date(Date.now() - 1000),
      endAt: new Date(Date.now() + 86400000),
      price: 1000,
      currency: "PKR",
    });
    let page = await readArtworkPage({ limit: 24, filter: { storeId: store._id } });
    expect(page.total).toBe(83);
    const ids = page.items.map((item) => item.id);
    await ArtworkModel.create({
      storeId: store._id,
      title: "Newer",
      slug: "newer-work",
      category: "Painting",
      medium: "Oil",
      artworkType: "original",
      price: 2000,
      status: "published",
      moderationStatus: "approved",
    });
    while (page.nextCursor) {
      page = await readArtworkPage({
        limit: 24,
        filter: { storeId: store._id },
        cursor: page.nextCursor,
      });
      ids.push(...page.items.map((item) => item.id));
    }
    expect(ids).toHaveLength(83);
    expect(new Set(ids).size).toBe(83);
    expect([...ids].sort()).toEqual(items.map((item) => String(item._id)).sort());
    const first = await readArtworkPage({ limit: 24 });
    await expect(
      readArtworkPage({ sort: "price_asc", cursor: first.nextCursor! }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    for (const sort of ["price_asc", "price_desc", "popular"]) {
      let next = await readArtworkPage({ limit: 24, sort });
      const sortedIds = next.items.map((item) => item.id);
      while (next.nextCursor) {
        next = await readArtworkPage({ limit: 24, sort, cursor: next.nextCursor });
        sortedIds.push(...next.items.map((item) => item.id));
      }
      expect(sortedIds).toHaveLength(84);
      expect(new Set(sortedIds).size).toBe(84);
    }
  });

  it("loads larger profiles and curated works outside the homepage summary", async () => {
    const { store, items } = await fixture(83);
    const first = await loadStoreCatalog(store.slug);
    expect(first?.total).toBe(83);
    expect(first?.works).toHaveLength(60);
    const second = await loadStoreCatalog(store.slug, first!.nextCursor!);
    const ids = [...first!.works, ...second!.works].map((work) => work.id);
    expect(ids).toHaveLength(83);
    expect(new Set(ids).size).toBe(83);
    expect(second?.nextCursor).toBeNull();
    await CollectionModel.create({
      name: "Curated",
      slug: "curated",
      isPublished: true,
      artworkIds: [items[0]._id],
    });
    const curated = await loadCollectionCatalog();
    expect(curated.products.map((product) => product.id)).toEqual([String(items[0]._id)]);
    expect(curated.collections[0].products).toEqual([items[0].slug]);
    const painting = await readArtworkPage({
      limit: 2,
      filter: catalogSearchFilter({ q: "Artwork" }),
    });
    await expect(
      readArtworkPage({
        limit: 2,
        cursor: painting.nextCursor!,
        filter: catalogSearchFilter({ q: "Other" }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  });

  it("keeps ID links and former slugs valid while returning genuine 404s for unpublished works", async () => {
    const { items, cookie } = await fixture(1);
    const app = createApp();
    await request(app)
      .patch(`/api/artworks/${items[0]._id}`)
      .set("Cookie", cookie)
      .send({ slug: "renamed-work" })
      .expect(200);
    for (const identity of [
      "catalog-artwork-0",
      "renamed-work",
      String(items[0]._id),
      `${items[0]._id}-old-title`,
    ]) {
      const response = await request(app).get(`/api/artworks/slug/${identity}`).expect(200);
      expect(response.body.data.id).toBe(String(items[0]._id));
    }
    await request(app)
      .patch(`/api/artworks/${items[0]._id}`)
      .set("Cookie", cookie)
      .send({ status: "Draft" })
      .expect(200);
    await request(app).get("/api/artworks/slug/renamed-work").expect(404);
    expect((await loadStoreCatalog("catalog-studio"))?.total).toBe(0);
    expect(await loadProduct("renamed-work")).toBeNull();
    await request(app).get("/api/artworks/slug/no-such-work").expect(404);
    await request(app).get("/api/og/product/renamed-work").expect(404);
  });

  it("revalidates publication changes and preserves renamed store URLs", async () => {
    const { store, items, cookie } = await fixture(1);
    const app = createApp();
    const first = await request(app).get("/api/stores/catalog-studio").expect(200);
    expect(first.headers["cache-control"]).toContain("must-revalidate");
    expect(first.headers.vary).toContain("Cookie");
    await request(app)
      .patch(`/api/stores/${store._id}`)
      .set("Cookie", cookie)
      .send({ slug: "new-studio-slug" })
      .expect(200);
    expect(
      (await request(app).get("/api/stores/catalog-studio").expect(200)).body.data.store.slug,
    ).toBe("new-studio-slug");
    await ArtworkModel.updateOne(
      { _id: items[0]._id },
      { status: "draft", moderationStatus: "not_submitted" },
    );
    const refreshed = await request(app)
      .get("/api/stores/new-studio-slug")
      .set("If-None-Match", first.headers.etag)
      .expect(200);
    expect(refreshed.body.data.total).toBe(0);
    expect(refreshed.headers.etag).not.toBe(first.headers.etag);
    expect(
      (await request(app).get("/api/bootstrap").expect(200)).headers["cache-control"],
    ).toContain("no-store");
  });

  it("excludes verified demo provenance without deleting or changing the owner records", async () => {
    const { store, items, cookie } = await fixture(2);
    await ArtworkModel.updateOne({ _id: items[0]._id }, { isDemo: true });
    const app = createApp();
    const page = await loadStoreCatalog(store.slug);
    expect(page?.total).toBe(1);
    expect(page?.works.map((work) => work.id)).toEqual([String(items[1]._id)]);
    expect(await loadProduct(items[0].slug)).toBeNull();
    await request(app)
      .get("/api/artworks/slug/" + items[0].slug)
      .expect(404);
    const mine = await request(app).get("/api/artworks/mine").set("Cookie", cookie).expect(200);
    expect(mine.body.data).toHaveLength(2);
    expect((await ArtworkModel.findById(items[0]._id))?.status).toBe("published");
    await CollectionModel.create({
      name: "Seed Collection",
      slug: "seed-collection",
      artworkIds: [items[0]._id],
      isPublished: true,
      isDemo: true,
    });
    expect((await loadCollectionCatalog()).collections).toHaveLength(0);
    await StoreModel.updateOne({ _id: store._id }, { isDemo: true });
    expect(await loadStoreCatalog(store.slug)).toBeNull();
    const bootstrap = await request(app).get("/api/bootstrap").expect(200);
    expect(bootstrap.body.data.stores).toHaveLength(0);
    expect(bootstrap.body.data.collections).toHaveLength(0);
  });

  it("coalesces browser reads while allowing fresh reads, retries, and mutation invalidation", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const { HttpApiClient } = await import("../src/marketplace/services");
    const client = new HttpApiClient();
    let complete!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      complete = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockImplementation(
        () =>
          new Response(JSON.stringify({ success: true, data: { total: 21 } }), {
            headers: { "content-type": "application/json" },
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const reads = Array.from({ length: 30 }, () => client.get("/api/stores/catalog-studio"));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      complete(
        new Response(JSON.stringify({ success: true, data: { total: 21 } }), {
          headers: { "content-type": "application/json" },
        }),
      );
      expect(
        (await Promise.all(reads)).every(
          (result) => (result.data as { total: number }).total === 21,
        ),
      ).toBe(true);
      await client.get("/api/stores/catalog-studio");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      fetchMock.mockRejectedValueOnce(new Error("Offline"));
      expect((await client.get("/api/artworks")).error?.code).toBe("API_UNAVAILABLE");
      await client.get("/api/artworks");
      await client.patch("/api/artworks/work-id", { status: "Draft" });
      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      expect(dispatchEvent.mock.calls[0][0].type).toBe("artdera:catalog-changed");
      expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("deduplicates by permanent ID while allowing two real records with the same title", () => {
    expect(
      uniqueById([
        { id: "one", slug: "old" },
        { id: "two", slug: "same-title" },
        { id: "one", slug: "new" },
      ]),
    ).toEqual([
      { id: "one", slug: "new" },
      { id: "two", slug: "same-title" },
    ]);
  });

  it("serves smaller public WebP thumbnails and refuses private or unsupported image sizes", async () => {
    const { user } = await fixture(1);
    const original = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await mkdir("test-uploads/public", { recursive: true });
    await writeFile("test-uploads/public/catalog-thumbnail.png", original);
    await UploadModel.create({
      ownerId: user._id,
      publicId: "catalog-thumbnail",
      url: "/api/uploads/catalog-thumbnail/content",
      storageKey: "public/catalog-thumbnail.png",
      provider: "local",
      originalName: "artwork.png",
      mimeType: "image/png",
      size: original.length,
      access: "public",
      purpose: "artwork",
    });
    const app = createApp();
    const response = await request(app)
      .get("/api/uploads/catalog-thumbnail/content?w=320&format=webp")
      .expect(200);
    expect(response.headers["content-type"]).toContain("image/webp");
    const image = await sharp(response.body).metadata();
    expect(image.width).toBe(320);
    expect(response.body.length).toBeLessThan(original.length);
    await request(app)
      .get("/api/uploads/catalog-thumbnail/content?w=999999&format=webp")
      .expect(422);
    await UploadModel.updateOne({ publicId: "catalog-thumbnail" }, { access: "private" });
    await request(app).get("/api/uploads/catalog-thumbnail/content?w=320&format=webp").expect(404);
  });
});
