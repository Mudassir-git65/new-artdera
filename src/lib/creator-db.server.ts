import type { CreatorMetaResolved } from "./creator-meta";

export async function queryCreatorFromDatabase(cleanSlug: string): Promise<CreatorMetaResolved | null> {
  try {
    const mongoose = await import("mongoose");
    if (mongoose.default?.connection?.readyState === 1) {
      const { StoreModel, ArtistProfileModel, GalleryProfileModel } = await import(
        "../../server/models"
      );
      const store = await StoreModel.findOne({ slug: cleanSlug }).lean();
      if (store) {
        let profileImg = store.logoUrl;
        let coverImg = store.coverImageUrl;
        let bio = store.shortDescription || store.fullDescription || store.tagline;
        let name = store.name;

        if (store.ownerId) {
          if (store.ownerType === "artist") {
            const artistProfile = await ArtistProfileModel.findOne({
              userId: store.ownerId,
            }).lean();
            if (artistProfile) {
              if (artistProfile.displayName) name = artistProfile.displayName;
              if (artistProfile.shortBio || artistProfile.fullBio)
                bio = artistProfile.shortBio || artistProfile.fullBio;
              if (artistProfile.profileImageUrl) profileImg = artistProfile.profileImageUrl;
              if (artistProfile.coverImageUrl) coverImg = artistProfile.coverImageUrl;
            }
          } else if (store.ownerType === "gallery") {
            const galleryProfile = await GalleryProfileModel.findOne({
              userId: store.ownerId,
            }).lean();
            if (galleryProfile) {
              if (galleryProfile.galleryName) name = galleryProfile.galleryName;
              if (galleryProfile.description) bio = galleryProfile.description;
              if (galleryProfile.logoUrl) profileImg = galleryProfile.logoUrl;
              if (galleryProfile.coverImageUrl) coverImg = galleryProfile.coverImageUrl;
            }
          }
        }

        return {
          name,
          slug: cleanSlug,
          bio,
          profileImage: profileImg,
          coverImage: coverImg,
          location: [store.city, store.country].filter(Boolean).join(", "),
          verified: store.verificationStatus === "approved",
        };
      }
    }
  } catch {
    // Ignore DB errors
  }
  return null;
}
