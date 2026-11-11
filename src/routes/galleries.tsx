import { SiteLink } from "@/components/site/SiteLink";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { STORES } from "@/marketplace/data";
import { fetchCreatorPage } from "@/lib/server-loaders";
import { useEffect, useState } from "react";
import type { Creator } from "@/lib/artdera";
import { CreatorDirectoryMore } from "@/components/site/CreatorDirectoryMore";
import { artworkImageUrl, artworkImageSrcSet } from "@/lib/artwork-image";
import { generateMeta, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/galleries")({
  loader: async () => {
    return await fetchCreatorPage({ data: { type: "gallery" } });
  },
  head: () => {
    const seo = generateMeta({
      title: "Art Galleries — Curated Programmes | ArtDera",
      description:
        "Discover independent art galleries and curated exhibition programmes across Pakistan on ArtDera.",
      canonicalPath: "/galleries",
    });

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Galleries", path: "/galleries" },
    ]);

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
      ],
    };
  },
  component: Galleries,
});

function Galleries() {
  const loaderGalleries = Route.useLoaderData();
  const [creators, setCreators] = useState<Creator[]>(loaderGalleries.items);
  useEffect(() => {
    setCreators(loaderGalleries.items);
  }, [loaderGalleries]);
  const galleries = creators.map((gallery) => gallery.store!).filter(Boolean);

  return (
    <div className="container-editorial py-14">
      <div className="eyebrow">Galleries</div>
      <h1 className="mt-3 max-w-3xl font-display text-5xl md:text-6xl">
        Curated programmes, made easier to enter.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Explore gallery storefronts, represented artists, exhibitions and carefully documented work
        from across Pakistan.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {galleries.map((store) => (
          <SiteLink
            key={store.id}
            href={`/store/${store.slug}`}
            className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)]"
          >
            <div className="relative h-64 overflow-hidden">
              <img
                src={artworkImageUrl(store.coverImage, 960)}
                srcSet={artworkImageSrcSet(store.coverImage)}
                sizes="(max-width: 767px) 100vw, 50vw"
                loading="lazy"
                decoding="async"
                alt={`${store.name} gallery`}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <img
                src={artworkImageUrl(store.profileImage, 320)}
                loading="lazy"
                decoding="async"
                width={80}
                height={80}
                alt=""
                className="absolute bottom-4 left-4 h-20 w-20 rounded-full border-4 border-white/20 object-cover"
              />
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-3xl">{store.name}</h2>
                {store.verified && <BadgeCheck className="h-5 w-5 text-[var(--indigo)]" />}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{store.bio}</p>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  <MapPin className="mr-1 inline h-3.5 w-3.5" />
                  {store.location}
                </span>
                <span>
                  <Star className="mr-1 inline h-3.5 w-3.5" fill="currentColor" />
                  {store.rating} · {store.reviewCount} reviews
                </span>
                <span>{store.followers.toLocaleString()} followers</span>
              </div>
            </div>
          </SiteLink>
        ))}
      </div>
      <CreatorDirectoryMore
        type="gallery"
        resetKey={loaderGalleries}
        initialCursor={loaderGalleries.nextCursor}
        onPage={(items) =>
          setCreators((current) => [
            ...new Map([...current, ...items].map((item) => [item.slug, item])).values(),
          ])
        }
      />
      <div className="mt-10 rounded-2xl bg-[var(--ink)] p-7 text-[var(--ivory)]">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="eyebrow !text-white/45">For galleries</div>
            <h2 className="mt-2 font-display text-3xl">
              Manage artists, staff, inventory and exhibitions.
            </h2>
          </div>
          <SiteLink
            href="/sell/plans"
            className="btn-primary bg-[var(--terracotta)] !text-[var(--ink)]"
          >
            View Gallery Plan
          </SiteLink>
        </div>
      </div>
    </div>
  );
}
