export const CATEGORIES_LIST = [
  "Painting",
  "Drawing & Illustration",
  "Calligraphy",
  "Photography",
  "Sculpture",
  "Resin Art",
  "Digital Art",
  "Prints & Editions",
  "Mixed Media",
  "Textile & Fiber Art",
  "Crochet",
  "Ceramics & Pottery",
  "Handmade Décor",
  "Handmade / Crafts",
  "Candles & Home Fragrance",
  "Original Works",
] as const;

export const STYLES_LIST = [
  "Abstract",
  "Contemporary",
  "Modern",
  "Minimalist",
  "Traditional",
  "Realism",
  "Islamic",
] as const;

export const SUBJECTS_LIST = [
  "Landscape",
  "Portrait",
  "Nature",
  "Floral",
  "Architecture",
  "Animals",
  "Spiritual",
  "Geometric",
] as const;

export type CategoryName = (typeof CATEGORIES_LIST)[number];
export type StyleName = (typeof STYLES_LIST)[number];
export type SubjectName = (typeof SUBJECTS_LIST)[number];
