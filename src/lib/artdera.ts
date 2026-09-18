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
  originals: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=50&auto=format&fit=crop",
  calligraphy:
    "https://images.unsplash.com/photo-1588497859490-85d1c17db96d?w=400&q=50&auto=format&fit=crop",
  photography:
    "https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?w=400&q=50&auto=format&fit=crop",
  prints: "https://images.unsplash.com/photo-1549289524-06cf8837ace5?w=400&q=50&auto=format&fit=crop",
  decor: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&q=50&auto=format&fit=crop",
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
    portrait: creator1,
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
    portrait: creator2,
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
    portrait: creator3,
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
      text: "I began this piece while watching the first monsoon rain from my studio window. The smell of wet earth immediately reminded me of childhood evenings spent at my grandparents’ home.\n\nI wanted the layers of blue and muted gold to capture that strange feeling of remembering somewhere that no longer exists exactly as you remember it.\n\nFor me, this work is less about rain and more about the places we continue carrying with us.",
    },
    images: [art1, art3],
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
    images: [art2, art4],
    featured: true,
  },
  {
    slug: "pomegranate-study",
    title: "Pomegranate Study",
    creatorSlug: "sana-mirza",
    categorySlug: "originals",
    price: 28000,
    currency: "PKR",
    kind: "Original",
    medium: "Oil on board",
    dimensions: "30 × 30 inches",
    year: 2024,
    framed: false,
    colours: ["oxblood", "terracotta", "ivory"],
    room: ["dining room", "kitchen", "bedroom"],
    description:
      "A small, jewel-like study of pomegranates — the colour of celebration in South Asian culture rendered in intimate scale.",
    images: [art3, art1],
    featured: true,
  },
  {
    slug: "afternoon-in-amber",
    title: "Afternoon in Amber",
    creatorSlug: "sana-mirza",
    categorySlug: "originals",
    price: 95000,
    currency: "PKR",
    kind: "Original",
    medium: "Oil on canvas",
    dimensions: "120 × 90 inches",
    year: 2024,
    framed: false,
    colours: ["terracotta", "ivory", "stone"],
    room: ["living room", "dining room"],
    description:
      "A large-scale interior scene saturated with late afternoon light. The architecture is anonymous, the warmth universal.",
    images: [art4, art2],
    featured: false,
  },
  {
    slug: "morning-mist-margalla",
    title: "Morning Mist, Margalla",
    creatorSlug: "ayla-hussain",
    categorySlug: "photography",
    price: 18500,
    currency: "PKR",
    kind: "Limited Edition",
    editionOf: 10,
    medium: "Archival pigment print",
    dimensions: "50 × 70 inches",
    year: 2023,
    framed: false,
    colours: ["stone", "ivory", "ink"],
    room: ["office", "bedroom", "living room"],
    description:
      "Edition of 10. Soft morning light filters through pine trees above Islamabad — a moment of quiet before the city wakes.",
    images: [art5, art3],
    featured: false,
  },
  {
    slug: "noor-on-black",
    title: "Noor on Black",
    creatorSlug: "omar-farooq",
    categorySlug: "calligraphy",
    price: 55000,
    currency: "PKR",
    kind: "Original",
    medium: "Gold and white ink on black card",
    dimensions: "70 × 100 inches",
    year: 2023,
    framed: true,
    colours: ["ink", "ivory"],
    room: ["living room", "office"],
    description:
      "The word Noor — light — in gilded Nastaliq against a field of velvet black. Framed in raw wood.",
    images: [art6, art2],
    featured: false,
  },
  {
    slug: "bismillah-cobalt",
    title: "Bismillah in Cobalt",
    creatorSlug: "omar-farooq",
    categorySlug: "calligraphy",
    price: 38000,
    currency: "PKR",
    kind: "Original",
    medium: "Gouache on wasli",
    dimensions: "45 × 65 inches",
    year: 2022,
    framed: false,
    colours: ["indigo", "ivory"],
    room: ["living room", "office", "hotel"],
    description:
      "A commanding Bismillah rendered in deep cobalt. The script flows with authority — a cornerstone piece for a meaningful interior.",
    images: [art2, art6],
    featured: false,
  },
  {
    slug: "the-red-door",
    title: "The Red Door",
    creatorSlug: "ayla-hussain",
    categorySlug: "photography",
    price: 12000,
    currency: "PKR",
    kind: "Open Edition",
    medium: "Archival pigment print",
    dimensions: "40 × 50 inches",
    year: 2022,
    framed: false,
    colours: ["oxblood", "stone", "ivory"],
    room: ["bedroom", "living room", "small spaces"],
    description:
      "A faded red door in the old city of Lahore catches afternoon light. Open edition — an accessible print for every space.",
    images: [art1, art5],
    featured: false,
  },
  {
    slug: "winter-katas",
    title: "Winter at Katas Raj",
    creatorSlug: "ayla-hussain",
    categorySlug: "photography",
    price: 22000,
    currency: "PKR",
    kind: "Limited Edition",
    editionOf: 15,
    medium: "Archival pigment print",
    dimensions: "60 × 40 inches",
    year: 2023,
    framed: false,
    colours: ["stone", "ivory", "ink"],
    room: ["living room", "office"],
    description:
      "The sacred pools of Katas Raj in winter — still water, mist and ancient stone. Edition of 15.",
    images: [art3, art1],
    featured: false,
  },
  {
    slug: "terracotta-blocks",
    title: "Terracotta Study No. 3",
    creatorSlug: "sana-mirza",
    categorySlug: "prints",
    price: 9500,
    currency: "PKR",
    kind: "Open Edition",
    medium: "Giclee print on cotton rag",
    dimensions: "30 × 40 inches",
    year: 2024,
    framed: false,
    colours: ["terracotta", "ivory"],
    room: ["bedroom", "small spaces", "office"],
    description:
      "An open edition print from the Terracotta Studies series — warm geometric blocks inspired by Mughal tilework.",
    images: [art4, art3],
    featured: false,
  },
  {
    slug: "indigo-fields",
    title: "Indigo Fields",
    creatorSlug: "sana-mirza",
    categorySlug: "originals",
    price: 45000,
    currency: "PKR",
    kind: "Original",
    medium: "Acrylic on canvas",
    dimensions: "80 × 60 inches",
    year: 2024,
    framed: false,
    colours: ["indigo", "ivory", "stone"],
    room: ["living room", "bedroom"],
    description:
      "Deep indigo washes suggest a field at dusk — the boundary between sky and land dissolved. A meditative large-format piece.",
    images: [art5, art4],
    featured: false,
  },
  {
    slug: "monochrome-cityscape",
    title: "Karachi at Night",
    creatorSlug: "ayla-hussain",
    categorySlug: "photography",
    price: 16000,
    currency: "PKR",
    kind: "Limited Edition",
    editionOf: 20,
    medium: "Silver gelatin print",
    dimensions: "50 × 60 inches",
    year: 2023,
    framed: false,
    colours: ["ink", "stone"],
    room: ["living room", "office"],
    description:
      "A long-exposure night view across Karachi harbour — the city as a shimmer of light on water.",
    images: [art6, art5],
    featured: false,
  },
];

const SAMPLE_COLLECTIONS: EditorialCollection[] = [
  {
    slug: "artdera-edit",
    name: "The ArtDera Edit",
    blurb:
      "A considered selection chosen for expressive quality, craftsmanship and the spaces they transform.",
    products: ["quiet-horizon", "silence-in-script", "pomegranate-study", "afternoon-in-amber"],
    cover: art1,
  },
  {
    slug: "under-50k",
    name: "Under PKR 50,000",
    blurb: "Original works and limited editions at accessible price points.",
    products: [
      "bismillah-cobalt",
      "the-red-door",
      "terracotta-blocks",
      "morning-mist-margalla",
      "indigo-fields",
    ],
    cover: art3,
  },
];

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
export const CREATORS: Creator[] = [...SAMPLE_CREATORS];
export const PRODUCTS: Product[] = [...SAMPLE_PRODUCTS];
export const COLLECTIONS: EditorialCollection[] = [...SAMPLE_COLLECTIONS];

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
