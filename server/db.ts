import mongoose from "mongoose";
import { getEnv } from "./config/env";
import { resolveMongoConnectionUri } from "./lib/mongodb-srv";

declare global {
  var __artderaMongoose:
    { connection: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cache = globalThis.__artderaMongoose ?? { connection: null, promise: null };
globalThis.__artderaMongoose = cache;

export async function connectDatabase() {
  if (cache.connection && mongoose.connection.readyState === 1) return cache.connection;
  if (!cache.promise) {
    const env = getEnv();
    cache.promise = resolveMongoConnectionUri(env.MONGODB_URI)
      .then(({ source, uri }) => {
        if (source === "dns-over-https")
          process.stdout.write("Database seed list resolved through the secure DNS fallback.\n");
        return mongoose.connect(uri, {
          dbName: env.MONGODB_DB_NAME,
          serverSelectionTimeoutMS: 10_000,
          connectTimeoutMS: 10_000,
          maxPoolSize: env.NODE_ENV === "production" ? 10 : 20,
          // A non-zero minimum pool multiplies connections across serverless
          // instances and can quickly exhaust an Atlas connection limit.
          minPoolSize: 0,
          sanitizeFilter: true,
        });
      })
      .catch((error) => {
        cache.promise = null;
        throw error;
      });
  }
  cache.connection = await cache.promise;
  return cache.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  cache.connection = null;
  cache.promise = null;
}
