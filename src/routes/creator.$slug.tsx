import { createFileRoute } from "@tanstack/react-router";
import { ProBadge } from "@/components/ui/ProBadge";
import { getCreator, productsByCreator } from "@/lib/artdera";
import { ProductCard } from "@/components/site/ProductCard";
import { toast } from "sonner";
import { useAuth } from "@/marketplace/auth";
import { ARTWORKS, STORES } from "@/marketplace/data";
import { FollowService, MessageService, MarketplaceService } from "@/marketplace/services";
import { generateMeta, generatePersonSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { hasActiveProfessionalSubscription } from "@/lib/subscription-status";

export const Route = createFileRoute("/creator/$slug")({
  // This loader uses the browser API client, whose /api URLs are intentionally relative.
  // Running it during SSR turns those URLs into invalid server-side fetches and makes
  // direct creator links return 500 before the client has a chance to load the catalog.
  ssr: false,
  head: ({ params }) => {
    const creator = getCreator(params.slug);
    const title = creator
      ? `${creator.name} — Artist Biography & Available Artworks | ArtDera`
      : `${decodeURIComponent(params.slug)
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())} | ArtDera`;

    if (!creator) {
      const seo = generateMeta({
        title,
        description:
          "Discover artist profiles, biographies, and available studio works on ArtDera.",
      });
      return { meta: seo.meta, links: seo.links };
    }

    const seo = generateMeta({
      title: `${creator.name} — Artist Biography & Available Artworks`,
      description: `${creator.name} is a ${creator.discipline} artist based in ${creator.location}. ${creator.bio.slice(0, 140)}... Discover available paintings and studio works on ArtDera.`,
      canonicalPath: `/creator/${creator.slug}`,
      ogImage: creator.portrait,
      ogType: "profile",
    });

    const personSchema = generatePersonSchema({
      name: creator.name,
      slug: creator.slug,
      bio: creator.bio,
      location: creator.location,
      discipline: creator.discipline,
      portrait: creator.portrait,
      verified: creator.verified,
    });

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Creators", path: "/creators" },
      { name: creator.name, path: `/creator/${creator.slug}` },
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
  loader: async ({ params }) => {
    await MarketplaceService.loadArtworksForStore(params.slug);
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
  const { user, catalogReady } = useAuth();
  const creator = getCreator(slug);
  // Don't flash "Creator not found" while the server bootstrap is still loading.
  if (!creator && !catalogReady) return null;
  if (!creator)
    return (
      <div className="container-editorial py-24 text-center">
        <h1 className="font-display text-4xl">Creator not found</h1>
        <a href="/creators" className="btn-primary mt-6">
          Meet the creators
        </a>
      </div>
    );
  const works = productsByCreator(creator.slug);
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
