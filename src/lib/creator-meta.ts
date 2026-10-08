import { createServerFn, createIsomorphicFn } from "@tanstack/react-start";
import { generateCreatorStoreSocialMeta } from "./seo";

export interface CreatorMetaResolved {
  name: string;
  slug: string;
  bio?: string;
  profileImage?: string;
  coverImage?: string;
  location?: string;
  verified?: boolean;
  discipline?: string;
  planId?: "professional";
  subscriptionStatus?: string;
  subscriptionExpiresAt?: string;
}

export const fetchCreatorFromDatabase = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    if (typeof data === "string") return data;
    if (
      typeof data === "object" &&
      data !== null &&
      "data" in data &&
      typeof (data as any).data === "string"
    ) {
      return (data as any).data;
    }
    return String(data || "");
  })
  .handler(async ({ data: slug }) => {
    const { queryCreatorFromDatabase } = await import("./creator-db.server");
    return await queryCreatorFromDatabase(slug);
  });

const resolveCreatorDbIsomorphic = createIsomorphicFn()
  .server(async (cleanSlug: string) => {
    const { queryCreatorFromDatabase } = await import("./creator-db.server");
    return await queryCreatorFromDatabase(cleanSlug);
  })
  .client(async (cleanSlug: string) => {
    return await fetchCreatorFromDatabase({ data: cleanSlug });
  });

/**
 * Resolves published creator/store metadata from the authoritative database.
 */
export async function getCreatorOrStoreResolved(
  slug: string,
  routePrefix: "store" | "creator" = "store",
): Promise<CreatorMetaResolved> {
  const cleanSlug = slug.trim().toLowerCase();

  const record = await resolveCreatorDbIsomorphic(cleanSlug);
  if (!record) throw new Error("Creator not found");
  return record;
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
