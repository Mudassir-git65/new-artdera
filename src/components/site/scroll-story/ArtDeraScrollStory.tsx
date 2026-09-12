import { Link } from "@tanstack/react-router";
import { Heart, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import type { Product } from "@/lib/artdera";
import { CREATORS, formatPKR, IMAGES } from "@/lib/artdera";
import { ScrollStoryArtwork } from "./ScrollStoryArtwork";
import { ScrollStoryProgress } from "./ScrollStoryProgress";
import { ScrollStoryRoom } from "./ScrollStoryRoom";
import { useScrollStory } from "./useScrollStory";

export function ArtDeraScrollStory({
  product,
  collectionHref = "/collections",
  roomImage = IMAGES.heroInterior,
}: {
  product: Product;
  collectionHref?: string;
  roomImage?: string;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { activeStep, skipToEnd } = useScrollStory(sectionRef);
  const creator = CREATORS.find((item) => item.slug === product.creatorSlug);
  const productLinksActive = activeStep >= 5;

  return (
    <section
      id="artdera-scroll-story"
      ref={sectionRef}
      className="artdera-scroll-story"
      aria-labelledby="artdera-scroll-story-title"
    >
      <div className="sr-only">
        <h2 id="artdera-scroll-story-title">From imagination to your space</h2>
        <p>
          A scroll-controlled story showing a blank canvas becoming a finished work, entering an
          interior and becoming a shoppable ArtDera marketplace product.
        </p>
      </div>

      <ReducedMotionStory
        product={product}
        creatorName={creator?.name ?? "ArtDera creator"}
        collectionHref={collectionHref}
        roomImage={roomImage}
      />

      <div className="scroll-story-motion">
        <div className="scroll-story-sticky">
          <button type="button" className="scroll-story-skip" onClick={skipToEnd}>
            Skip experience
          </button>

          <ScrollStoryProgress activeStep={activeStep} />

          <div className="scroll-story-composition">
            <ScrollStoryRoom image={roomImage} />

            <div className="scroll-story-canvas-wrap">
              <ScrollStoryArtwork />
            </div>

            <StoryCopy />

            <ProductCaption
              product={product}
              creatorName={creator?.name ?? "ArtDera creator"}
              collectionHref={collectionHref}
              linksActive={productLinksActive}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StoryCopy() {
  return (
    <div className="scroll-story-copy" aria-hidden="true">
      <p className="scroll-story-copy__line scroll-story-copy__line--idea">
        Every space begins with an idea.
      </p>
      <p className="scroll-story-copy__line scroll-story-copy__line--expression">
        An idea becomes expression.
      </p>
      <p className="scroll-story-copy__line scroll-story-copy__line--creation">
        Shaped by imagination, culture and craft.
      </p>
      <p className="scroll-story-copy__line scroll-story-copy__line--framing">
        A creation becomes something worth keeping.
      </p>
      <p className="scroll-story-copy__line scroll-story-copy__line--room">
        Created by someone. Chosen by you.
      </p>
    </div>
  );
}

function ProductCaption({
  product,
  creatorName,
  collectionHref,
  linksActive,
}: {
  product: Product;
  creatorName: string;
  collectionHref: string;
  linksActive: boolean;
}) {
  const tabIndex = linksActive ? 0 : -1;

  return (
    <aside
      className="scroll-story-product"
      data-active={linksActive || undefined}
      aria-label={`${product.title} marketplace preview`}
    >
      <div className="eyebrow">Now on ArtDera</div>
      <h3>{product.title}</h3>
      <p>
        {creatorName}
        <span aria-hidden="true"> / </span>
        {product.medium}
      </p>
      <div className="scroll-story-product__meta">
        <span>{product.kind === "Original" ? "One-of-One Original" : product.kind}</span>
        <span>Creation type disclosed</span>
      </div>
      <strong>{formatPKR(product.price)}</strong>
      <div className="scroll-story-product__actions">
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          className="btn-primary"
          tabIndex={tabIndex}
        >
          View the Work
        </Link>
        <a href={collectionHref} className="btn-ghost" tabIndex={tabIndex}>
          Explore the Collection
        </a>
        <a href="/wishlist" className="scroll-story-wishlist" tabIndex={tabIndex}>
          <Heart className="h-4 w-4" />
          Save to Wishlist
        </a>
      </div>
    </aside>
  );
}

function ReducedMotionStory({
  product,
  creatorName,
  collectionHref,
  roomImage,
}: {
  product: Product;
  creatorName: string;
  collectionHref: string;
  roomImage: string;
}) {
  return (
    <div className="scroll-story-reduced">
      <div className="container-editorial">
        <div className="scroll-story-reduced__panel">
          <div className="scroll-story-reduced__visual">
            <img src={roomImage} alt="" />
            <div>
              <img src={product.images[0]} alt={product.title} />
            </div>
          </div>
          <div>
            <div className="eyebrow">The ArtDera journey</div>
            <h2>From imagination to your space.</h2>
            <p>
              Discover original works, prints and decor from independent creators, then bring the
              right piece into a meaningful space.
            </p>
            <div className="scroll-story-reduced__trust">
              <ShieldCheck className="h-4 w-4" />
              {product.kind} by {creatorName} / {formatPKR(product.price)}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/product/$slug" params={{ slug: product.slug }} className="btn-primary">
                View the Work
              </Link>
              <a href={collectionHref} className="btn-ghost">
                Explore the Collection
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
