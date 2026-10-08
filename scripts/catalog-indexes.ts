import "dotenv/config";
import mongoose from "mongoose";

// Additive migration only. Does not call syncIndexes, drop an index, or modify artwork records.
await mongoose.connect(process.env.MONGODB_URI!, {
  dbName: process.env.MONGODB_DB_NAME ?? "artdera",
  autoIndex: false,
  autoCreate: false,
});
try {
  const db = mongoose.connection.db!;
  const indexes = [
    {
      key: { status: 1, moderationStatus: 1, createdAt: -1, _id: -1 },
      name: "status_1_moderationStatus_1_createdAt_-1__id_-1",
    },
    {
      key: { storeId: 1, status: 1, moderationStatus: 1, createdAt: -1, _id: -1 },
      name: "storeId_1_status_1_moderationStatus_1_createdAt_-1__id_-1",
    },
    {
      key: { status: 1, moderationStatus: 1, price: 1, _id: 1 },
      name: "status_1_moderationStatus_1_price_1__id_1",
    },
    { key: { slugAliases: 1 }, name: "slugAliases_1" },
  ] as const;
  if (process.argv.includes("--apply")) {
    console.log(await db.collection("artworks").createIndexes([...indexes]));
    console.log(
      await db.collection("stores").createIndex({ slugAliases: 1 }, { name: "slugAliases_1" }),
    );
  } else console.log(JSON.stringify({ database: db.databaseName, proposed: indexes }, null, 2));
} finally {
  await mongoose.disconnect();
}
