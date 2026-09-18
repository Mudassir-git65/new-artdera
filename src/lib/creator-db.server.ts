import type { CreatorMetaResolved } from "./creator-meta";

export async function queryCreatorFromDatabase(cleanSlug: string): Promise<CreatorMetaResolved | null> {
  try {
    const mongoose = await import("mongoose");
    if (mongoose.default?.connection?.readyState === 1) {
      const { StoreModel, ArtistProfileModel, GalleryProfileModel, UserModel } = await import(
        "../../server/models"
      );

      const normalizedSlug = cleanSlug.trim().toLowerCase();

      // 1. Search by exact store slug
      let store = await StoreModel.findOne({ slug: normalizedSlug }).lean();

      // 2. Search by case-insensitive store slug or store name regex if not found by exact slug
      if (!store) {
        const escaped = normalizedSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const slugPattern = new RegExp(`^${escaped.replace(/[-_]+/g, "[-\\s_]*")}$`, "i");
        store = await StoreModel.findOne({
          $or: [{ slug: normalizedSlug }, { name: slugPattern }],
        }).lean();
      }

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

          if (!profileImg) {
            const userObj = await UserModel.findById(store.ownerId).select("avatarUrl").lean();
            if (userObj?.avatarUrl) profileImg = userObj.avatarUrl;
          }
        }

        return {
          name,
          slug: normalizedSlug,
          bio,
          profileImage: profileImg,
          coverImage: coverImg,
          location: [store.city, store.country].filter(Boolean).join(", "),
          verified: store.verificationStatus === "approved",
        };
      }

      // 3. Search directly by ArtistProfileModel displayName if store record not found
      const escapedName = normalizedSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const namePattern = new RegExp(`^${escapedName.replace(/[-_]+/g, "[-\\s_]*")}$`, "i");
      const artist = await ArtistProfileModel.findOne({ displayName: namePattern }).lean();
      if (artist) {
        let bio = artist.shortBio || artist.fullBio;
        let profileImg = artist.profileImageUrl;
        let coverImg = artist.coverImageUrl;
        if (!profileImg && artist.userId) {
          const userObj = await UserModel.findById(artist.userId).select("avatarUrl").lean();
          if (userObj?.avatarUrl) profileImg = userObj.avatarUrl;
        }

        return {
          name: artist.displayName,
          slug: normalizedSlug,
          bio,
          profileImage: profileImg,
          coverImage: coverImg,
          location: [artist.city, artist.country].filter(Boolean).join(", "),
          verified: artist.verificationBadge || artist.verificationStatus === "approved",
        };
      }
    }
  } catch (error) {
    console.error("queryCreatorFromDatabase error:", error);
  }
  return null;
}
