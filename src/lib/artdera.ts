import art1 from "@/assets/art-1.jpg";
import art2 from "@/assets/art-2.jpg";
import art3 from "@/assets/art-3.jpg";
import art4 from "@/assets/art-4.jpg";
import art5 from "@/assets/art-5.jpg";
import art6 from "@/assets/art-6.jpg";
import creator1 from "@/assets/artist.png";
import creator2 from "@/assets/creator-2.jpg";
import creator3 from "@/assets/creator-3.jpg";
import heroInterior from "@/assets/hero-interior.jpg";
import heroStudio from "@/assets/hero-studio.jpg";
import roomDining from "@/assets/room-dining.jpg";
import { CATEGORIES_LIST } from "./taxonomy";

export const IMAGES = {
  art1,
  art2,
  art3,
  art4,
  art5,
  art6,
  creator1,
  creator2,
  creator3,
  heroInterior,
  heroStudio,
  roomDining,
};

export type Category = { slug: string; name: string; blurb: string; image: string };
export type Creator = {
  store?: import("../marketplace/types").Store;
  slug: string;
  name: string;
  handle: string;
  location: string;
  discipline: string;
  bio: string;
  verified: boolean;
  accountType: "artist" | "gallery";
  approvedSeller: boolean;
  planId?: "free" | "professional" | "gallery";
  subscriptionStatus?: string;
  subscriptionExpiresAt?: string;
  portrait: string;
  works: string[];
};
export type Product = {
  id?: string;
  creatorName?: string;
  artwork?: import("../marketplace/types").Artwork;
  slug: string;
  title: string;
  creatorSlug: string;
  categorySlug: string;
  price: number;
  currency: "PKR";
  kind: "Original" | "Limited Edition" | "Open Edition" | "Handmade" | "AI-assisted";
  editionOf?: number;
  medium: string;
  dimensions: string;
  year: number;
  framed: boolean;
  colours: string[];
  style?: string;
  subject?: string;
  tags?: string[];
  room: string[];
  description: string;
  story?: { text: string; updatedAt?: string };
  images: string[];
  featured?: boolean;
  new?: boolean;
};
export type EditorialCollection = {
  slug: string;
  name: string;
  blurb: string;
  products: string[];
  cover: string;
};

// ---------------------------------------------------------------------------
// Stable fallback category images — using Unsplash Source for reliable URLs.
// These are overwritten by live /api/bootstrap data when available.
// ---------------------------------------------------------------------------
const UNSPLASH = {
  originals:
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=50&auto=format&fit=crop",
  calligraphy:
    "https://images.unsplash.com/photo-1588497859490-85d1c17db96d?w=400&q=50&auto=format&fit=crop",
  photography:
    "https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?w=400&q=50&auto=format&fit=crop",
  prints:
    "https://images.unsplash.com/photo-1549289524-06cf8837ace5?w=400&q=50&auto=format&fit=crop",
  decor:
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&q=50&auto=format&fit=crop",
  commissions:
    "https://images.unsplash.com/photo-1503428593586-e225b39bcd26?w=400&q=50&auto=format&fit=crop",
};

// ---------------------------------------------------------------------------
// Public taxonomy can render without marketplace inventory. Seller and artwork
// arrays intentionally start empty so sample content can never be mistaken for
// genuine production listings while the live catalog is loading.
// ---------------------------------------------------------------------------
const SEED_CATEGORIES: Category[] = CATEGORIES_LIST.map((name) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // We match existing unsplash images where possible, else fallback to a default one.
  let image = UNSPLASH.originals;
  if (slug.includes("calligraphy")) image = UNSPLASH.calligraphy;
  if (slug.includes("photo")) image = UNSPLASH.photography;
  if (slug.includes("print")) image = UNSPLASH.prints;
  if (slug.includes("decor") || slug.includes("ceramic") || slug.includes("sculpt"))
    image = UNSPLASH.decor;

  return {
    slug,
    name,
    blurb: `Discover original ${name.toLowerCase()} from verified creators.`,
    image,
  };
});

// Room names are presentation filters rather than marketplace records.
export const ROOMS = [
  { slug: "living-room", name: "Living Room", image: heroInterior },
  { slug: "bedroom", name: "Bedroom", image: art1 },
  { slug: "dining", name: "Dining", image: roomDining },
  { slug: "office", name: "Office", image: art4 },
  { slug: "hospitality", name: "Hospitality", image: heroStudio },
  { slug: "small-spaces", name: "Small Spaces", image: art5 },
];

function replace<T>(target: T[], source: T[]) {
  target.splice(0, target.length, ...source);
}

// Pre-seeded with fallback data — overwritten by /api/bootstrap when available.
export const CATEGORIES: Category[] = [...SEED_CATEGORIES];
// Pre-seeded with sample data — overwritten by /api/bootstrap when available so artwork renders immediately.
export const CREATORS: Creator[] = [];
export const PRODUCTS: Product[] = [];
export const COLLECTIONS: EditorialCollection[] = [];

export function hydrateEditorialData(input: {
  categories: Category[];
  creators: Creator[];
  products: Product[];
  collections: EditorialCollection[];
}) {
  replace(CATEGORIES, input.categories);
  replace(CREATORS, input.creators);
  replace(PRODUCTS, input.products);
  replace(COLLECTIONS, input.collections);
}

export function getProduct(slug: string) {
  return PRODUCTS.find((product) => product.slug === slug);
}
export function getCreator(slug: string) {
  return CREATORS.find((creator) => creator.slug === slug);
}
export function getCategory(slug: string) {
  return CATEGORIES.find((category) => category.slug === slug);
}
export function productsByCreator(slug: string) {
  return PRODUCTS.filter((product) => product.creatorSlug === slug);
}
export function productsByCategory(slug: string) {
  return PRODUCTS.filter((product) => product.categorySlug === slug);
}
export function formatPKR(value: number) {
  return "PKR " + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export const SOCIAL_LINKS = [
  {
    name: "YouTube",
    href: "https://www.youtube.com/@ArtDera",
    handle: "@ArtDera",
    description: "Watch studio tours, artist spotlights, and calligraphy demonstrations.",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/artdera.official/",
    handle: "@artdera.official",
    description: "Daily artwork features, behind the scenes, and interior inspiration.",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/artdera",
    handle: "ArtDera",
    description: "Company news, trade partnerships, and creator ecosystem updates.",
  },
  {
    name: "Facebook",
    href: "https://facebook.com/artdera",
    handle: "@artdera",
    description: "Community announcements, event highlights, and collection releases.",
  },
] as const;
