import type { Product } from "./artdera";
import type { Artwork, Store } from "../marketplace/types";

export function artworkRouteSlug(item: { id?: string; slug: string }) {
  return item.id ? `${item.id}-${item.slug}` : item.slug;
}

export function uniqueById<T extends { id?: string; slug?: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id ?? item.slug, item])).values()];
}

export function catalogProduct(artwork: Artwork, store?: Store): Product {
  return {
    id: artwork.id,
    artwork,
    slug: artwork.slug,
    creatorSlug: store?.slug ?? "",
    creatorName: store?.name ?? artwork.creatorName,
    title: artwork.title,
    categorySlug: artwork.category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    price: artwork.discountPrice ?? artwork.price,
    currency: "PKR",
    kind: artwork.kind === "Print" ? "Open Edition" : artwork.kind,
    editionOf: undefined,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    year: artwork.year,
    framed: artwork.framed,
    colours: artwork.colours ?? [],
    style: artwork.style,
    subject: artwork.subject,
    tags: artwork.tags,
    room: [],
    description: artwork.description,
    story: artwork.story,
    images: artwork.images.map((image) => image.url).filter(Boolean),
    featured: artwork.sponsored,
  };
}
