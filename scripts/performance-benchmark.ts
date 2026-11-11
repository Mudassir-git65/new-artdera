import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";

// An isolated local database ONLY. Never load production fixtures or write
// benchmark records to the database configured in .env.
const replica = await MongoMemoryReplSet.create({
  instanceOpts: [{ launchTimeout: 60_000 }],
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.NODE_ENV = "production";
process.env.MONGODB_URI = replica.getUri();
process.env.MONGODB_DB_NAME = "artdera_performance_isolated";
process.env.AUTH_SECRET = "isolated-performance-benchmark-secret-0000000000";
process.env.APP_URL = "https://www.artdera.com";
process.env.DEMO_PAYMENT_MODE = "false";
process.env.SEED_DEMO_DATA = "false";
const { resetEnvForTests } = await import("../server/config/env");
resetEnvForTests();
const { connectDatabase, disconnectDatabase } = await import("../server/db");
const { loadCatalogPage, loadCreatorPage } = await import("../src/lib/catalog.server");
const { clearCatalogCache } = await import("../server/lib/catalog-cache");
try {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const stores = Array.from({ length: 1000 }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(),
    ownerId: new mongoose.Types.ObjectId(),
    ownerType: "artist",
    name: `Benchmark Studio ${i}`,
    slug: `benchmark-studio-${i}`,
    status: "active",
    isPublished: true,
    createdAt: new Date(1700000000000 + i),
  }));
  await db.collection("stores").insertMany(stores);
  const count = Number(process.env.PERFORMANCE_ARTWORKS ?? 100_000);
  for (let offset = 0; offset < count; offset += 5000) {
    await db.collection("artworks").insertMany(
      Array.from({ length: Math.min(5000, count - offset) }, (_, j) => {
        const i = offset + j;
        return {
          _id: new mongoose.Types.ObjectId(),
          storeId: stores[i % stores.length]._id,
          artistId: stores[i % stores.length].ownerId,
          title: `Benchmark Artwork ${i}`,
          slug: `benchmark-artwork-${i}`,
          category: "Painting",
          medium: "Oil on canvas",
          artworkType: "original",
          price: i % 10 === 0 ? 2000 : 50000 + i,
          discountPrice: i % 20 === 1 ? 2500 : undefined,
          status: "published",
          moderationStatus: "approved",
          isDemo: false,
          createdAt: new Date(1700000000000 + i),
          images: [{ url: "/images/art-1.jpg" }],
          views: i % 2000,
          wishlistCount: i % 100,
        };
      }),
    );
  }
  const filter = {
    status: "published",
    moderationStatus: "approved",
    isDemo: { $ne: true },
    section: { $ne: "decora" },
  };
  const pageQuery = () =>
    db.collection("artworks").find(filter).sort({ createdAt: -1, _id: -1 }).limit(25);
  const before = await pageQuery().explain("executionStats");
  await db
    .collection("artworks")
    .createIndexes([
      { key: { status: 1, moderationStatus: 1, createdAt: -1, _id: -1 } },
      { key: { status: 1, moderationStatus: 1, price: 1, _id: 1 } },
      { key: { status: 1, moderationStatus: 1, discountPrice: 1, _id: 1 } },
      { key: { status: 1, moderationStatus: 1, views: -1, wishlistCount: -1, _id: -1 } },
    ]);
  await db
    .collection("stores")
    .createIndex({ isPublished: 1, status: 1, ownerType: 1, createdAt: -1, _id: -1 });
  const after = await pageQuery().explain("executionStats");
  async function timed<T>(task: () => Promise<T>) {
    const start = performance.now();
    const value = await task();
    return { ms: Math.round((performance.now() - start) * 100) / 100, value };
  }
  clearCatalogCache();
  const cold = await timed(() => loadCatalogPage({ limit: 24 }));
  const warm: number[] = [];
  for (let i = 0; i < 20; i++) warm.push((await timed(() => loadCatalogPage({ limit: 24 }))).ms);
  clearCatalogCache();
  const concurrent = await timed(() =>
    Promise.all(Array.from({ length: 50 }, () => loadCatalogPage({ limit: 24 }))),
  );
  const decora = await timed(() =>
    loadCatalogPage({ section: "decora", sort: "price_asc", limit: 24 }),
  );
  const search = await timed(() => loadCatalogPage({ q: "Artwork 999", limit: 24 }));
  const directory = await timed(() => loadCreatorPage({ type: "artist" }));
  const stats = (plan: any) => ({
    executionMs: plan.executionStats.executionTimeMillis,
    returned: plan.executionStats.nReturned,
    documentsExamined: plan.executionStats.totalDocsExamined,
    keysExamined: plan.executionStats.totalKeysExamined,
    plan: plan.queryPlanner.winningPlan,
  });
  const result = {
    measuredAt: new Date().toISOString(),
    scope: "isolated local MongoDB, no network latency",
    artworks: count,
    artists: stores.length,
    before: stats(before),
    after: stats(after),
    coldCatalogMs: cold.ms,
    warmCatalogMedianMs: [...warm].sort((a, b) => a - b)[10],
    warmCatalogSamplesMs: warm,
    concurrent50Ms: concurrent.ms,
    concurrentConsistent: concurrent.value.every(
      (page) =>
        JSON.stringify(page.products.map((p) => p.id)) ===
        JSON.stringify(cold.value.products.map((p) => p.id)),
    ),
    decoraColdMs: decora.ms,
    decoraTotal: decora.value.total,
    substringSearchColdMs: search.ms,
    substringSearchTotal: search.value.total,
    creatorPageMs: directory.ms,
    creatorPageSize: directory.value.items.length,
  };
  await mkdir(".performance", { recursive: true });
  await writeFile(".performance/scale-benchmark.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await disconnectDatabase();
  await replica.stop();
}
