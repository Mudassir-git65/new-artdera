/**
 * ProductCardSkeleton — animated placeholder that matches ProductCard layout.
 * Shown while the first page of artworks loads to prevent blank/CLS screens.
 */
export function ProductCardSkeleton() {
  return (
    <article aria-hidden="true">
      {/* Image placeholder — 4:5 aspect ratio matching ProductCard */}
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-lg"
        style={{ background: "var(--porcelain)" }}
      >
        <div className="skeleton-pulse absolute inset-0" />
      </div>

      {/* Text placeholders */}
      <div className="mt-3.5 space-y-2">
        {/* Creator name */}
        <div
          className="skeleton-pulse h-3 w-24 rounded-full"
          style={{ background: "var(--porcelain)" }}
        />
        {/* Title */}
        <div
          className="skeleton-pulse h-5 w-4/5 rounded-md"
          style={{ background: "var(--porcelain)" }}
        />
        {/* Price + medium */}
        <div className="flex gap-2">
          <div
            className="skeleton-pulse h-3.5 w-20 rounded-full"
            style={{ background: "var(--porcelain)" }}
          />
          <div
            className="skeleton-pulse h-3.5 w-28 rounded-full"
            style={{ background: "var(--porcelain)" }}
          />
        </div>
      </div>

      <style>{`
        .skeleton-pulse {
          animation: skeletonShimmer 1.6s ease-in-out infinite;
          background: linear-gradient(
            90deg,
            var(--porcelain) 0%,
            color-mix(in oklab, var(--porcelain) 72%, var(--stone)) 50%,
            var(--porcelain) 100%
          );
          background-size: 200% 100%;
        }
        @keyframes skeletonShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </article>
  );
}
