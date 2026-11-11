import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession, type Schema } from "mongoose";
import { AsyncCache } from "./async-cache";

const cache = new AsyncCache<unknown>(200, 24 * 1024 * 1024);
let revisionRead: Promise<string> | undefined;
type Revision = { _id: string; version: string };
const revisions = () => mongoose.connection.db!.collection<Revision>("catalogRevisions");

export function clearCatalogCache() {
  revisionRead = undefined;
  cache.clear();
}

// No TTL on the revision read: a warm instance still checks MongoDB on EVERY
// request, so another instance's completed edit invalidates its entries too.
// Concurrent readers share just the outstanding revision query.
async function currentRevision() {
  if (!revisionRead) {
    revisionRead = revisions()
      .findOne({ _id: "public" })
      .then((row) => row?.version ?? "empty")
      .finally(() => {
        revisionRead = undefined;
      });
  }
  return revisionRead;
}

export async function cachedCatalog<T>(
  key: string,
  load: () => Promise<T>,
  ttl = 60_000,
): Promise<T> {
  const version = await currentRevision();
  // TTL also bounds changes made outside Mongoose and time-based promotions
  // or subscription expiration. Financial mutations always read source data.
  return cache.get(`${version}:${key}`, ttl, load) as Promise<T>;
}

async function invalidateCatalog(session?: ClientSession | null) {
  await revisions().updateOne(
    { _id: "public" },
    { $set: { version: randomUUID() } },
    { upsert: true, session: session ?? undefined },
  );
  clearCatalogCache();
}

const catalogModels = new Set([
  "Artwork",
  "Store",
  "ArtistProfile",
  "GalleryProfile",
  "Collection",
  "Subscription",
  "SubscriptionPlan",
  "Taxonomy",
  "Promotion",
  "User",
  "Exhibition",
  "SystemSetting",
]);

/** Install before model compilation. Transactional invalidation commits with the write. */
export function registerCatalogInvalidation(name: string, schema: Schema) {
  if (!catalogModels.has(name)) return;
  schema.post("save", async function (document) {
    await invalidateCatalog(document.$session());
  });
  schema.post("insertMany", async function (result) {
    // Mongoose's declaration incorrectly types this result as a Model.
    const documents = result as unknown as mongoose.HydratedDocument<any>[];
    if (documents.length) await invalidateCatalog(documents[0].$session?.());
  });
  schema.post(
    [
      "updateOne",
      "updateMany",
      "replaceOne",
      "findOneAndUpdate",
      "findOneAndReplace",
      "findOneAndDelete",
      "deleteOne",
      "deleteMany",
    ],
    async function (result) {
      if (!result) return;
      if ("modifiedCount" in result && result.modifiedCount === 0 && !result.upsertedCount) return;
      if ("deletedCount" in result && result.deletedCount === 0) return;
      const update = this.getUpdate();
      // High-volume analytics counters do not change inventory, price or content.
      // They can age for at most the 60-second data TTL.
      if (update && !Array.isArray(update)) {
        const fields = Object.entries(update).flatMap(([key, value]) =>
          key.startsWith("$") && value && typeof value === "object" ? Object.keys(value) : [key],
        );
        if (
          fields.length &&
          fields.every((field) =>
            [
              "views",
              "totalViews",
              "messageCount",
              "wishlistCount",
              "updatedAt",
              "lastLoginAt",
              "failedLoginAttempts",
            ].includes(field),
          )
        )
          return;
      }
      await invalidateCatalog(this.getOptions().session);
    },
  );
  // Document.deleteOne uses a distinct middleware chain.
  schema.post("deleteOne", { document: true, query: false }, async function () {
    await invalidateCatalog(this.$session());
  });
}
