import { connectDatabase, disconnectDatabase } from "../db";
import { ArtistProfileModel, StoreModel, UserModel, GalleryProfileModel } from "../models";

async function main() {
  console.log("Connecting to MongoDB...");
  await connectDatabase();

  const artistRes = await ArtistProfileModel.updateMany(
    { profileImageUrl: { $regex: /creator-1/i } },
    { $set: { profileImageUrl: "/images/artist.png" } },
  );
  console.log(`Updated ArtistProfiles: ${artistRes.modifiedCount}`);

  const storeRes = await StoreModel.updateMany(
    { logoUrl: { $regex: /creator-1/i } },
    { $set: { logoUrl: "/images/artist.png" } },
  );
  console.log(`Updated Stores: ${storeRes.modifiedCount}`);

  const userRes = await UserModel.updateMany(
    { avatarUrl: { $regex: /creator-1/i } },
    { $set: { avatarUrl: "/images/artist.png" } },
  );
  console.log(`Updated Users: ${userRes.modifiedCount}`);

  const galleryRes = await GalleryProfileModel.updateMany(
    { logoUrl: { $regex: /creator-1/i } },
    { $set: { logoUrl: "/images/artist.png" } },
  );
  console.log(`Updated GalleryProfiles: ${galleryRes.modifiedCount}`);

  console.log("Database image URLs updated successfully.");
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error("Failed to update database images:", err);
  await disconnectDatabase();
  process.exit(1);
});
