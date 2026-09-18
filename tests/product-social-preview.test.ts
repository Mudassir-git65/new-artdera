import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../server/app";
import { generateMeta, buildAbsoluteImageUrl, SITE_URL } from "../src/lib/seo";
import { ArtworkModel, StoreModel, ArtistProfileModel, UserModel } from "../server/models";

describe("Artwork & Product Social Sharing Previews", () => {
  it("generates dynamic metadata for a product with actual artwork image", async () => {
    const creatorName = "Art By Ayesha";
    const title = "Surah Fatiha ~ The Opening ✨";
    const artworkImage = "https://res.cloudinary.com/artdera/image/upload/v1234/surah-fatiha.jpg";

    const seo = generateMeta({
      title: `${title} by ${creatorName}`,
      description: `Original acrylic on canvas (36 × 24 cm) by ${creatorName}. Discover this original artwork on ArtDera.`,
      canonicalPath: "/product/surah-fatiha-the-opening-mtearfcy-d0ade0",
      ogImage: artworkImage,
      ogType: "product",
    });

    const metaMap = new Map<string, string>();
    for (const item of seo.meta) {
      if ("property" in item && item.property) {
        metaMap.set(item.property, item.content);
      }
      if ("name" in item && item.name) {
        metaMap.set(item.name, item.content);
      }
      if ("title" in item && item.title) {
        metaMap.set("title", item.title);
      }
    }

    // Title requirement: Artwork title + by Creator Name + | ArtDera
    expect(metaMap.get("title")).toBe("Surah Fatiha ~ The Opening ✨ by Art By Ayesha | ArtDera");
    expect(metaMap.get("og:title")).toBe("Surah Fatiha ~ The Opening ✨ by Art By Ayesha | ArtDera");
    expect(metaMap.get("twitter:title")).toBe("Surah Fatiha ~ The Opening ✨ by Art By Ayesha | ArtDera");

    // Description requirement: medium, dimensions, artist name
    expect(metaMap.get("description")).toContain("Original acrylic on canvas (36 × 24 cm) by Art By Ayesha");
    expect(metaMap.get("og:description")).toContain("Original acrylic on canvas (36 × 24 cm) by Art By Ayesha");

    // Canonical URL requirement
    expect(metaMap.get("og:url")).toBe("https://www.artdera.com/product/surah-fatiha-the-opening-mtearfcy-d0ade0");
    expect(seo.links.find((l) => l.rel === "canonical")?.href).toBe(
      "https://www.artdera.com/product/surah-fatiha-the-opening-mtearfcy-d0ade0",
    );

    // Primary artwork image requirement
    expect(metaMap.get("og:image")).toBe("https://res.cloudinary.com/artdera/image/upload/v1234/surah-fatiha.jpg");
    expect(metaMap.get("twitter:image")).toBe("https://res.cloudinary.com/artdera/image/upload/v1234/surah-fatiha.jpg");
    expect(metaMap.get("twitter:card")).toBe("summary_large_image");
  });

  it("serves dynamic 1200x630 OG preview cards via /api/og/product/:slug and /api/og/artwork/:slug", async () => {
    const app = createApp();

    const responseProduct = await request(app)
      .get("/api/og/product/quiet-horizon")
      .expect(200);

    const svgTextProduct = responseProduct.text || responseProduct.body.toString("utf-8");
    expect(responseProduct.headers["content-type"]).toContain("image/svg+xml");
    expect(svgTextProduct).toContain('width="1200"');
    expect(svgTextProduct).toContain('height="630"');
    expect(svgTextProduct).toContain("Quiet Horizon");
    expect(svgTextProduct).toContain("ArtDera");

    const responseArtwork = await request(app)
      .get("/api/og/artwork/surah-fatiha-the-opening-mtearfcy-d0ade0")
      .expect(200);

    const svgTextArtwork = responseArtwork.text || responseArtwork.body.toString("utf-8");
    expect(responseArtwork.headers["content-type"]).toContain("image/svg+xml");
    expect(svgTextArtwork).toContain('width="1200"');
    expect(svgTextArtwork).toContain('height="630"');
    expect(svgTextArtwork).toContain("Surah Fatiha The Opening");
    expect(svgTextArtwork).toContain("Mtearfcy");
  });
});
