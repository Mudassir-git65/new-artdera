import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronRight,
  Globe2,
  HeartHandshake,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CATEGORIES, COLLECTIONS, CREATORS, PRODUCTS, getProduct, IMAGES } from "@/lib/artdera";
import { useCurrency } from "@/marketplace/currency";
import { ProductCard } from "@/components/site/ProductCard";
import { NewsletterService, MarketplaceService } from "@/marketplace/services";
import { toast } from "sonner";
// import { ArtDeraScrollStory } from "@/components/site/scroll-story/ArtDeraScrollStory";

import {
  generateMeta,
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateBreadcrumbSchema,
} from "@/lib/seo";

const WALL_QUIZ_BUDGET_MAX: Record<string, number> = {
  "Under PKR 10,000": 10000,
  "Under PKR 25,000": 25000,
  "Under PKR 50,000": 50000,
  "PKR 50,000-100,000": 100000,
  "Collector pieces": 300000,
};

export const Route = createFileRoute("/")({
  head: () => {
    const seo = generateMeta({
      title: "ArtDera | Buy Original Art, Calligraphy, Photography & Decor",
      description:
        "ArtDera is a global art marketplace connecting independent artists, creators and galleries with buyers looking for original art, prints, photography, calligraphy and curated decor.",
      canonicalPath: "/",
    });

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(generateOrganizationSchema()),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(generateWebSiteSchema()),
        },
      ],
    };
  },
  component: Home,
});

function Home() {
  const { formatPrice } = useCurrency();
  const usedIds = new Set<string>();

  const consumeUnique = (candidates: typeof PRODUCTS, count: number) => {
    const result = candidates.filter((p) => !usedIds.has(p.slug)).slice(0, count);
    result.forEach((p) => usedIds.add(p.slug));
    return result;
  };

  const allProductsPremium = [...PRODUCTS].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.price - a.price;
  });

  // Step 1: Resolve featured artists first
  const featuredArtistSlugs = ["kausar-bhatti", "kamran-qazi-student", "abdul-rasheed-studio"];
  let featuredArtists = featuredArtistSlugs
    .map((slug) => CREATORS.find((c) => c.slug === slug))
    .filter(Boolean) as typeof CREATORS;

  // Fallback to first 3 creators if the named ones aren't found
  if (featuredArtists.length === 0 && CREATORS.length > 0) {
    featuredArtists = CREATORS.slice(0, 3);
  }

  // Step 2: For each featured artist, collect ALL of their own artworks (never stolen by other sections)
  const featuredArtistsWorks = featuredArtists.map((artist) => {
    // Match by works array AND by creatorSlug — covers all DB linking patterns
    const ownWorks = PRODUCTS.filter(
      (p) => (artist.works || []).includes(p.slug) || p.creatorSlug === artist.slug
    ).sort((a, b) => b.price - a.price).slice(0, 3);

    // Pre-reserve these slugs so NO other section can steal them
    ownWorks.forEach((p) => usedIds.add(p.slug));

    return { artist, works: ownWorks };
  });

  // Step 3: Now allocate remaining artworks to other sections (featured artists' works are already blocked)
  const collectorCandidate = allProductsPremium.find((p) => !usedIds.has(p.slug) && p.kind === "Original");
  const collectorCandidateList = collectorCandidate
    ? [collectorCandidate, ...allProductsPremium]
    : allProductsPremium;
  const collectorProducts = consumeUnique(collectorCandidateList, 1);
  const collector = collectorProducts[0];

  const collectionPicks = (COLLECTIONS[0]?.products ?? [])
    .map((s) => PRODUCTS.find((p) => p.slug === s)!)
    .filter(Boolean);
  let editPicks = consumeUnique(collectionPicks, 4);
  if (editPicks.length < 4) {
    editPicks = [...editPicks, ...consumeUnique(allProductsPremium, 4 - editPicks.length)];
  }

  const shopThisSpacePicks = consumeUnique(allProductsPremium, 3);

  const creatorSpotlightArtist = CREATORS.find((c) => !featuredArtistSlugs.includes(c.slug)) ?? CREATORS[0];
  const creatorSpotlightWorks = creatorSpotlightArtist
    ? consumeUnique(
        PRODUCTS.filter((p) => p.creatorSlug === creatorSpotlightArtist.slug || (creatorSpotlightArtist.works || []).includes(p.slug)),
        3
      )
    : [];

  const affordableCandidates = allProductsPremium.filter((p) => p.price < 50000);
  const affordablePicks = consumeUnique(affordableCandidates, 6);
  const remainingProducts = allProductsPremium.filter((p) => !usedIds.has(p.slug));

  return (
    <div>
      <CinematicHero />
      <TrustStrip />
      <FeaturedArtistsSection artistsData={featuredArtistsWorks} />
      <CategoryMosaic />
      <ArtDeraEdit products={editPicks} formatPrice={formatPrice} />
      <CurateWallQuiz formatPrice={formatPrice} availableProducts={remainingProducts} />
      <ShopThisSpace products={shopThisSpacePicks} formatPrice={formatPrice} />
      <CreatorSpotlight creator={creatorSpotlightArtist} works={creatorSpotlightWorks} />
      <CollectorSpotlight product={collector} formatPrice={formatPrice} />
      <BrowseByColour formatPrice={formatPrice} availableProducts={remainingProducts} />
      <CommissionPreview />
      <AIWorkSection />
      <AffordableDiscoveries products={affordablePicks} formatPrice={formatPrice} />
      <BusinessSection />
      <BuyerProtectionSection />
      <SellerInvitation />
      <JournalSection />
      <NewsletterSection />
      <section className="container-editorial pb-4">
        <div className="sr-only" aria-live="polite">
          Homepage loaded.
        </div>
      </section>
    </div>
  );
}

function FeaturedArtistsSection({
  artistsData,
}: {
  artistsData: { artist: (typeof CREATORS)[number]; works: typeof PRODUCTS }[];
}) {
  // We use the bootstrap works directly. They are guaranteed to be populated
  // during the initial load, meaning zero extra network requests are needed
  // to render this section.
  if (!artistsData.length) return null;

  return (
    <section className="bg-[var(--ink)] text-[var(--ivory)]">
      <div className="container-editorial section-y">
        {/* Custom heading that works correctly on dark background */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div
              className="text-[0.72rem] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "rgba(246,241,232,0.55)" }}
            >
              Featured
            </div>
            <h2 className="mt-3 font-display text-3xl md:text-4xl lg:text-5xl">
              Featured Artists
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed" style={{ color: "rgba(246,241,232,0.65)" }}>
              Meet distinguished artists shaping the ArtDera collection.
            </p>
          </div>
          <a
            href="/creators"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition"
            style={{
              border: "1px solid rgba(246,241,232,0.35)",
              color: "var(--ivory)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(246,241,232,0.12)";
              e.currentTarget.style.borderColor = "rgba(246,241,232,0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(246,241,232,0.35)";
            }}
          >
            View all creators
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {artistsData.map(({ artist, works }) => {
            return (
            <div
              key={artist.slug}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-white/5 transition duration-500 hover:border-white/30 hover:bg-white/10"
            >
              <div className="relative h-64 overflow-hidden">
                <img
                  src={artist.portrait}
                  alt={artist.name}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)] to-transparent opacity-80" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="font-display text-3xl">{artist.name}</div>
                  <div className="mt-1 text-sm" style={{ color: "rgba(246,241,232,0.7)" }}>{artist.discipline}</div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">

                <div className="mt-auto">
                  <Link
                    to="/creator/$slug"
                    params={{ slug: artist.slug }}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition"
                    style={{ background: "var(--ivory)", color: "var(--ink)" }}
                  >
                    View Artist
                  </Link>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CinematicHero() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[var(--ink)] text-white">
      <video
        ref={videoRef}
        aria-hidden="true"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={IMAGES.heroInterior}
        className="absolute inset-0 h-full w-full object-cover object-center"
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,23,23,0.82)_0%,rgba(23,23,23,0.52)_38%,rgba(23,23,23,0.16)_72%),linear-gradient(0deg,rgba(23,23,23,0.78)_0%,transparent_36%,rgba(23,23,23,0.24)_100%)]" />
      <div className="relative z-10 flex min-h-[100svh] items-end">
        <div className="container-editorial pb-24 pt-36 md:pb-28">
          <div className="max-w-3xl">
            <div className="eyebrow hero-reveal text-white/70">
              A Global Marketplace for Art &amp; Decor
            </div>
            <h1 className="mt-5 font-display text-[clamp(3.3rem,8vw,7.7rem)] leading-[0.92]">
              <span className="hero-reveal hero-reveal-delay-1 block">Discover Art.</span>
              <span className="hero-reveal hero-reveal-delay-2 block text-white/88">
                Shape Your Space.
              </span>
            </h1>
            <p className="hero-reveal hero-reveal-delay-3 mt-7 max-w-xl text-base leading-relaxed text-white/78 md:text-lg">
              Explore original works, expressive prints, calligraphy, photography and thoughtfully
              curated decor from independent creators, studios and galleries.
            </p>
            <div className="hero-reveal hero-reveal-delay-4 mt-9 flex flex-wrap gap-3">
              <Link to="/discover" className="btn-primary">
                Explore the Marketplace
              </Link>
              <a
                href="/sell"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/35 px-5 text-sm font-semibold text-white transition hover:bg-white hover:text-[var(--ink)]"
              >
                Sell on ArtDera
              </a>
            </div>
          </div>
          <a
            href="#artdera-scroll-story"
            className="scroll-cue absolute bottom-8 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60 md:flex"
          >
            Begin the story <ChevronRight className="h-4 w-4 rotate-90" />
          </a>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { icon: BadgeCheck, title: "Verified sellers", text: "Reviewed creator and studio profiles" },
    { icon: LockKeyhole, title: "Secure checkout", text: "Protected payment flow" },
    { icon: ShieldCheck, title: "Protected purchases", text: "Support for eligible orders" },
    { icon: Truck, title: "Nationwide delivery", text: "Careful, tracked shipping" },
    { icon: Sparkles, title: "Clear disclosure", text: "Originality and AI labels" },
  ];

  return (
    <section id="trust-strip" className="relative z-20 -mt-8">
      <div className="container-editorial">
        <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4 shadow-[var(--shadow-soft)] md:grid-cols-5">
          {items.map((item) => (
            <TrustItem key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustItem({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl p-3">
      <Icon className="mt-0.5 h-5 w-5 text-[var(--oxblood)]" />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}

function CategoryMosaic() {
  const classes = [
    "md:col-span-2 md:row-span-2 md:aspect-auto",
    "md:col-span-2",
    "",
    "",
    "md:col-span-2",
    "bg-[var(--ink)]",
  ];

  return (
    <section className="container-editorial section-y">
      <SectionHead
        eyebrow="Browse"
        title="Enter through the work, the room or the feeling."
        subtitle="An editorial gateway to originals, editions, calligraphy, photography, wall decor and commissions."
        cta={["View all", "/discover"]}
      />
      <div className="mt-10 grid auto-rows-[220px] grid-cols-1 gap-4 md:grid-cols-4 md:auto-rows-[250px]">
        {CATEGORIES.map((category, index) => (
          <a
            key={category.slug}
            href={`/discover?category=${category.slug}`}
            className={`group relative overflow-hidden rounded-xl ${classes[index]}`}
          >
            <img
              src={category.image}
              alt={category.name}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
              loading={index > 1 ? "lazy" : "eager"}
              fetchPriority={index === 0 ? "high" : index === 1 ? "low" : undefined}
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = "1";
                  img.src =
                    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=70&auto=format";
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/18 to-transparent transition group-hover:from-black/84" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <div className="font-display text-3xl">{category.name}</div>
              <p className="mt-2 max-w-sm translate-y-2 text-sm text-white/72 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block">
                {category.blurb}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/78">
                Explore <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function ArtDeraEdit({
  products,
  formatPrice,
}: {
  products: typeof PRODUCTS;
  formatPrice: (p: number) => string;
}) {
  const dominant = products[0];
  const supporting = products.slice(1, 4);
  if (!dominant) return null;

  return (
    <section className="bg-[var(--porcelain)]">
      <div className="container-editorial section-y">
        <SectionHead
          eyebrow="Curated"
          title="The ArtDera Edit"
          subtitle="A considered selection of works chosen for expressive quality, craftsmanship and the spaces they transform."
          cta={["View Collection", "/collections"]}
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
          <Link
            to="/product/$slug"
            params={{ slug: dominant.slug }}
            className="group relative min-h-[520px] overflow-hidden rounded-xl bg-[var(--ink)] text-white"
          >
            <img
              src={dominant.images[0]}
              alt={dominant.title}
              className="absolute inset-0 h-full w-full bg-[#ebe7df] object-contain opacity-88 transition duration-700 group-hover:scale-[1.025]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/18 to-transparent" />
            <div className="absolute bottom-0 max-w-lg p-6 md:p-8">
              <div className="eyebrow text-white/60">Dominant work</div>
              <h3 className="mt-3 font-display text-4xl md:text-5xl">{dominant.title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-white/72">{dominant.description}</p>
              <div className="mt-5 text-sm font-semibold">
                {formatPrice(dominant.price)} / {dominant.kind}
              </div>
            </div>
          </Link>
          <div className="grid gap-5">
            {supporting.map((product) => (
              <Link
                key={product.slug}
                to="/product/$slug"
                params={{ slug: product.slug }}
                className="group grid grid-cols-[120px_1fr] gap-4 rounded-xl border border-[var(--color-border)] bg-white/55 p-3 transition hover:border-[var(--oxblood)]"
              >
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="h-36 w-full rounded-lg bg-[#ebe7df] object-contain transition group-hover:scale-[1.02]"
                  loading="lazy"
                />
                <span className="py-2">
                  <span className="eyebrow">Museum caption</span>
                  <span className="mt-2 block font-display text-2xl">{product.title}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                    {product.medium} / {product.dimensions}
                  </span>
                  <span className="mt-3 block text-sm font-semibold">
                    {formatPrice(product.price)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CurateWallQuiz({
  formatPrice,
  availableProducts,
}: {
  formatPrice: (p: number) => string;
  availableProducts: typeof PRODUCTS;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({
    room: "Living room",
    mood: "Calm",
    colour: "ivory",
    size: "Medium",
    budget: "Under PKR 50,000",
  });

  const recommendation = useMemo(() => {
    const max = WALL_QUIZ_BUDGET_MAX[answers.budget] ?? 300000;
    const pool = availableProducts.length ? availableProducts : PRODUCTS;
    return (
      pool.find(
        (product) =>
          product.price <= max &&
          product.room.some((room) =>
            room.toLowerCase().includes(answers.room.toLowerCase().split(" ")[0]),
          ) &&
          product.colours.includes(answers.colour),
      ) ??
      pool.find((product) => product.price <= max) ??
      pool[0]
    );
  }, [answers, availableProducts]);

  const params = new URLSearchParams({
    room: answers.room.toLowerCase().replace(/ /g, "-"),
    q: `${answers.mood} ${answers.colour} ${answers.size}`,
  });

  return (
    <section className="container-editorial section-y">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div className="lg:sticky lg:top-32">
          <div className="eyebrow">Curate My Wall</div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">Find Art Made for Your Space</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Tell us about your room, style and budget. We will help you discover pieces that belong
            in your space.
          </p>
          <a href={`/discover?${params.toString()}`} className="btn-primary mt-7">
            Curate My Wall
          </a>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 shadow-[var(--shadow-soft)] md:p-7">
          <QuizGroup
            title="Which room are you styling?"
            field="room"
            answers={answers}
            setAnswers={setAnswers}
            options={[
              "Living room",
              "Bedroom",
              "Office",
              "Dining room",
              "Restaurant",
              "Hotel",
              "Other",
            ]}
          />
          <QuizGroup
            title="What mood do you prefer?"
            field="mood"
            answers={answers}
            setAnswers={setAnswers}
            options={["Calm", "Bold", "Minimal", "Cultural", "Luxurious", "Expressive"]}
          />
          <QuizGroup
            title="Which colours do you want?"
            field="colour"
            answers={answers}
            setAnswers={setAnswers}
            options={["terracotta", "indigo", "ivory", "oxblood", "ink", "stone"]}
          />
          <QuizGroup
            title="What size are you looking for?"
            field="size"
            answers={answers}
            setAnswers={setAnswers}
            options={["Small", "Medium", "Large", "Statement"]}
          />
          <QuizGroup
            title="What is your budget?"
            field="budget"
            answers={answers}
            setAnswers={setAnswers}
            options={Object.keys(WALL_QUIZ_BUDGET_MAX)}
          />
          {recommendation ? (
            <div className="mt-7 grid gap-4 rounded-xl bg-[var(--ivory)] p-4 md:grid-cols-[100px_1fr_auto] md:items-center">
              {recommendation.images[0] ? (
                <img
                  src={recommendation.images[0]}
                  alt={recommendation.title}
                  className="h-28 w-24 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-28 w-24 items-center justify-center rounded-lg bg-[var(--porcelain)] px-2 text-center text-[10px] text-muted-foreground">
                  Image coming soon
                </div>
              )}
              <div>
                <div className="eyebrow">Suggested starting point</div>
                <div className="mt-1 font-display text-2xl">{recommendation.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{recommendation.medium}</div>
              </div>
              <Link
                to="/product/$slug"
                params={{ slug: recommendation.slug }}
                className="btn-ghost"
              >
                View Work
              </Link>
            </div>
          ) : (
            <div className="mt-7 rounded-xl bg-[var(--ivory)] p-5 text-sm text-muted-foreground">
              No artwork is published yet. Your choices are ready, and matching work will appear
              here as soon as a seller publishes it.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function QuizGroup({
  title,
  field,
  answers,
  setAnswers,
  options,
}: {
  title: string;
  field: string;
  answers: Record<string, string>;
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
  options: string[];
}) {
  return (
    <div className="border-b border-[var(--color-border)] py-5 first:pt-0 last:border-0">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setAnswers((value) => ({ ...value, [field]: option }))}
            className="chip capitalize"
            style={
              answers[field] === option ? { background: "var(--ink)", color: "var(--ivory)" } : {}
            }
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShopThisSpace({
  products,
  formatPrice,
}: {
  products: typeof PRODUCTS;
  formatPrice: (p: number) => string;
}) {
  const hotProducts = products.length >= 3 ? products.slice(0, 3) : PRODUCTS.slice(0, 3);
  const [activeSlug, setActiveSlug] = useState(hotProducts[0]?.slug);
  const active = hotProducts.find((product) => product.slug === activeSlug) ?? hotProducts[0];
  const positions = [
    { x: "48%", y: "34%" },
    { x: "25%", y: "43%" },
    { x: "71%", y: "58%" },
  ];

  if (!active) return null;

  return (
    <section id="shop-this-space" className="bg-[var(--ink)] text-[var(--ivory)]">
      <div className="container-editorial section-y">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="eyebrow text-white/55">Interior discovery</div>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">Shop This Space</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/68">
              See how scale, colour and negative space can turn a room into a collection.
            </p>
            <div className="relative mt-8 overflow-hidden rounded-xl">
              <img
                src={IMAGES.heroInterior}
                alt="Sophisticated living room with art and decor"
                className="h-full min-h-[460px] w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              {positions.slice(0, hotProducts.length).map((spot, index) => (
                <button
                  key={hotProducts[index].slug}
                  type="button"
                  onClick={() => setActiveSlug(hotProducts[index].slug)}
                  onMouseEnter={() => setActiveSlug(hotProducts[index].slug)}
                  className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/18 text-sm font-bold backdrop-blur transition hover:scale-110 focus-visible:bg-white focus-visible:text-[var(--ink)]"
                  style={{ left: spot.x, top: spot.y }}
                  aria-label={`View product hotspot ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-5">
            <img
              src={active.images[0]}
              alt={active.title}
              className="aspect-[4/5] w-full rounded-xl bg-[#ebe7df] object-contain"
              loading="lazy"
            />
            <div className="mt-5">
              <div className="eyebrow text-white/50">Selected piece</div>
              <h3 className="mt-2 font-display text-3xl">{active.title}</h3>
              <div className="mt-1 text-sm text-white/65">{active.medium}</div>
              <div className="mt-4 font-semibold">{formatPrice(active.price)}</div>
              <Link
                to="/product/$slug"
                params={{ slug: active.slug }}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--ivory)] px-5 text-sm font-semibold text-[var(--ink)]"
              >
                View Product
              </Link>
            </div>
            <div className="mt-6 grid gap-3 md:hidden">
              {hotProducts.map((product) => (
                <button
                  key={product.slug}
                  type="button"
                  onClick={() => setActiveSlug(product.slug)}
                  className="rounded-xl border border-white/12 p-3 text-left text-sm"
                >
                  {product.title} / {formatPrice(product.price)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CreatorSpotlight({
  creator,
  works,
}: {
  creator: (typeof CREATORS)[number] | undefined;
  works: typeof PRODUCTS;
}) {
  if (!creator) return null;

  return (
    <section className="container-editorial section-y">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="relative overflow-hidden rounded-xl">
          <img
            src={creator.portrait}
            alt={creator.name}
            className="aspect-[4/5] w-full object-cover"
            loading="lazy"
          />
        </div>
        <div>
          <div className="eyebrow">Creator spotlight</div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">Behind Every Work Is a Story</h2>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {creator.bio}
          </p>
          <div className="mt-5 text-sm font-semibold">
            {creator.name} / {creator.location} / {creator.discipline}
          </div>
          <div className="mt-7 grid grid-cols-3 gap-3">
            {works.slice(0, 3).map((work) => (
              <Link
                key={work.slug}
                to="/product/$slug"
                params={{ slug: work.slug }}
                className="group block"
              >
                <img
                  src={work.images[0]}
                  alt={work.title}
                  className="aspect-square rounded-lg bg-[#ebe7df] object-contain transition group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </Link>
            ))}
          </div>
          <Link to="/creator/$slug" params={{ slug: creator.slug }} className="btn-primary mt-8">
            Visit Studio
          </Link>
        </div>
      </div>
    </section>
  );
}

function CollectorSpotlight({
  product,
  formatPrice,
}: {
  product: (typeof PRODUCTS)[number] | undefined;
  formatPrice: (p: number) => string;
}) {
  if (!product) return null;
  const creator = CREATORS.find((item) => item.slug === product.creatorSlug);

  return (
    <section className="bg-[var(--ink)] text-[var(--ivory)]">
      <div className="container-editorial section-y">
        <div className="grid gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <div className="grid grid-cols-[1fr_0.42fr] gap-4">
            <img
              src={product.images[0]}
              alt={product.title}
              className="min-h-[520px] rounded-xl bg-white/5 object-contain"
              loading="lazy"
            />
            <img
              src={product.images[0]}
              alt=""
              className="h-72 rounded-xl bg-white/5 object-contain lg:h-full"
              loading="lazy"
            />
          </div>
          <div>
            <div className="eyebrow text-white/55">Collector spotlight</div>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">
              One Work. One Story. One Owner.
            </h2>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="chip" style={{ background: "var(--ivory)", color: "var(--ink)" }}>
                One-of-one
              </span>
              <span
                className="chip"
                style={{ background: "rgba(255,255,255,0.12)", color: "var(--ivory)" }}
              >
                {product.year}
              </span>
            </div>
            <h3 className="mt-6 font-display text-3xl">{product.title}</h3>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm text-white/72">
              <div>
                <dt className="text-white">Creator</dt>
                <dd>{creator?.name}</dd>
              </div>
              <div>
                <dt className="text-white">Medium</dt>
                <dd>{product.medium}</dd>
              </div>
              <div>
                <dt className="text-white">Dimensions</dt>
                <dd>{product.dimensions}</dd>
              </div>
              <div>
                <dt className="text-white">Disclosure</dt>
                <dd>{product.kind}</dd>
              </div>
            </dl>
            <p className="mt-6 text-sm leading-relaxed text-white/68">
              Certificate and originality information are shown on the listing when supplied by the
              seller.
            </p>
            <div className="mt-6 font-display text-3xl">{formatPrice(product.price)}</div>
            <Link
              to="/product/$slug"
              params={{ slug: product.slug }}
              className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--ivory)] px-5 text-sm font-semibold text-[var(--ink)]"
            >
              Collect This Work
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrowseByColour({
  formatPrice,
  availableProducts,
}: {
  formatPrice: (p: number) => string;
  availableProducts: typeof PRODUCTS;
}) {
  const options = [
    { label: "Terracotta", value: "terracotta", tone: "#B65F42" },
    { label: "Indigo", value: "indigo", tone: "#263454" },
    { label: "Ivory", value: "ivory", tone: "#F6F1E8" },
    { label: "Emerald", value: "green", tone: "#235747" },
    { label: "Monochrome", value: "ink", tone: "#171717" },
    { label: "Warm neutrals", value: "stone", tone: "#A89F94" },
    { label: "Pastels", value: "ivory", tone: "#E7DAD2" },
    { label: "Vibrant", value: "oxblood", tone: "#6E2334" },
  ];
  const [selected, setSelected] = useState(options[0]);
  const pool = availableProducts.length ? availableProducts : PRODUCTS;
  const products = useMemo(() => {
    const visible = pool.filter((product) => product.colours.includes(selected.value)).slice(0, 4);
    return visible.length ? visible : pool.slice(0, 4);
  }, [pool, selected.value]);

  return (
    <section
      id="browse-by-colour"
      className="section-y transition-colors"
      style={{ background: `color-mix(in oklab, ${selected.tone} 14%, var(--ivory))` }}
    >
      <div className="container-editorial">
        <SectionHead
          eyebrow="Colour discovery"
          title="Browse by colour"
          subtitle="Start with atmosphere, then move toward medium, scale and price."
        />
        <div className="mt-8 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setSelected(option)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--porcelain)] px-4 text-sm font-semibold"
            >
              <span
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ background: option.tone }}
              />
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={`${selected.label}-${product.slug}`} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CommissionPreview() {
  const [type, setType] = useState("Original painting");
  const [size, setSize] = useState("Medium");
  const [style, setStyle] = useState("Abstract");
  const [colour, setColour] = useState("Warm neutrals");
  const [budget, setBudget] = useState("PKR 50,000-100,000");
  const [deadline, setDeadline] = useState("6-8 weeks");
  const query = encodeURIComponent(`${type} ${size} ${style} ${colour} ${budget} ${deadline}`);

  return (
    <section className="container-editorial section-y">
      <div className="grid gap-8 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="eyebrow">Custom commissions</div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            Made for You, From the Beginning
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Shape the brief before you contact a creator. The result opens a commission-ready
            discovery path.
          </p>
          <a href={`/discover?category=custom-commissions&q=${query}`} className="btn-primary mt-7">
            Start a Commission
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectPill
            label="Artwork type"
            value={type}
            setValue={setType}
            options={["Original painting", "Calligraphy", "Photography print", "Mixed media"]}
          />
          <SelectPill
            label="Size"
            value={size}
            setValue={setSize}
            options={["Small", "Medium", "Large", "Statement"]}
          />
          <SelectPill
            label="Style"
            value={style}
            setValue={setStyle}
            options={["Abstract", "Minimal", "Cultural", "Expressive"]}
          />
          <SelectPill
            label="Colour mood"
            value={colour}
            setValue={setColour}
            options={["Warm neutrals", "Indigo", "Terracotta", "Monochrome"]}
          />
          <SelectPill
            label="Budget"
            value={budget}
            setValue={setBudget}
            options={["Under PKR 50,000", "PKR 50,000-100,000", "Collector piece"]}
          />
          <SelectPill
            label="Deadline"
            value={deadline}
            setValue={setDeadline}
            options={["4 weeks", "6-8 weeks", "Flexible"]}
          />
        </div>
      </div>
    </section>
  );
}

function SelectPill({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-full border border-[var(--color-border)] bg-white/60 px-4 text-sm"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function AIWorkSection() {
  return (
    <section className="container-editorial pb-16">
      <div className="grid gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--ivory)] p-6 md:grid-cols-[0.8fr_1.2fr] md:p-8">
        <div>
          <div className="eyebrow">AI-created work</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl">New Tools. New Expressions.</h2>
        </div>
        <div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Explore clearly labelled works created with emerging digital and generative tools.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["AI-generated", "AI-assisted", "Digitally created", "Printed edition"].map(
              (badge) => (
                <span key={badge} className="chip">
                  {badge}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AffordableDiscoveries({
  products,
  formatPrice,
}: {
  products: typeof PRODUCTS;
  formatPrice: (p: number) => string;
}) {
  return (
    <section id="affordable-discoveries" className="container-editorial section-y">
      <SectionHead
        eyebrow="Price-led collections"
        title="Affordable discoveries"
        subtitle="Begin with a budget, then let material, scale and feeling narrow the field."
        cta={["Shop under PKR 50,000", "/discover?max=50000"]}
      />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Under PKR 10,000", "/discover?max=10000"],
          ["Under PKR 25,000", "/discover?max=25000"],
          ["Under PKR 50,000", "/discover?max=50000"],
          ["Collector pieces", "/discover?kind=Original"],
        ].map(([label, href]) => (
          <a
            key={label}
            href={href}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4 font-display text-2xl transition hover:border-[var(--oxblood)]"
          >
            {label}
          </a>
        ))}
      </div>
      <div className="mt-10 flex snap-x gap-5 overflow-x-auto pb-4 no-scrollbar">
        {products.slice(0, 6).map((product) => (
          <div key={product.slug} className="w-[min(82vw,290px)] shrink-0 snap-start">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}

function BusinessSection() {
  return (
    <section className="bg-[var(--indigo)] text-[var(--ivory)]">
      <div className="container-editorial section-y">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <div className="eyebrow text-white/55">Interior designers and businesses</div>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">Art for Spaces That Matter</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70">
              Curated sourcing for interior designers, hotels, restaurants, offices, developers and
              corporate gifting teams.
            </p>
            <a
              href="/trade"
              className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--ivory)] px-5 text-sm font-semibold text-[var(--ink)]"
            >
              Work With ArtDera
            </a>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[Building2, Globe2, HeartHandshake].map((Icon, index) => (
              <div key={index} className="rounded-xl border border-white/12 bg-white/[0.06] p-5">
                <Icon className="h-6 w-6" />
                <div className="mt-10 text-sm text-white/72">
                  {["Hospitality sourcing", "International projects", "Corporate gifting"][index]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BuyerProtectionSection() {
  return (
    <section className="container-editorial section-y">
      <div className="grid gap-8 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-8 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <div className="eyebrow">Buyer protection</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl">Buy with confidence.</h2>
          <a href="/buyer-protection" className="btn-ghost mt-6">
            How ArtDera Protects You
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Verified seller information", "Creator profiles and listing details are reviewed."],
            ["Protected purchase process", "Support is available for eligible order issues."],
            ["Delivery tracking", "Sellers provide tracked dispatch where available."],
            ["Clear return eligibility", "Product pages keep return context visible."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-xl bg-white/55 p-4">
              <div className="font-semibold">{title}</div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SellerInvitation() {
  return (
    <section className="container-editorial pb-16">
      <div className="relative overflow-hidden rounded-2xl bg-[var(--ink)] text-white">
        <img
          src={IMAGES.creator1}
          alt="Artist working in studio"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/86 via-black/54 to-black/10" />
        <div className="relative max-w-2xl p-7 md:p-12">
          <div className="eyebrow text-white/55">Sell on ArtDera</div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            Your Work Deserves a Wider World
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/72">
            Build your storefront, reach serious buyers and manage products, commissions and orders
            from one place.
          </p>
          <a
            href="/sell"
            className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--ivory)] px-5 text-sm font-semibold text-[var(--ink)]"
          >
            Apply to Sell
          </a>
        </div>
      </div>
    </section>
  );
}

function JournalSection() {
  const articles = [
    ["Choosing your first original", "Scale, budget and how to trust your eye.", IMAGES.art1],
    [
      "Framing calligraphy well",
      "Materials, mounts and the small choices that let a work breathe.",
      IMAGES.art2,
    ],
    ["Living with photography", "Where fine-art prints belong, and how to hang them.", IMAGES.art3],
  ];

  return (
    <section className="container-editorial pb-16">
      <SectionHead
        eyebrow="Journal"
        title="Stories for meaningful spaces"
        cta={["Read the journal", "/journal"]}
      />
      <div className="mt-10 grid gap-5 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        {articles.map(([title, text, image], index) => (
          <a key={title as string} href="/journal" className="group block">
            <div
              className={`overflow-hidden rounded-xl ${index === 0 ? "aspect-[16/10]" : "aspect-[4/3]"}`}
            >
              <img
                src={image as string}
                alt=""
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                loading="lazy"
              />
            </div>
            <div className="mt-4 font-display text-2xl">{title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function NewsletterSection() {
  return (
    <section className="container-editorial pb-20">
      <div className="grid gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:grid-cols-[1fr_1fr] md:items-center md:p-8">
        <div>
          <div className="eyebrow">Newsletter</div>
          <h2 className="mt-3 font-display text-4xl">A More Beautiful Inbox</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            New collections, creator stories and inspiration for meaningful spaces.
          </p>
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) =>
            void (async () => {
              event.preventDefault();
              const form = event.currentTarget;
              const email = String(new FormData(form).get("email") ?? "");
              const result = await NewsletterService.subscribe(email, "homepage");
              if (result.error) return toast.error(result.error.message);
              form.reset();
              toast.success("Newsletter preference saved");
            })()
          }
        >
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="art-input min-h-12 flex-1"
          />
          <button type="submit" className="btn-primary">
            Join
          </button>
        </form>
      </div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
  cta,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  cta?: [string, string];
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-3xl">
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="mt-3 font-display text-3xl md:text-4xl lg:text-5xl">{title}</h2>
        {subtitle && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {cta && (
        <a href={cta[1]} className="btn-ghost">
          {cta[0]}
          <ArrowRight className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
