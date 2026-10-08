import "dotenv/config";
import mongoose from "mongoose";
import { writeFile } from "node:fs/promises";

// Identify the exact legacy seed fixtures before adding reversible provenance.
// No statuses, prices, subscriptions, ownership, or records are removed.
const fixtures = [
  {
    store: "ayla-raza-studio",
    owner: "Ayla Raza",
    email: process.env.DEMO_ARTIST_EMAIL ?? "artist@artdera.demo",
    works: [
      ["silent-geometry", "Silent Geometry", "/images/art-1.jpg"],
      ["monsoon-memory", "Monsoon Memory", "/images/art-2.jpg"],
      ["ochre-horizon", "Ochre Horizon", "/images/art-3.jpg"],
    ],
  },
  {
    store: "mehr-gallery",
    owner: "Mehr Gallery",
    email: process.env.DEMO_GALLERY_EMAIL ?? "gallery@artdera.demo",
    works: [
      ["city-after-rain", "City After Rain", "/images/art-4.jpg"],
      ["river-script", "River Script", "/images/art-5.jpg"],
      ["blue-interval", "Blue Interval", "/images/art-6.jpg"],
    ],
  },
];
await mongoose.connect(process.env.MONGODB_URI!, {
  dbName: process.env.MONGODB_DB_NAME ?? "artdera",
  autoIndex: false,
  autoCreate: false,
});
try {
  const db = mongoose.connection.db!;
  const plan: { collection: string; id: mongoose.Types.ObjectId; slug: string }[] = [];
  for (const fixture of fixtures) {
    const store = await db.collection("stores").findOne({ slug: fixture.store });
    if (!store) continue;
    const owner = await db.collection("users").findOne({ _id: store.ownerId });
    if (owner?.fullName !== fixture.owner || owner?.emailNormalized !== fixture.email.toLowerCase())
      throw new Error(`Seed ownership could not be verified for ${fixture.store}`);
    const works = await db.collection("artworks").find({ storeId: store._id }).toArray();
    if (
      works.length !== fixture.works.length ||
      !works.every((row) =>
        fixture.works.some(
          ([slug, title, image]) =>
            row.slug === slug && row.title === title && row.images?.[0]?.url === image,
        ),
      )
    )
      throw new Error(`Seed artwork content could not be verified for ${fixture.store}`);
    plan.push(
      { collection: "stores", id: store._id, slug: store.slug },
      ...works.map((row) => ({ collection: "artworks", id: row._id, slug: row.slug })),
    );
  }
  const artworkIds = plan
    .filter((row) => row.collection === "artworks")
    .map((row) => String(row.id));
  for (const [collection, slug, cover] of [
    ["collections", "new-pakistani-abstraction", "/images/art-1.jpg"],
    ["exhibitions", "lines-of-memory", "/images/hero-interior.jpg"],
  ]) {
    const row = await db.collection(collection).findOne({ slug });
    if (
      row &&
      row.coverImageUrl === cover &&
      row.artworkIds?.length &&
      row.artworkIds.every((id: unknown) => artworkIds.includes(String(id)))
    )
      plan.push({ collection, id: row._id, slug });
  }
  const apply = process.argv.includes("--apply");
  if (apply)
    for (const row of plan)
      await db
        .collection(row.collection)
        .updateOne({ _id: row.id, slug: row.slug }, { $set: { isDemo: true } });
  const report = { checkedAt: new Date().toISOString(), applied: apply, verifiedFixtures: plan };
  const destination = process.argv.find((arg) => arg.endsWith(".json"));
  if (destination) await writeFile(destination, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await mongoose.disconnect();
}
