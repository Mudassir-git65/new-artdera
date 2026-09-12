import { LoaderCircle } from "lucide-react";

const routeLabels: Array<[RegExp, string]> = [
  [/^\/artist\/dashboard\/artworks\/new/, "Loading the artwork publisher"],
  [/^\/artist\/store-created/, "Opening your new store"],
  [/^\/artist\/onboarding/, "Loading your store setup"],
  [/^\/artist\/checkout/, "Preparing your plan checkout"],
  [/^\/artist\/dashboard|^\/dashboard/, "Loading your seller dashboard"],
  [/^\/admin/, "Loading the ArtDera admin workspace"],
  [/^\/account/, "Loading your collector account"],
  [/^\/checkout/, "Preparing your artwork checkout"],
  [/^\/payment\//, "Loading secure payment instructions"],
  [/^\/cart/, "Loading your artwork cart"],
  [/^\/wishlist/, "Loading your saved artworks"],
  [/^\/messages/, "Loading your ArtDera conversations"],
  [/^\/product\//, "Loading the selected artwork"],
  [/^\/store\//, "Loading the selected art store"],
  [/^\/discover/, "Loading art to discover"],
  [/^\/creators/, "Loading ArtDera creators"],
  [/^\/galleries/, "Loading ArtDera galleries"],
  [/^\/collections/, "Loading curated collections"],
  [/^\/auth\/login/, "Opening secure sign in"],
  [/^\/auth\/signup|^\/artist\/signup/, "Opening account creation"],
];

function loadingLabelForPath(pathname: string) {
  return routeLabels.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Loading ArtDera";
}

export function PageLoading({ label, compact = false }: { label?: string; compact?: boolean }) {
  const resolvedLabel =
    label ?? loadingLabelForPath(typeof window === "undefined" ? "/" : window.location.pathname);
  return (
    <div
      className={
        compact
          ? "flex items-center justify-center gap-3 px-5 py-4"
          : "flex min-h-[55vh] items-center justify-center bg-[var(--ivory)] px-5 py-16"
      }
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-[var(--oxblood)]" />
        <p className="mt-4 text-sm font-semibold text-foreground">{resolvedLabel}…</p>
        <p className="mt-1 text-xs text-muted-foreground">Please wait a moment.</p>
      </div>
    </div>
  );
}
