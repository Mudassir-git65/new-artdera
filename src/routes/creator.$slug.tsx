import { createFileRoute } from "@tanstack/react-router";
import { ProBadge } from "@/components/ui/ProBadge";
import { getCreator, productsByCreator, type Creator } from "@/lib/artdera";
import { fetchProductsList } from "@/lib/server-loaders";
import { ProductCard } from "@/components/site/ProductCard";
import { toast } from "sonner";
import { useAuth } from "@/marketplace/auth";
import { ARTWORKS, STORES } from "@/marketplace/data";
import { FollowService, MessageService, MarketplaceService } from "@/marketplace/services";
import { generatePersonSchema, generateBreadcrumbSchema, generateCreatorStoreSocialMeta } from "@/lib/seo";
import { getCreatorOrStoreResolved } from "@/lib/creator-meta";
import { hasActiveProfessionalSubscription } from "@/lib/subscription-status";

export const Route = createFileRoute("/creator/$slug")({
  loader: async ({ params }) => {
    if (typeof window !== "undefined") {
      void MarketplaceService.loadArtworksForStore(params.slug);
    }
    const [creatorMeta, works] = await Promise.all([
      getCreatorOrStoreResolved(params.slug, "creator"),
      fetchProductsList({ data: { creatorSlug: params.slug } }),
    ]);
    return { creatorMeta, works };
  },
  head: ({ loaderData, params }) => {
    const creatorMeta = loaderData?.creatorMeta;
    const creatorName =
      creatorMeta?.name ||
      decodeURIComponent(params.slug)
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const seo = generateCreatorStoreSocialMeta({
      name: creatorName,
      slug: params.slug,
      bio: creatorMeta?.bio,
      profileImage: creatorMeta?.profileImage,
      coverImage: creatorMeta?.coverImage,
      routePrefix: "creator",
    });

    const personSchema = generatePersonSchema({
      name: creatorName,
      slug: params.slug,
      bio: creatorMeta?.bio || `Discover original artwork by ${creatorName} on ArtDera.`,
      location: creatorMeta?.location,
      portrait: creatorMeta?.profileImage,
      verified: creatorMeta?.verified,
    });

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Creators", path: "/creators" },
      { name: creatorName, path: `/creator/${params.slug}` },
    ]);

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(personSchema),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
      ],
    };
  },
  component: CreatorPage,
  notFoundComponent: () => (
    <div className="container-editorial py-24 text-center">
      <h1 className="font-display text-4xl">Creator not found</h1>
      <a href="/creators" className="btn-primary mt-6">
        Meet the creators
      </a>
    </div>
  ),
});

function CreatorPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { creatorMeta, works: loaderWorks } = Route.useLoaderData();
  const staticCreator = getCreator(slug);

  const creator: Creator = staticCreator || {
    slug,
    name: creatorMeta?.name || decodeURIComponent(slug).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    handle: `@${slug}`,
    location: creatorMeta?.location || "Pakistan",
    discipline: "Visual Art",
    bio: creatorMeta?.bio || `Discover original artwork by ${creatorMeta?.name || slug} on ArtDera.`,
    verified: Boolean(creatorMeta?.verified),
    accountType: "artist",
    approvedSeller: true,
    portrait: creatorMeta?.profileImage || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80&auto=format",
    works: [],
  };

  const clientWorks = productsByCreator(creator.slug);
  const works = clientWorks.length > 0 ? clientWorks : loaderWorks;
  const firstArtwork = ARTWORKS.find((artwork) => works.some((work) => work.slug === artwork.slug));
  const store =
    STORES.find((item) => item.slug === creator.slug) ??
    STORES.find((item) => item.id === firstArtwork?.storeId);
  const requireAccount = () => {
    if (!user) {
      window.location.assign(
        `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`,
      );
      return false;
    }
    return true;
  };

  return (
    <div>
      <section style={{ background: "var(--porcelain)" }}>
        <div className="container-editorial py-16 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <div className="eyebrow">Creator profile</div>
            <h1 className="mt-3 font-display text-5xl md:text-6xl">{creator.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {hasActiveProfessionalSubscription(creator) && <ProBadge size="md" />}
              <span className="chip">{creator.discipline}</span>
              <span className="chip">{creator.location}</span>
              {creator.verified && (
                <span
                  className="chip"
                  style={{ background: "var(--indigo)", color: "var(--porcelain)" }}
                >
                  ✓ Identity verified
                </span>
              )}
            </div>
            <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground max-w-xl">
              {creator.bio}
            </p>
            <div className="mt-8 flex gap-3">
              <button
                onClick={() =>
                  void (async () => {
                    if (!requireAccount() || !store) return;
                    const result = await FollowService.follow(store.id);
                    result.error
                      ? toast.error(result.error.message)
                      : toast.success("Studio followed");
                  })()
                }
                className="btn-primary"
              >
                Follow studio
              </button>
              <button
                onClick={() =>
                  void (async () => {
                    if (!requireAccount() || !store) return;
                    const result = await MessageService.createConversation(
                      store.id,
                      firstArtwork?.id,
                      "Commission request: I would like to discuss a custom work.",
                    );
                    if (result.error) toast.error(result.error.message);
                    else window.location.assign(`/messages?conversation=${result.data!.id}`);
                  })()
                }
                className="btn-ghost"
              >
                Request a commission
              </button>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[
                [works.length.toString(), "Works available"],
                ["100%", "On-time fulfilment"],
                ["< 24h", "Response time"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div className="font-display text-3xl">{n}</div>
                  <div className="text-xs text-muted-foreground mt-1">{l}</div>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg">
            <img src={creator.portrait} alt={creator.name} className="h-full w-full object-cover" />
          </div>
        </div>
      </section>

      <section className="container-editorial py-16">
        <div className="eyebrow">Work</div>
        <h2 className="mt-3 font-display text-3xl">Selected pieces from the studio</h2>
        <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-12 min-[480px]:grid-cols-2 md:grid-cols-3">
          {works.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
