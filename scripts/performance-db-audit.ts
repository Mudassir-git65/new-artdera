import "dotenv/config";
import mongoose from "mongoose";
import { writeFile, mkdir } from "node:fs/promises";
import { resolveMongoConnectionUri } from "../server/lib/mongodb-srv";

const { uri } = await resolveMongoConnectionUri(process.env.MONGODB_URI!);
await mongoose.connect(uri, {
  dbName: process.env.MONGODB_DB_NAME ?? "artdera",
  autoIndex: false,
  autoCreate: false,
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
});
try {
  const db = mongoose.connection.db!;
  const collection = db.collection("artworks");
  const filter = {
    status: "published",
    moderationStatus: "approved",
    isDemo: { $ne: true },
    section: { $ne: "decora" },
  };
  const plan = await collection
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(25)
    .explain("executionStats");
  const stats = plan.executionStats;
  const result = {
    measuredAt: new Date().toISOString(),
    readOnly: true,
    artworks: await collection.estimatedDocumentCount(),
    indexes: (await collection.indexes()).map(({ name, key }) => ({ name, key })),
    catalogPage: {
      executionMs: stats.executionTimeMillis,
      returned: stats.nReturned,
      documentsExamined: stats.totalDocsExamined,
      keysExamined: stats.totalKeysExamined,
      plan: plan.queryPlanner.winningPlan,
    },
  };
  await mkdir(".performance", { recursive: true });
  await writeFile(
    process.argv[2] ?? ".performance/database-audit.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await mongoose.disconnect();
}
