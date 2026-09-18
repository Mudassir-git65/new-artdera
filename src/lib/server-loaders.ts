import { createServerFn } from "@tanstack/react-start";
import type { Creator, Product, Category, EditorialCollection } from "./artdera";

// Sample fallbacks to ensure rendering never fails during SSR
const SAMPLE_CREATORS: Creator[] = [
  {
    slug: "sana-mirza",
    name: "Sana Mirza",
    handle: "@sanamirza",
    location: "Lahore, Pakistan",
    discipline: "Oil painting",
    bio: "Sana Mirza's canvases are exercises in remembered light — warm amber rooms, slow afternoons, and the weight of colour held at the edge of a brushstroke. Based in Lahore's old city, she works predominantly in oil on linen.",
    verified: true,
    accountType: "artist",
    approvedSeller: true,
    portrait: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80&auto=format",
    works: ["quiet-horizon", "pomegranate-study", "afternoon-in-amber"],
  },
  {
    slug: "omar-farooq",
    name: "Omar Farooq",
    handle: "@omarfarooq.art",
    location: "Karachi, Pakistan",
    discipline: "Calligraphy & ink",
    bio: "Omar's practice bridges classical Nastaliq calligraphy and contemporary abstraction. His work has been shown in galleries across Karachi, Dubai and London.",
    verified: true,
    accountType: "artist",
    approvedSeller: true,
    portrait: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80&auto=format",
    works: ["silence-in-script", "noor-on-black", "bismillah-cobalt"],
  },
  {
    slug: "ayla-hussain",
    name: "Ayla Hussain",
    handle: "@aylahussain",
    location: "Islamabad, Pakistan",
    discipline: "Photography",
    bio: "Documentary photographer and printmaker. Ayla's fine-art editions focus on the intersection of architecture, natural light and the Pakistani landscape.",
    verified: true,
    accountType: "artist",
    approvedSeller: true,
    portrait: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80&auto=format",
    works: ["morning-mist-margalla", "the-red-door", "winter-katas"],
  },
];

const SAMPLE_PRODUCTS: Product[] = [
  {
    slug: "quiet-horizon",
    title: "Quiet Horizon",
    creatorSlug: "sana-mirza",
    categorySlug: "originals",
    price: 85000,
    currency: "PKR",
    kind: "Original",
    medium: "Oil on linen",
    dimensions: "91 × 71 inches",
    year: 2024,
    framed: false,
    colours: ["ivory", "stone", "terracotta"],
    room: ["living room", "bedroom", "office"],
    description:
      "A meditation on stillness — pale fields of ochre and bone interrupted by a single horizon of terracotta. Unframed, ready for your choice of presentation.",
    story: {
      text: "I began this piece while watching the first monsoon rain from my studio window.",
    },
    images: [
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80&auto=format",
    ],
    featured: true,
  },
  {
    slug: "silence-in-script",
    title: "Silence in Script",
    creatorSlug: "omar-farooq",
    categorySlug: "calligraphy",
    price: 42000,
    currency: "PKR",
    kind: "Original",
    medium: "Ink on wasli",
    dimensions: "56 × 76 inches",
    year: 2023,
    framed: true,
    colours: ["ink", "ivory"],
    room: ["living room", "office", "dining room"],
    description:
      "Nastaliq script dissolves into abstraction at the edges — a single word repeated until it becomes texture rather than language.",
    images: [
      "https://images.unsplash.com/photo-1588497859490-85d1c17db96d?w=1200&q=80&auto=format",
    ],
    featured: true,
  },
];

/**
 * Fetch a single product/artwork by slug from MongoDB (with sample fallback)
 */
export const fetchProductBySlug = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const cleanSlug = slug.trim().toLowerCase();
    try {
      const mongoose = await import("mongoose");
      if (mongoose.default?.connection?.readyState === 1) {
        const { ArtworkModel, StoreModel, ArtistProfileModel, GalleryProfileModel } = await import(
          "../../server/models"
        );
        const art = await ArtworkModel.findOne({
          slug: cleanSlug,
          status: { $in: ["published", "reserved", "sold"] },
        }).lean();

        if (art) {
          const store = await StoreModel.findById(art.storeId).lean();
          let creatorSlug = store?.slug || "independent-artist";

          let kindVal: Product["kind"] = "Original";
          if (art.artworkType === "print") kindVal = "Open Edition";
          if (art.artworkType === "limited_edition") kindVal = "Limited Edition";

          const mainImage = art.images?.[0]?.url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80&auto=format";
          const allImages = (art.images || []).map((i: { url: string }) => i.url);

          return {
            slug: art.slug,
            title: art.title,
            creatorSlug,
            creatorName: store?.name || "Independent Creator",
            categorySlug: art.category?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "originals",
            price: art.price,
            currency: "PKR" as const,
            kind: kindVal,
            editionOf: art.editionTotal,
            medium: art.medium || "Mixed media",
            dimensions: art.width && art.height ? `${art.width} × ${art.height} ${art.measurementUnit || "cm"}` : "Custom dimensions",
            year: art.yearCreated || new Date(art.createdAt).getFullYear(),
            framed: Boolean(art.isFramed),
            colours: art.colours || ["ivory"],
            style: art.style,
            subject: art.subject,
            tags: art.tags || [],
            room: art.themes || ["living room"],
            description: art.description || "",
            story: art.story?.text ? { text: art.story.text } : undefined,
            images: allImages.length > 0 ? allImages : [mainImage],
            featured: Boolean(art.isSponsored),
          };
        }
      }
    } catch (err) {
      console.error("fetchProductBySlug server error:", err);
    }

    // Fallback to sample data
    return SAMPLE_PRODUCTS.find((p) => p.slug === cleanSlug) || null;
  });

/**
 * Fetch a list of products/artworks from MongoDB
 */
export const fetchProductsList = createServerFn({ method: "GET" })
  .validator((query?: { category?: string; creatorSlug?: string; limit?: number }) => query)
  .handler(async ({ data: query }) => {
    try {
      const mongoose = await import("mongoose");
      if (mongoose.default?.connection?.readyState === 1) {
        const { ArtworkModel, StoreModel } = await import("../../server/models");
        const filter: Record<string, unknown> = {
          status: { $in: ["published", "reserved", "sold"] },
          moderationStatus: { $ne: "rejected" },
        };

        if (query?.creatorSlug) {
          const store = await StoreModel.findOne({ slug: query.creatorSlug.toLowerCase() }).lean();
          if (store) filter.storeId = store._id;
        }

        const limit = query?.limit || 40;
        const artworks = await ArtworkModel.find(filter)
          .select("title slug price medium width height measurementUnit yearCreated isFramed colours images isSponsored storeId category artworkType createdAt description story")
          .sort({ isSponsored: -1, createdAt: -1 })
          .limit(limit)
          .lean();

        if (artworks.length > 0) {
          const storeIds = Array.from(new Set(artworks.map((a) => a.storeId.toString())));
          const stores = await StoreModel.find({ _id: { $in: storeIds } }).select("_id slug name").lean();
          const storeMap = new Map(stores.map((s) => [s._id.toString(), s]));

          return artworks.map((art) => {
            const store = storeMap.get(art.storeId.toString());
            let kindVal: Product["kind"] = "Original";
            if (art.artworkType === "print") kindVal = "Open Edition";
            if (art.artworkType === "limited_edition") kindVal = "Limited Edition";

            const images = (art.images || []).map((i: { url: string }) => i.url);
            if (images.length === 0) {
              images.push("https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=75&auto=format");
            }

            return {
              slug: art.slug,
              title: art.title,
              creatorSlug: store?.slug || "independent-artist",
              creatorName: store?.name || "Independent Creator",
              categorySlug: art.category?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "originals",
              price: art.price,
              currency: "PKR" as const,
              kind: kindVal,
              medium: art.medium || "Mixed media",
              dimensions: art.width && art.height ? `${art.width} × ${art.height} ${art.measurementUnit || "cm"}` : "Standard",
              year: art.yearCreated || new Date(art.createdAt).getFullYear(),
              framed: Boolean(art.isFramed),
              colours: art.colours || ["ivory"],
              room: ["living room"],
              description: art.description || "",
              images,
              featured: Boolean(art.isSponsored),
            };
          });
        }
      }
    } catch (err) {
      console.error("fetchProductsList server error:", err);
    }

    let list = SAMPLE_PRODUCTS;
    if (query?.creatorSlug) {
      list = list.filter((p) => p.creatorSlug === query.creatorSlug);
    }
    return list;
  });

/**
 * Fetch creators / stores list from MongoDB
 */
export const fetchCreatorsList = createServerFn({ method: "GET" })
  .validator((query?: { limit?: number; type?: "artist" | "gallery" }) => query)
  .handler(async ({ data: query }) => {
    try {
      const mongoose = await import("mongoose");
      if (mongoose.default?.connection?.readyState === 1) {
        const { StoreModel, ArtistProfileModel, GalleryProfileModel } = await import("../../server/models");
        const storeFilter: Record<string, unknown> = {
          isPublished: true,
          status: "active",
        };
        if (query?.type) storeFilter.ownerType = query.type;

        const limit = query?.limit || 30;
        const stores = await StoreModel.find(storeFilter)
          .select("name slug tagline shortDescription fullDescription logoUrl coverImageUrl city country verificationStatus ownerId ownerType")
          .sort({ totalFollowers: -1, createdAt: -1 })
          .limit(limit)
          .lean();

        if (stores.length > 0) {
          const ownerIds = stores.map((s) => s.ownerId);
          const artistProfiles = await ArtistProfileModel.find({ userId: { $in: ownerIds } }).lean();
          const galleryProfiles = await GalleryProfileModel.find({ userId: { $in: ownerIds } }).lean();

          const artistMap = new Map(artistProfiles.map((a) => [a.userId.toString(), a]));
          const galleryMap = new Map(galleryProfiles.map((g) => [g.userId.toString(), g]));

          return stores.map((store) => {
            let bio = store.shortDescription || store.fullDescription || store.tagline || "";
            let portrait = store.logoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80&auto=format";
            let discipline = "Visual Artist";

            if (store.ownerType === "artist") {
              const profile = artistMap.get(store.ownerId.toString());
              if (profile) {
                if (profile.shortBio || profile.fullBio) bio = profile.shortBio || profile.fullBio;
                if (profile.profileImageUrl) portrait = profile.profileImageUrl;
                if (profile.professionalTitle) discipline = profile.professionalTitle;
                else if (profile.mediums?.[0]) discipline = profile.mediums[0];
              }
            } else if (store.ownerType === "gallery") {
              const profile = galleryMap.get(store.ownerId.toString());
              if (profile) {
                if (profile.description) bio = profile.description;
                if (profile.logoUrl) portrait = profile.logoUrl;
                discipline = "Art Gallery";
              }
            }

            return {
              slug: store.slug,
              name: store.name,
              handle: `@${store.slug}`,
              location: [store.city, store.country].filter(Boolean).join(", ") || "Pakistan",
              discipline,
              bio,
              verified: store.verificationStatus === "approved",
              accountType: store.ownerType as "artist" | "gallery",
              approvedSeller: true,
              portrait,
              works: [],
            };
          });
        }
      }
    } catch (err) {
      console.error("fetchCreatorsList server error:", err);
    }

    return SAMPLE_CREATORS;
  });
