import { createFileRoute, Link } from "@tanstack/react-router";
import { CREATORS, type Creator } from "@/lib/artdera";
import { fetchCreatorsList } from "@/lib/server-loaders";
import { generateMeta, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/creators")({
  loader: async () => {
    return await fetchCreatorsList({ data: { type: "artist" } });
  },
  head: () => {
    const seo = generateMeta({
      title: "Verified Artists & Creators | ArtDera",
      description: "Meet independent artists, calligraphers, sculptors, and fine art photographers verified on ArtDera.",
      canonicalPath: "/creators",
    });

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Creators", path: "/creators" },
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
  component: Creators,
});

function Creators() {
  const loaderCreators = Route.useLoaderData();
  const creators: Creator[] = CREATORS.length > 0 ? CREATORS : (loaderCreators as unknown as Creator[]);

  return (
    <div className="container-editorial py-14">
      <div className="max-w-2xl">
        <div className="eyebrow">Meet the creators</div>
        <h1 className="mt-3 font-display text-5xl">
          Behind every work
          <br />
          is a story.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Independent artists, calligraphers, printmakers and photographers — verified and
          represented on ArtDera.
        </p>
      </div>
      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {creators.map((c) => (
          <Link key={c.slug} to="/creator/$slug" params={{ slug: c.slug }} className="group block">
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg">
              <img
                src={c.portrait}
                alt={c.name}
                className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                loading="lazy"
              />
              {c.verified && (
                <span
                  className="absolute top-3 left-3 chip"
                  style={{ background: "var(--porcelain)", color: "var(--ink)" }}
                >
                  ✓ Verified
                </span>
              )}
            </div>
            <div className="mt-4">
              <div className="font-display text-2xl">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {c.discipline} · {c.location}
              </div>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.bio}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

