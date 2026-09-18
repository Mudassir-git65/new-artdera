import { createServerFn } from "@tanstack/react-start";
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
    portrait: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=50&auto=format&fit=crop",
    cover: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=50&auto=format&fit=crop",
  },
  {
    slug: "omar-farooq",
    name: "Omar Farooq",
    location: "Karachi, Pakistan",
    discipline: "Calligraphy & ink",
    bio: "Omar's practice bridges classical Nastaliq calligraphy and contemporary abstraction. His work has been shown in galleries across Karachi, Dubai and London.",
    verified: true,
    portrait: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=50&auto=format&fit=crop",
    cover: "https://images.unsplash.com/photo-1588497859490-85d1c17db96d?w=800&q=50&auto=format&fit=crop",
  },
  {
    slug: "ayla-hussain",
    name: "Ayla Hussain",
    location: "Islamabad, Pakistan",
    discipline: "Photography",
    bio: "Documentary photographer and printmaker. Ayla's fine-art editions focus on the intersection of architecture, natural light and the Pakistani landscape.",
    verified: true,
    portrait: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&q=50&auto=format&fit=crop",
    cover: "https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?w=800&q=50&auto=format&fit=crop",
  },
  {
    slug: "ayesha-khan",
    name: "Ayesha Khan",
    location: "Lahore, Pakistan",
    discipline: "Miniature Painting",
    bio: "Ayesha Khan creates contemporary miniature paintings blending traditional gouache on Wasli paper with modern geometric narratives.",
    verified: true,
    portrait: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&q=50&auto=format&fit=crop",
    cover: "https://images.unsplash.com/photo-1503428593586-e225b39bcd26?w=800&q=50&auto=format&fit=crop",
  },
];

export const fetchCreatorFromDatabase = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    if (typeof data === "string") return data;
    if (typeof data === "object" && data !== null && "data" in data && typeof (data as any).data === "string") {
      return (data as any).data;
    }
    return String(data || "");
  })
  .handler(async ({ data: slug }) => {
    const { queryCreatorFromDatabase } = await import("./creator-db.server");
    return await queryCreatorFromDatabase(slug);
  });

/**
 * Resolves creator/store data by slug from MongoDB (via direct server query or server function),
 * seeded static creators/stores, or title-case fallbacks.
 */
export async function getCreatorOrStoreResolved(
  slug: string,
  routePrefix: "store" | "creator" = "store",
): Promise<CreatorMetaResolved> {
  const cleanSlug = slug.trim().toLowerCase();

  // 1. Direct DB lookup in Node server & test environment
  if (typeof window === "undefined") {
    try {
      const { queryCreatorFromDatabase } = await import("./creator-db.server");
      const directRecord = await queryCreatorFromDatabase(cleanSlug);
      if (directRecord) return directRecord;
    } catch {
      // Ignore server import error
    }
  }

  // 2. Try DB lookup via server function
  try {
    const dbRecord = await fetchCreatorFromDatabase({ data: cleanSlug });
    if (dbRecord) return dbRecord;
  } catch {
    // Ignore RPC failure
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
