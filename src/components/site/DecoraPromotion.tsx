import { ArrowUpRight, Gift } from "lucide-react";

export function DecoraPromotion() {
  return (
    <section aria-labelledby="decora-promotion-title" className="container-editorial section-y">
      <div className="grid overflow-hidden rounded-2xl bg-[#e9dfd2] md:grid-cols-2">
        <div className="relative min-h-64 md:order-2">
          <img
            src="/images/hero-interior.jpg"
            alt="Warm, art-filled interior with considered decorative details"
            loading="lazy"
            width={1000}
            height={750}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute bottom-5 right-5 rounded-full bg-[var(--ivory)] px-5 py-3 text-xs font-semibold">
            Every piece at PKR 3,000 or less
          </span>
        </div>
        <div className="p-7 sm:p-12 lg:p-16">
          <div className="eyebrow flex items-center gap-2 text-[var(--oxblood)]">
            <Gift className="h-4 w-4" /> Introducing ArtDera Décora
          </div>
          <h2
            id="decora-promotion-title"
            className="mt-5 font-display text-4xl leading-tight lg:text-5xl"
          >
            Artful Décor.
            <br />
            <em>Thoughtful Gifts.</em>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
            Small treasures for everyday living. Discover home décor, personalized gifts, prayer
            mats and handmade finds, all at PKR 3,000 or less.
          </p>
          <a href="/decora" className="btn-primary mt-7">
            Explore Décora <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
