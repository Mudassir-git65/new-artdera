import { createFileRoute } from "@tanstack/react-router";
import { PRODUCTS, CREATORS } from "@/lib/artdera";

const BASE_URL = "https://www.artdera.com";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const lastmod = new Date().toISOString().slice(0, 10);

        const staticPaths = [
          "/",
          "/discover",
          "/paintings",
          "/calligraphy",
          "/photography",
          "/prints",
          "/wall-art",
          "/creators",
          "/galleries",
          "/collections",
          "/sell",
          "/sell/art",
          "/sell/plans",
          "/for-interior-designers",
          "/about",
          "/how-it-works",
          "/buyer-protection",
          "/authenticity",
          "/affiliate",
          "/shipping",
          "/returns",
          "/journal",
          "/legal/terms",
          "/legal/privacy",
          "/legal/artist-terms",
          "/legal/gallery-terms",
          "/legal/shipping",
          "/legal/returns",
          "/legal/verification",
          "/legal/sponsored",
          "/legal/community",
          "/legal/prohibited",
          "/legal/copyright",
          "/legal/disputes",
        ];

        let productPaths: string[] = [];
        let creatorPaths: string[] = [];
        let storePaths: string[] = [];

        const { connectDatabase } = await import("../../server/db");
        await connectDatabase();
        const { ArtworkModel, StoreModel } = await import("../../server/models");
        const { publicArtworkFilter, publicStoreFilter } =
          await import("../../server/services/catalog");
        const [artworks, stores] = await Promise.all([
          ArtworkModel.find(publicArtworkFilter).select("slug").lean(),
          StoreModel.find(publicStoreFilter).select("slug ownerType").lean(),
        ]);
        productPaths = artworks.map((a) => `/product/${a._id}-${a.slug}`);
        creatorPaths = stores
          .filter((s) => s.ownerType === "artist")
          .map((s) => `/creator/${s.slug}`);
        storePaths = stores.filter((s) => s.ownerType === "gallery").map((s) => `/store/${s.slug}`);
        const allPaths = Array.from(
          new Set([...staticPaths, ...productPaths, ...creatorPaths, ...storePaths]),
        );

        const urls = allPaths
          .map(
            (p) =>
              `  <url>\n    <loc>${BASE_URL}${p}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${p === "/" ? "daily" : "weekly"}</changefreq>\n    <priority>${p === "/" ? "1.0" : p.startsWith("/product/") ? "0.8" : "0.7"}</priority>\n  </url>`,
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=0, must-revalidate",
          },
        });
      },
    },
  },
});
