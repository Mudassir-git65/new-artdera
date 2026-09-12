import { randomBytes } from "node:crypto";
import { getEnv } from "../config/env";
import { connectDatabase, disconnectDatabase } from "../db";
import { seedDemoData, seedPlansAndTaxonomy } from "./seed-data";

function configuredEmail(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

function configuredPassword(name: string) {
  return process.env[name] || `${randomBytes(24).toString("base64url")}Aa1!`;
}

async function main() {
  const env = getEnv();
  await connectDatabase();
  await seedPlansAndTaxonomy();
  if (env.SEED_DEMO_DATA) {
    if (env.NODE_ENV === "production")
      throw new Error("Demo data seeding is disabled in production");
    await seedDemoData({
      artist: {
        email: configuredEmail("DEMO_ARTIST_EMAIL", "artist@artdera.demo"),
        password: configuredPassword("DEMO_ARTIST_PASSWORD"),
      },
      gallery: {
        email: configuredEmail("DEMO_GALLERY_EMAIL", "gallery@artdera.demo"),
        password: configuredPassword("DEMO_GALLERY_PASSWORD"),
      },
      buyer: {
        email: configuredEmail("DEMO_BUYER_EMAIL", "buyer@artdera.demo"),
        password: configuredPassword("DEMO_BUYER_PASSWORD"),
      },
      admin: {
        email: configuredEmail("DEMO_ADMIN_EMAIL", "admin@artdera.demo"),
        password: configuredPassword("DEMO_ADMIN_PASSWORD"),
      },
    });
  }
  process.stdout.write("ArtDera seed completed.\n");
  await disconnectDatabase();
}

void main().catch(async () => {
  process.stderr.write("ArtDera seed failed. Check configuration and required demo credentials.\n");
  await disconnectDatabase();
  process.exitCode = 1;
});
