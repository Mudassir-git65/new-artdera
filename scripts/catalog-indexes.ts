import "dotenv/config";
import mongoose from "mongoose";
import { resolveMongoConnectionUri } from "../server/lib/mongodb-srv";

// Additive migration only. Does not call syncIndexes, drop an index, or modify artwork records.
const { uri } = await resolveMongoConnectionUri(process.env.MONGODB_URI!);
await mongoose.connect(uri, {
  dbName: process.env.MONGODB_DB_NAME ?? "artdera",
  autoIndex: false,
  autoCreate: false,
  serverSelectionTimeoutMS: 10_000,
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
    {
      key: { status: 1, moderationStatus: 1, discountPrice: 1, _id: 1 },
      name: "status_1_moderationStatus_1_discountPrice_1__id_1",
    },
    {
      key: { status: 1, moderationStatus: 1, views: -1, wishlistCount: -1, _id: -1 },
      name: "status_1_moderationStatus_1_views_-1_wishlistCount_-1__id_-1",
    },
    {
      key: { section: 1, status: 1, moderationStatus: 1, decoraCategory: 1, price: 1 },
      name: "section_1_status_1_moderationStatus_1_decoraCategory_1_price_1",
    },
    {
      key: { section: 1, status: 1, moderationStatus: 1, decoraPrice: 1, _id: 1 },
      name: "section_1_status_1_moderationStatus_1_decoraPrice_1__id_1",
    },
  ] as const;
  if (process.argv.includes("--apply")) {
    console.log(await db.collection("artworks").createIndexes([...indexes]));
    console.log(
      await db.collection("stores").createIndex({ slugAliases: 1 }, { name: "slugAliases_1" }),
    );
    console.log(
      await db
        .collection("stores")
        .createIndexes([
          { key: { isPublished: 1, status: 1, ownerType: 1, createdAt: -1, _id: -1 } },
          { key: { isPublished: 1, status: 1, createdAt: -1, _id: -1 } },
        ]),
    );
    console.log(await db.collection("uploadImageVariants").createIndex({ publicId: 1 }));
  } else console.log(JSON.stringify({ database: db.databaseName, proposed: indexes }, null, 2));
} finally {
  await mongoose.disconnect();
}
