import { createFileRoute, Link } from "@tanstack/react-router";
import { CREATORS } from "@/lib/artdera";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title: "Creators — ArtDera" },
      {
        name: "description",
        content: "Meet the independent artists, calligraphers and photographers on ArtDera.",
      },
      { property: "og:title", content: "Creators — ArtDera" },
      { property: "og:url", content: "/creators" },
    ],
    links: [{ rel: "canonical", href: "/creators" }],
  }),
  component: Creators,
});

function Creators() {
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
        {CREATORS.map((c) => (
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
