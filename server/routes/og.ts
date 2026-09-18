import { Router } from "express";
import { getCreatorOrStoreResolved } from "../../src/lib/creator-meta";
import { buildAbsoluteImageUrl, SITE_URL } from "../../src/lib/seo";

export const ogRouter = Router();

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wordWrap(text: string, maxLineChars = 44, maxLines = 3): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxLineChars) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  if (lines.length === maxLines && words.length > 0) {
    const lastLine = lines[lines.length - 1];
    if (lastLine.length + 3 > maxLineChars) {
      lines[lines.length - 1] = lastLine.slice(0, maxLineChars - 3) + "...";
    } else {
      lines[lines.length - 1] = lastLine + "...";
    }
  }
  return lines;
}

async function renderCreatorOgSvg(slug: string, routePrefix: "store" | "creator" = "store") {
  const creator = await getCreatorOrStoreResolved(slug, routePrefix);
  const name = escapeXml(creator.name);
  const defaultFallbackOg = `${SITE_URL}/images/default-creator-og.jpg`;
  const rawImage = creator.profileImage || creator.coverImage;
  const profileImageUrl = escapeXml(buildAbsoluteImageUrl(rawImage, defaultFallbackOg));
  const location = escapeXml(creator.location || "Original Art & Studio Gallery");
  const bio = creator.bio || `Discover original artwork by ${creator.name} on ArtDera.`;
  const bioLines = wordWrap(bio, 46, 3).map(escapeXml);
  const canonicalPath = `artdera.com/${routePrefix}/${slug}`;

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&amp;family=Manrope:wght@500;600;700&amp;display=swap');
      .title { font-family: 'DM Serif Display', Georgia, serif; font-size: 56px; fill: #171717; font-weight: normal; }
      .eyebrow { font-family: 'Manrope', sans-serif; font-size: 14px; font-weight: 700; fill: #800020; letter-spacing: 0.16em; text-transform: uppercase; }
      .location { font-family: 'Manrope', sans-serif; font-size: 20px; font-weight: 600; fill: #666055; }
      .bio { font-family: 'Manrope', sans-serif; font-size: 23px; font-weight: 500; fill: #4A453E; line-height: 1.5; }
      .brand { font-family: 'DM Serif Display', Georgia, serif; font-size: 32px; fill: #171717; }
      .subbrand { font-family: 'Manrope', sans-serif; font-size: 13px; font-weight: 700; fill: #800020; letter-spacing: 0.12em; text-transform: uppercase; }
      .url-text { font-family: 'Manrope', sans-serif; font-size: 18px; font-weight: 600; fill: #800020; }
    </style>
    <clipPath id="avatarClip">
      <rect x="90" y="145" width="340" height="340" rx="24" />
    </clipPath>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FAF8F5" />
      <stop offset="100%" stop-color="#F2EDE4" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#171717" flood-opacity="0.08" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />

  <!-- Outer Frame -->
  <rect x="24" y="24" width="1152" height="582" rx="20" fill="none" stroke="#EBE4D8" stroke-width="2" />
  <rect x="36" y="36" width="1128" height="558" rx="16" fill="none" stroke="#800020" stroke-opacity="0.12" stroke-width="1" />

  <!-- Header Branding -->
  <g transform="translate(90, 80)">
    <text x="0" y="0" class="brand">ArtDera</text>
    <text x="130" y="-4" class="subbrand">• ARTIST STOREFRONT</text>
  </g>

  <!-- Creator Image Container -->
  <g filter="url(#shadow)">
    <!-- Shadow & background card behind image -->
    <rect x="90" y="145" width="340" height="340" rx="24" fill="#EBE4D8" />
    <!-- Creator Profile Image -->
    <image href="${profileImageUrl}" x="90" y="145" width="340" height="340" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)" />
    <!-- Image Border Overlay -->
    <rect x="90" y="145" width="340" height="340" rx="24" fill="none" stroke="#800020" stroke-width="3" stroke-opacity="0.3" />
  </g>

  <!-- Right Details Column -->
  <g transform="translate(475, 170)">
    <!-- Verified Badge / Eyebrow -->
    <text x="0" y="0" class="eyebrow">${creator.verified ? "✓ VERIFIED CREATOR" : "CREATOR PROFILE"}</text>

    <!-- Creator Name -->
    <text x="0" y="52" class="title">${name}</text>

    <!-- Location / Discipline -->
    <text x="0" y="94" class="location">${location}</text>

    <!-- Divider Line -->
    <line x1="0" y1="120" x2="630" y2="120" stroke="#DDD6C9" stroke-width="1.5" />

    <!-- Bio Paragraph Lines -->
    ${bioLines
      .map((line, index) => `<text x="0" y="${165 + index * 36}" class="bio">${line}</text>`)
      .join("\n    ")}
  </g>

  <!-- Footer Watermark / Canonical URL -->
  <g transform="translate(90, 545)">
    <rect x="0" y="-22" width="1020" height="42" rx="8" fill="#F4EFE6" />
    <text x="20" y="4" class="url-text">${canonicalPath}</text>
    <text x="1000" y="4" text-anchor="end" class="eyebrow" style="fill: #171717;">DISCOVER &amp; COLLECT ORIGINAL ART ON ARTDERA</text>
  </g>
</svg>`;

  return svg;
}

async function renderProductOgSvg(slug: string) {
  const cleanSlug = slug.trim().toLowerCase();
  let title = "Original Artwork";
  let creatorName = "Independent Artist";
  let medium = "Original Art & Editions";
  let priceText = "Available on ArtDera";
  let imageUrl = `${SITE_URL}/images/hero-interior.jpg`;

  try {
    const mongoose = await import("mongoose");
    if (mongoose.default?.connection?.readyState === 1) {
      const { ArtworkModel, StoreModel } = await import("../models");
      const art = await ArtworkModel.findOne({ slug: cleanSlug }).lean();
      if (art) {
        title = art.title;
        medium = [art.artworkType === "original" ? "Original" : "Edition", art.medium, art.dimensions ? `(${art.dimensions})` : ""].filter(Boolean).join(" ");
        if (art.price) {
          priceText = `PKR ${art.price.toLocaleString("en-PK")}`;
        }
        if (art.images?.[0]?.url) {
          imageUrl = buildAbsoluteImageUrl(art.images[0].url, imageUrl);
        }
        if (art.storeId) {
          const store = await StoreModel.findById(art.storeId).select("name").lean();
          if (store?.name) creatorName = store.name;
        }
      }
    }
  } catch {
    // Fallback gracefully
  }

  const escTitle = escapeXml(title);
  const escCreator = escapeXml(creatorName);
  const escMedium = escapeXml(medium);
  const escPrice = escapeXml(priceText);
  const escImgUrl = escapeXml(imageUrl);
  const canonicalUrl = `artdera.com/product/${cleanSlug}`;
  const titleLines = wordWrap(title, 28, 2).map(escapeXml);

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&amp;family=Manrope:wght@500;600;700&amp;display=swap');
      .product-title { font-family: 'DM Serif Display', Georgia, serif; font-size: 52px; fill: #171717; font-weight: normal; line-height: 1.15; }
      .creator { font-family: 'Manrope', sans-serif; font-size: 24px; font-weight: 600; fill: #666055; }
      .eyebrow { font-family: 'Manrope', sans-serif; font-size: 13px; font-weight: 700; fill: #800020; letter-spacing: 0.16em; text-transform: uppercase; }
      .medium { font-family: 'Manrope', sans-serif; font-size: 20px; font-weight: 500; fill: #4A453E; }
      .price { font-family: 'DM Serif Display', Georgia, serif; font-size: 44px; fill: #800020; }
      .brand { font-family: 'DM Serif Display', Georgia, serif; font-size: 32px; fill: #171717; }
      .subbrand { font-family: 'Manrope', sans-serif; font-size: 13px; font-weight: 700; fill: #800020; letter-spacing: 0.12em; text-transform: uppercase; }
      .url-text { font-family: 'Manrope', sans-serif; font-size: 18px; font-weight: 600; fill: #800020; }
    </style>
    <clipPath id="artworkClip">
      <rect x="670" y="90" width="440" height="450" rx="20" />
    </clipPath>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FAF8F5" />
      <stop offset="100%" stop-color="#F2EDE4" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#171717" flood-opacity="0.1" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />

  <!-- Outer Frame -->
  <rect x="24" y="24" width="1152" height="582" rx="20" fill="none" stroke="#EBE4D8" stroke-width="2" />
  <rect x="36" y="36" width="1128" height="558" rx="16" fill="none" stroke="#800020" stroke-opacity="0.12" stroke-width="1" />

  <!-- Header Branding -->
  <g transform="translate(90, 80)">
    <text x="0" y="0" class="brand">ArtDera</text>
    <text x="130" y="-4" class="subbrand">• CURATED ARTWORK</text>
  </g>

  <!-- Left Details Column -->
  <g transform="translate(90, 160)">
    <text x="0" y="0" class="eyebrow">ORIGINAL FINE ART</text>

    ${titleLines.map((line, index) => `<text x="0" y="${54 + index * 58}" class="product-title">${line}</text>`).join("\n    ")}

    <text x="0" y="${60 + titleLines.length * 58}" class="creator">by ${escCreator}</text>
    <text x="0" y="${96 + titleLines.length * 58}" class="medium">${escMedium}</text>

    <line x1="0" y1="${120 + titleLines.length * 58}" x2="520" y2="${120 + titleLines.length * 58}" stroke="#DDD6C9" stroke-width="1.5" />

    <text x="0" y="${175 + titleLines.length * 58}" class="price">${escPrice}</text>
  </g>

  <!-- Right Artwork Image Container -->
  <g filter="url(#shadow)">
    <rect x="670" y="90" width="440" height="450" rx="20" fill="#EBE4D8" />
    <image href="${escImgUrl}" x="670" y="90" width="440" height="450" preserveAspectRatio="xMidYMid slice" clip-path="url(#artworkClip)" />
    <rect x="670" y="90" width="440" height="450" rx="20" fill="none" stroke="#800020" stroke-width="2" stroke-opacity="0.25" />
  </g>

  <!-- Footer Watermark / Canonical URL -->
  <g transform="translate(90, 545)">
    <rect x="0" y="-22" width="1020" height="42" rx="8" fill="#F4EFE6" />
    <text x="20" y="4" class="url-text">${canonicalUrl}</text>
    <text x="1000" y="4" text-anchor="end" class="eyebrow" style="fill: #171717;">BUY ORIGINAL ARTWORK ON ARTDERA</text>
  </g>
</svg>`;
}

ogRouter.get("/store/:slug", async (req, res) => {
  try {
    const svg = await renderCreatorOgSvg(req.params.slug, "store");
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    return res.status(200).send(svg);
  } catch (error) {
    console.error("Failed to render store OG image:", error);
    return res.status(500).send("Error generating store preview image");
  }
});

ogRouter.get("/creator/:slug", async (req, res) => {
  try {
    const svg = await renderCreatorOgSvg(req.params.slug, "creator");
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    return res.status(200).send(svg);
  } catch (error) {
    console.error("Failed to render creator OG image:", error);
    return res.status(500).send("Error generating creator preview image");
  }
});

ogRouter.get("/product/:slug", async (req, res) => {
  try {
    const svg = await renderProductOgSvg(req.params.slug);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    return res.status(200).send(svg);
  } catch (error) {
    console.error("Failed to render product OG image:", error);
    return res.status(500).send("Error generating product preview image");
  }
});

ogRouter.get("/artwork/:slug", async (req, res) => {
  try {
    const svg = await renderProductOgSvg(req.params.slug);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    return res.status(200).send(svg);
  } catch (error) {
    console.error("Failed to render artwork OG image:", error);
    return res.status(500).send("Error generating artwork preview image");
  }
});

ogRouter.get("/gallery/:slug", async (req, res) => {
  try {
    const svg = await renderCreatorOgSvg(req.params.slug, "store");
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    return res.status(200).send(svg);
  } catch (error) {
    console.error("Failed to render gallery OG image:", error);
    return res.status(500).send("Error generating gallery preview image");
  }
});

