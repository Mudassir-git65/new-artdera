import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { IMAGES, SOCIAL_LINKS } from "@/lib/artdera";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — ArtDera" },
      {
        name: "description",
        content:
          "ArtDera is a global marketplace for art and décor — a meeting place for independent creators, galleries and considered buyers.",
      },
      { property: "og:title", content: "About — ArtDera" },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: About,
});

function About() {
  return (
    <div>
      <section className="container-editorial py-16 lg:py-24 max-w-4xl">
        <div className="eyebrow">About ArtDera</div>
        <h1 className="mt-4 font-display text-5xl md:text-7xl leading-[1]">
          A meeting place
          <br />
          for makers and
          <br />
          collectors.
        </h1>
        <p className="mt-8 text-lg text-muted-foreground max-w-2xl">
          <em>Dera</em> is a home, a gathering place, a destination. Read internationally, ArtDera
          reads as <em>Art + Era</em> — a new era of creativity. Both meanings sit at the heart of
          what we're building: a considered, global marketplace where independent creators, studios
          and galleries meet the people who love their work.
        </p>
      </section>

      <section className="relative aspect-[16/7] overflow-hidden">
        <img
          src={IMAGES.heroInterior}
          alt="Interior with artwork"
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </section>

      <section className="container-editorial py-20 grid lg:grid-cols-[1fr_1.5fr] gap-14">
        <div>
          <div className="eyebrow">What we believe</div>
          <h2 className="mt-3 font-display text-3xl">Principles.</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-10 text-[15px]">
          {[
            [
              "Creators first",
              "The people who make the work sit at the centre of our platform. Better tools, fairer commissions, real support.",
            ],
            [
              "Trust is a product feature",
              "Verified identities, disclosed materials, protected payouts and human dispute resolution — designed in, not bolted on.",
            ],
            [
              "Human and machine, clearly labelled",
              "We welcome AI-assisted work as a distinct category. Every listing declares how it was made.",
            ],
            [
              "Culturally rooted, globally ambitious",
              "Launching in Pakistan, built to ship worldwide.",
            ],
          ].map(([t, d]) => (
            <div key={t}>
              <div className="font-semibold">{t}</div>
              <div className="mt-1 text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-editorial pb-20">
        <div className="mb-10 text-center max-w-xl mx-auto">
          <div className="eyebrow">Join the Community</div>
          <h2 className="mt-2 font-display text-4xl">Follow ArtDera online</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Explore creator stories, behind-the-scenes studio tours, and curated artwork across our
            official channels.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SOCIAL_LINKS.map((item) => {
            const Icon =
              item.name === "YouTube"
                ? Youtube
                : item.name === "Instagram"
                  ? Instagram
                  : item.name === "LinkedIn"
                    ? Linkedin
                    : Facebook;
            return (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 transition duration-300 hover:-translate-y-1 hover:border-[var(--oxblood)] hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--ink)] text-white transition duration-300 group-hover:scale-110">
                      <Icon className="h-6 w-6" />
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-hover:text-[var(--oxblood)]" />
                  </div>
                  <h3 className="mt-5 font-display text-2xl">{item.name}</h3>
                  <div className="text-xs font-medium text-[var(--oxblood)]">{item.handle}</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <div className="mt-6 text-xs font-semibold text-foreground underline-offset-4 group-hover:underline">
                  Visit {item.name} &rarr;
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section className="container-editorial pb-20">
        <div
          className="rounded-2xl p-10 md:p-16 text-center"
          style={{ background: "var(--ink)", color: "var(--ivory)" }}
        >
          <div
            className="eyebrow"
            style={{ color: "color-mix(in oklab, var(--ivory) 60%, transparent)" }}
          >
            A Global Marketplace for Art &amp; Décor
          </div>
          <h2 className="mt-4 font-display text-4xl md:text-6xl">
            Discover Art. Shape Your Space.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/discover"
              className="btn-primary"
              style={{ background: "var(--terracotta)", color: "var(--ink)" }}
            >
              Explore the marketplace
            </a>
            <a
              href="/sell"
              className="btn-ghost"
              style={{ borderColor: "var(--ivory)", color: "var(--ivory)" }}
            >
              Sell on ArtDera
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
