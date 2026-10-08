import "dotenv/config";
import mongoose from "mongoose";
import { writeFile } from "node:fs/promises";

// Native collection reads only: importing models here could initialize indexes.
const slug = process.argv[2] ?? "artbyayesha19";
const destination = process.argv[3];
await mongoose.connect(process.env.MONGODB_URI!, {
  dbName: process.env.MONGODB_DB_NAME ?? "artdera",
  autoIndex: false,
  autoCreate: false,
  serverSelectionTimeoutMS: 10000,
});
try {
  const db = mongoose.connection.db!;
  const store = await db
    .collection("stores")
    .findOne({ slug }, { projection: { ownerId: 1, slug: 1, name: 1, status: 1, isPublished: 1 } });
  if (!store) throw new Error("Store not found");
  const rows = await db
    .collection("artworks")
    .find(
      { $or: [{ storeId: store._id }, { artistId: store.ownerId }] },
      {
        projection: {
          title: 1,
          slug: 1,
          storeId: 1,
          artistId: 1,
          status: 1,
          isDemo: 1,
          moderationStatus: 1,
          rejectionReason: 1,
          createdAt: 1,
        },
      },
    )
    .sort({ createdAt: -1, _id: -1 })
    .toArray();
  const filter = {
    storeId: store._id,
    status: "published",
    moderationStatus: "approved",
    isDemo: { $ne: true },
  };
  const subscriptions = await db
    .collection("subscriptions")
    .find(
      { userId: store.ownerId },
      { projection: { planId: 1, status: 1, listingLimit: 1, currentPeriodEnd: 1 } },
    )
    .toArray();
  const durations: number[] = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    await db
      .collection("artworks")
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(60)
      .toArray();
    durations.push(performance.now() - start);
  }
  const plan = await db
    .collection("artworks")
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(60)
    .explain("executionStats");
  const records = rows.map((row) => ({
    id: String(row._id),
    title: row.title,
    slug: row.slug,
    status: row.status,
    moderationStatus: row.moderationStatus,
    ownershipMatches:
      String(row.storeId) === String(store._id) && String(row.artistId) === String(store.ownerId),
    eligible:
      row.status === "published" && row.moderationStatus === "approved" && row.isDemo !== true,
    hiddenReason:
      row.isDemo === true
        ? "Verified demo seed fixture"
        : row.status === "published" && row.moderationStatus === "approved"
          ? null
          : row.status === "pending_review"
            ? "Awaiting administrator approval"
            : row.status === "draft"
              ? "Draft; not submitted for publication"
              : row.status === "rejected"
                ? row.rejectionReason || "Rejected by moderation; no reason recorded"
                : `Status ${row.status}; moderation ${row.moderationStatus}`,
  }));
  const [allStores, allArtworks] = await Promise.all([
    db
      .collection("stores")
      .find(
        {},
        {
          projection: {
            name: 1,
            slug: 1,
            ownerId: 1,
            ownerType: 1,
            isPublished: 1,
            status: 1,
            isDemo: 1,
          },
        },
      )
      .toArray(),
    db
      .collection("artworks")
      .find(
        {},
        { projection: { storeId: 1, artistId: 1, status: 1, moderationStatus: 1, isDemo: 1 } },
      )
      .toArray(),
  ]);
  const storeById = new Map(allStores.map((row) => [String(row._id), row]));
  const integrity = {
    totalArtworks: allArtworks.length,
    publicArtworks: allArtworks.filter(
      (row) =>
        row.status === "published" && row.moderationStatus === "approved" && row.isDemo !== true,
    ).length,
    orphanIds: allArtworks
      .filter((row) => !storeById.has(String(row.storeId)))
      .map((row) => String(row._id)),
    ownershipMismatchIds: allArtworks
      .filter((row) => {
        const parent = storeById.get(String(row.storeId));
        return parent?.ownerType === "artist" && String(row.artistId) !== String(parent.ownerId);
      })
      .map((row) => String(row._id)),
    publicStores: allStores
      .filter((row) => row.isPublished && row.status === "active" && row.isDemo !== true)
      .map((row) => ({
        id: String(row._id),
        slug: row.slug,
        name: row.name,
        ownerType: row.ownerType,
        records: allArtworks.filter((item) => String(item.storeId) === String(row._id)).length,
        eligible: allArtworks.filter(
          (item) =>
            String(item.storeId) === String(row._id) &&
            item.status === "published" &&
            item.moderationStatus === "approved" &&
            item.isDemo !== true,
        ).length,
      })),
  };
  const sorted = [...durations].sort((a, b) => a - b);
  const report = {
    checkedAt: new Date().toISOString(),
    database: db.databaseName,
    store,
    subscriptions,
    total: records.length,
    eligible: records.filter((row) => row.eligible).length,
    records,
    integrity,
    query: {
      samples: 30,
      medianMs: sorted[15],
      p75Ms: sorted[22],
      executionTimeMillis: plan.executionStats.executionTimeMillis,
      examined: plan.executionStats.totalDocsExamined,
      returned: plan.executionStats.nReturned,
      winningPlan: plan.queryPlanner.winningPlan,
    },
  };
  if (destination) await writeFile(destination, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      { total: report.total, eligible: report.eligible, query: report.query, destination },
      null,
      2,
    ),
  );
} finally {
  await mongoose.disconnect();
}
