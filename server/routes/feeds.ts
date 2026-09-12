import { Router } from "express";
import { asyncRoute } from "../lib/http";
import { ArtworkModel } from "../models";
import { publicAssetUrl } from "../lib/serializers";

export const feedsRouter = Router();

const BASE_URL = process.env.PUBLIC_HOST
  ? `https://${process.env.PUBLIC_HOST}`
  : "https://www.artdera.com";

const escapeXml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Google Merchant Center / Shopping — RSS 2.0 compatible product feed
feedsRouter.get(
  "/merchant-feed.xml",
  asyncRoute(async (_req, res) => {
    const artworks = await ArtworkModel.find({
      status: "published",
      quantity: { $gt: 0 },
    })
      .limit(1000)
      .populate("artistId", "fullName")
      .populate("storeId", "name slug")
      .lean();

    const items = artworks.map((artwork) => {
      const storeSlug = (artwork as any).storeId?.slug ?? "artdera-artist-studio";
      const price = artwork.price ?? 0;
      const title = escapeXml(String(artwork.title ?? ""));
      const description = escapeXml(String(artwork.description ?? title).slice(0, 500));
      const link = `${BASE_URL}/product/${artwork.slug}`;
      const primaryImage =
        Array.isArray(artwork.images) && artwork.images.length > 0
          ? publicAssetUrl(
              (artwork.images as any[]).find((i) => i.isPrimary)?.url ??
                (artwork.images as any[])[0]?.url ??
                "",
            )
          : "";

      const category =
        (artwork as any).category === "calligraphy"
          ? "Islamic Calligraphy"
          : (artwork as any).category === "photography"
            ? "Fine Art Photography"
            : (artwork as any).category === "print"
              ? "Art Prints"
              : "Original Art";

      const availability = (artwork.quantity ?? 0) > 0 ? "in stock" : "out of stock";
      const condition = "new";

      const dimensions = (() => {
        const w = (artwork as any).width;
        const h = (artwork as any).height;
        const unit = (artwork as any).measurementUnit ?? "cm";
        return w && h ? `${w} × ${h} ${unit}` : "";
      })();

      return `
    <item>
      <g:id>${escapeXml(String(artwork.slug))}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      ${primaryImage ? `<g:image_link>${escapeXml(String(primaryImage))}</g:image_link>` : ""}
      <g:price>${price.toFixed(2)} PKR</g:price>
      <g:availability>${availability}</g:availability>
      <g:condition>${condition}</g:condition>
      <g:brand>ArtDera</g:brand>
      <g:product_type>${escapeXml(category)}</g:product_type>
      <g:google_product_category>Shopping &gt; Arts &amp; Entertainment &gt; Hobbies &amp; Creative Arts &gt; Artwork</g:google_product_category>
      ${dimensions ? `<g:size>${escapeXml(dimensions)}</g:size>` : ""}
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>ArtDera — Original Art &amp; Prints Marketplace</title>
    <link>${BASE_URL}</link>
    <description>Shop original paintings, calligraphy, photography, and prints from verified independent artists on ArtDera.</description>
    ${items.join("\n")}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    return res.send(xml);
  }),
);
