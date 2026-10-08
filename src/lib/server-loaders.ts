import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const listQuery = z
  .object({
    category: z.string().optional(),
    creatorSlug: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .optional();

export const fetchProductBySlug = createServerFn({ method: "GET" })
  .validator((data: string) => z.string().trim().min(1).max(220).parse(data))
  .handler(async ({ data }) => {
    const { loadProduct } = await import("./catalog.server");
    return loadProduct(data);
  });

export const fetchProductsList = createServerFn({ method: "GET" })
  .validator((data?: z.infer<typeof listQuery>) => listQuery.parse(data))
  .handler(async ({ data }) => {
    const { loadProducts } = await import("./catalog.server");
    return loadProducts(data);
  });

export const fetchCreatorsList = createServerFn({ method: "GET" })
  .validator((data?: { limit?: number; type?: "artist" | "gallery" }) =>
    z
      .object({
        limit: z.number().int().positive().max(1000).optional(),
        type: z.enum(["artist", "gallery"]).optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadCreators } = await import("./catalog.server");
    return loadCreators(data);
  });

export const fetchStoreCatalog = createServerFn({ method: "GET" })
  .validator((data: { slug: string; cursor?: string }) =>
    z
      .object({ slug: z.string().min(1).max(100), cursor: z.string().max(2000).optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadStoreCatalog } = await import("./catalog.server");
    return loadStoreCatalog(data.slug, data.cursor);
  });

export const fetchCatalogPage = createServerFn({ method: "GET" })
  .validator(
    (data?: {
      cursor?: string;
      limit?: number;
      category?: string;
      q?: string;
      kind?: string;
      color?: string;
      room?: string;
      framed?: string;
      min?: number;
      max?: number;
      sort?: string;
    }) =>
      z
        .object({
          cursor: z.string().max(2000).optional(),
          limit: z.number().int().positive().max(100).optional(),
          category: z.string().max(120).optional(),
          q: z.string().max(120).optional(),
          kind: z.string().max(120).optional(),
          color: z.string().max(80).optional(),
          room: z.string().max(80).optional(),
          framed: z.string().optional(),
          min: z.number().finite().optional(),
          max: z.number().finite().optional(),
          sort: z.string().optional(),
        })
        .optional()
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadCatalogPage } = await import("./catalog.server");
    return loadCatalogPage(data);
  });

export const fetchHomeCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { loadHomeCatalog } = await import("./catalog.server");
  return loadHomeCatalog();
});

export const fetchCollectionCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { loadCollectionCatalog } = await import("./catalog.server");
  return loadCollectionCatalog();
});
