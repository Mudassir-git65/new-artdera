import { generateCreatorStoreSocialMeta } from "./seo";

export interface CreatorMetaResolved {
  name: string;
  slug: string;
  bio?: string;
  profileImage?: string;
  coverImage?: string;
  location?: string;
  verified?: boolean;
}

// Static sample creators used as fallbacks when MongoDB is not connected
const SAMPLE_CREATORS: Array<{
  slug: string;
  name: string;
  location: string;
  discipline: string;
  bio: string;
  verified: boolean;
  portrait: string;
  cover?: string;
}> = [
  {
    slug: "sana-mirza",
    name: "Sana Mirza",
    location: "Lahore, Pakistan",
    discipline: "Oil painting",
    bio: "Sana Mirza's canvases are exercises in remembered light — warm amber rooms, slow afternoons, and the weight of colour held at the edge of a brushstroke. Based in Lahore's old city, she works predominantly in oil on linen.",
    verified: true,
    portrait: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80&auto=format",
    cover: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80&auto=format",
  },
  {
    slug: "omar-farooq",
    name: "Omar Farooq",
    location: "Karachi, Pakistan",
    discipline: "Calligraphy & ink",
    bio: "Omar's practice bridges classical Nastaliq calligraphy and contemporary abstraction. His work has been shown in galleries across Karachi, Dubai and London.",
    verified: true,
    portrait: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80&auto=format",
    cover: "https://images.unsplash.com/photo-1588497859490-85d1c17db96d?w=1200&q=80&auto=format",
  },
  {
    slug: "ayla-hussain",
    name: "Ayla Hussain",
    location: "Islamabad, Pakistan",
    discipline: "Photography",
    bio: "Documentary photographer and printmaker. Ayla's fine-art editions focus on the intersection of architecture, natural light and the Pakistani landscape.",
    verified: true,
    portrait: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80&auto=format",
    cover: "https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?w=1200&q=80&auto=format",
  },
  {
    slug: "ayesha-khan",
    name: "Ayesha Khan",
    location: "Lahore, Pakistan",
    discipline: "Miniature Painting",
    bio: "Ayesha Khan creates contemporary miniature paintings blending traditional gouache on Wasli paper with modern geometric narratives.",
    verified: true,
    portrait: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80&auto=format",
    cover: "https://images.unsplash.com/photo-1503428593586-e225b39bcd26?w=1200&q=80&auto=format",
  },
];

/**
 * Resolves creator/store data by slug from MongoDB (if server-side & database ready),
 * seeded static creators/stores, or title-case fallbacks.
 */
export async function getCreatorOrStoreResolved(
  slug: string,
  routePrefix: "store" | "creator" = "store",
): Promise<CreatorMetaResolved> {
  const cleanSlug = slug.trim().toLowerCase();

  // 1. Try server-side MongoDB lookup if running on Server (Node environment)
  if (typeof window === "undefined") {
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

          // Populate profile details from ArtistProfile or GalleryProfile if available
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
      // Fallthrough to sample/seed lookup if DB is unavailable or during build
    }
  }

  // 2. Check sample creator seed dataset
  const sampleCreator = SAMPLE_CREATORS.find((item) => item.slug === cleanSlug);
  if (sampleCreator) {
    return {
      name: sampleCreator.name,
      slug: cleanSlug,
      bio: sampleCreator.bio,
      profileImage: sampleCreator.portrait,
      coverImage: sampleCreator.cover,
      location: sampleCreator.location,
      verified: sampleCreator.verified,
    };
  }

  // 3. Fallback: formatted title from slug
  const titleName = decodeURIComponent(cleanSlug)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    name: titleName,
    slug: cleanSlug,
    bio: `Discover original artwork by ${titleName} on ArtDera.`,
  };
}

/**
 * Generates full head metadata (openGraph, twitter, title, canonical) for a creator/store route.
 */
export async function getCreatorStoreHeadMeta(
  slug: string,
  routePrefix: "store" | "creator" = "store",
) {
  const resolved = await getCreatorOrStoreResolved(slug, routePrefix);
  return generateCreatorStoreSocialMeta({
    name: resolved.name,
    slug: resolved.slug,
    bio: resolved.bio,
    profileImage: resolved.profileImage,
    coverImage: resolved.coverImage,
    routePrefix,
  });
}
