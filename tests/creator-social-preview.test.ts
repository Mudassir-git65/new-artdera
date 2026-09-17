import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../server/app";
import { generateCreatorStoreSocialMeta, buildAbsoluteImageUrl, SITE_URL } from "../src/lib/seo";
import { getCreatorOrStoreResolved } from "../src/lib/creator-meta";
import { StoreModel, ArtistProfileModel, UserModel } from "../server/models";

describe("Creator & Store Social Sharing Previews", () => {
  it("resolves dynamic metadata for a creator with a profile picture", async () => {
    const meta = generateCreatorStoreSocialMeta({
      name: "Ayesha Khan",
      slug: "ayesha-khan",
      bio: "Ayesha Khan creates contemporary miniature paintings blending traditional gouache on Wasli paper.",
      profileImage: "https://res.cloudinary.com/artdera/image/upload/v1234/ayesha-profile.jpg",
      routePrefix: "store",
    });

    const metaMap = new Map<string, string>();
    for (const item of meta.meta) {
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

    // Title requirement: Creator Name + | ArtDera
    expect(metaMap.get("title")).toBe("Ayesha Khan | ArtDera");
    expect(metaMap.get("og:title")).toBe("Ayesha Khan | ArtDera");
    expect(metaMap.get("twitter:title")).toBe("Ayesha Khan | ArtDera");

    // Description requirement: short bio or fallback
    expect(metaMap.get("description")).toContain("Ayesha Khan creates contemporary miniature paintings");
    expect(metaMap.get("og:description")).toContain("Ayesha Khan creates contemporary miniature paintings");
    expect(metaMap.get("twitter:description")).toContain("Ayesha Khan creates contemporary miniature paintings");

    // Canonical & URL requirement
    expect(metaMap.get("og:url")).toBe("https://www.artdera.com/store/ayesha-khan");
    expect(meta.links.find((l) => l.rel === "canonical")?.href).toBe("https://www.artdera.com/store/ayesha-khan");

    // Site Name & Type requirements
    expect(metaMap.get("og:site_name")).toBe("ArtDera");
    expect(metaMap.get("og:type")).toBe("profile");
    expect(metaMap.get("twitter:card")).toBe("summary_large_image");

    // Absolute HTTPS Image URLs requirement
    const ogImg = metaMap.get("og:image");
    const twImg = metaMap.get("twitter:image");
    expect(ogImg).toMatch(/^https:\/\//);
    expect(twImg).toMatch(/^https:\/\//);
  });

  it("uses custom fallback description when creator has no bio", async () => {
    const meta = generateCreatorStoreSocialMeta({
      name: "Farhan Ahmed",
      slug: "farhan-ahmed",
      bio: "",
      routePrefix: "creator",
    });

    const desc = meta.meta.find((m) => "name" in m && m.name === "description")?.content;
    expect(desc).toBe("Discover original artwork by Farhan Ahmed on ArtDera.");
  });

  it("applies fallback chain (profile -> cover -> default image) when picture is missing", async () => {
    // 1. Profile image present
    const img1 = buildAbsoluteImageUrl("https://example.com/profile.jpg");
    expect(img1).toBe("https://example.com/profile.jpg");

    // 2. Profile missing, cover image present
    const img2 = buildAbsoluteImageUrl(undefined || "https://example.com/cover.jpg");
    expect(img2).toBe("https://example.com/cover.jpg");

    // 3. Both missing -> fallback to default creator OG image
    const img3 = buildAbsoluteImageUrl(undefined);
    expect(img3).toBe(`${SITE_URL}/images/default-creator-og.jpg`);

    // 4. Localhost URL -> converted to production absolute URL
    const img4 = buildAbsoluteImageUrl("http://localhost:5000/uploads/avatars/user.jpg");
    expect(img4).toBe("https://www.artdera.com/uploads/avatars/user.jpg");
  });

  it("dynamically fetches store and creator updates from database", async () => {
    const user = await UserModel.create({
      fullName: "Zainab Malik",
      email: "zainab@example.com",
      emailNormalized: "zainab@example.com",
      passwordHash: "testpasswordhash123",
      role: "artist",
      sellerType: "artist",
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
    });

    await ArtistProfileModel.create({
      userId: user._id,
      displayName: "Zainab Malik",
      shortBio: "Contemporary Calligraphy & Abstract Ink Artist",
      profileImageUrl: "https://res.cloudinary.com/artdera/image/upload/v1/zainab-profile.jpg",
      coverImageUrl: "https://res.cloudinary.com/artdera/image/upload/v1/zainab-cover.jpg",
      city: "Lahore",
      country: "Pakistan",
      onboardingCompleted: true,
    });

    await StoreModel.create({
      ownerId: user._id,
      ownerType: "artist",
      name: "Zainab Malik Studio",
      slug: "zainab-malik",
      tagline: "Abstract Ink & Calligraphy",
      shortDescription: "Contemporary Calligraphy & Abstract Ink Artist",
      status: "active",
      isPublished: true,
    });

    // Test initial metadata resolution
    let resolved = await getCreatorOrStoreResolved("zainab-malik", "store");
    expect(resolved.name).toBe("Zainab Malik");
    expect(resolved.bio).toBe("Contemporary Calligraphy & Abstract Ink Artist");
    expect(resolved.profileImage).toBe("https://res.cloudinary.com/artdera/image/upload/v1/zainab-profile.jpg");

    // Update profile picture and bio
    await ArtistProfileModel.updateOne(
      { userId: user._id },
      {
        $set: {
          displayName: "Zainab Malik Calligraphy",
          shortBio: "Award-winning Nastaliq Calligrapher based in Lahore",
          profileImageUrl: "https://res.cloudinary.com/artdera/image/upload/v2/zainab-new-profile.jpg",
        },
      },
    );

    // Verify metadata updates immediately without stale caching
    resolved = await getCreatorOrStoreResolved("zainab-malik", "store");
    expect(resolved.name).toBe("Zainab Malik Calligraphy");
    expect(resolved.bio).toBe("Award-winning Nastaliq Calligrapher based in Lahore");
    expect(resolved.profileImage).toBe("https://res.cloudinary.com/artdera/image/upload/v2/zainab-new-profile.jpg");
  });

  it("serves dynamic 1200x630 OG preview cards via /api/og/store/:slug and /api/og/creator/:slug", async () => {
    const app = createApp();

    const responseStore = await request(app)
      .get("/api/og/store/sana-mirza")
      .expect(200);

    const svgTextStore = responseStore.text || responseStore.body.toString("utf-8");
    expect(responseStore.headers["content-type"]).toContain("image/svg+xml");
    expect(svgTextStore).toContain('width="1200"');
    expect(svgTextStore).toContain('height="630"');
    expect(svgTextStore).toContain("Sana Mirza");
    expect(svgTextStore).toContain("ArtDera");

    const responseCreator = await request(app)
      .get("/api/og/creator/omar-farooq")
      .expect(200);

    const svgTextCreator = responseCreator.text || responseCreator.body.toString("utf-8");
    expect(responseCreator.headers["content-type"]).toContain("image/svg+xml");
    expect(svgTextCreator).toContain('width="1200"');
    expect(svgTextCreator).toContain('height="630"');
    expect(svgTextCreator).toContain("Omar Farooq");
  });
});
