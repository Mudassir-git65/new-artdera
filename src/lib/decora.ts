import { z } from "zod";

export const DECORA_PRICE_LIMIT = 3000;
export const DECORA_TAGLINE = "Artful Décor. Thoughtful Gifts.";
export const DECORA_CATEGORIES = [
  { id: "home-decor", name: "Home décor", detail: "Little touches. Lovely spaces.", icon: "vase" },
  {
    id: "personalized-gifts",
    name: "Personalized gifts",
    detail: "Made with someone in mind.",
    icon: "gift",
  },
  {
    id: "prayer-mats",
    name: "Customized prayer mats",
    detail: "A personal touch for quiet moments.",
    icon: "mat",
  },
  { id: "booklets", name: "Booklets", detail: "Small pages, meaningful words.", icon: "book" },
  {
    id: "mini-paintings",
    name: "Mini paintings",
    detail: "Original charm, on a smaller scale.",
    icon: "painting",
  },
  {
    id: "handmade-crafts",
    name: "Handmade crafts",
    detail: "The beauty of made by hand.",
    icon: "craft",
  },
  {
    id: "accessories",
    name: "Decorative accessories",
    detail: "Details that make it yours.",
    icon: "sparkle",
  },
] as const;
export type DecoraCategory = (typeof DECORA_CATEGORIES)[number]["id"];
export const decoraCategorySchema = z.enum(
  DECORA_CATEGORIES.map((item) => item.id) as [DecoraCategory, ...DecoraCategory[]],
);
export const customizationOptionSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    required: z.boolean().default(false),
    choices: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  })
  .strict();
export const customizationOptionsSchema = z
  .array(customizationOptionSchema)
  .max(5)
  .refine(
    (options) =>
      new Set(options.map((option) => option.label.toLowerCase())).size === options.length,
    "Customization field names must be unique",
  );
export const customizationSchema = z
  .array(
    z
      .object({
        label: z.string().trim().min(1).max(60),
        value: z.string().trim().max(300),
      })
      .strict(),
  )
  .max(5);
export type CustomizationOption = z.infer<typeof customizationOptionSchema>;
export type CustomizationSelection = z.infer<typeof customizationSchema>;

export function isDecoraPrice(price: number) {
  return Number.isFinite(price) && price > 0 && price < DECORA_PRICE_LIMIT;
}
