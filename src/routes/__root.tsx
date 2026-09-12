import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AuthProvider, useAuth } from "@/marketplace/auth";
import { CurrencyProvider } from "@/marketplace/currency";
import { Toaster } from "@/components/ui/sonner";
import { generateOrganizationSchema, generateWebSiteSchema } from "@/lib/seo";
import { AffiliateService } from "@/marketplace/services";

function NotFoundComponent() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="eyebrow">404</div>
        <h1 className="mt-3 font-display text-4xl">This page is off the wall.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The work you're looking for may have moved or is no longer listed.
        </p>
        <a href="/" className="btn-primary mt-6">
          Return home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="eyebrow">Something interrupted the gallery</div>
        <h1 className="mt-3 font-display text-3xl">This page didn't load.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again in a moment, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-primary"
          >
            Try again
          </button>
          <a href="/" className="btn-ghost">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ArtDera - Discover Art. Shape Your Space." },
      {
        name: "description",
        content:
          "A premium marketplace for original works, prints, calligraphy, photography and curated decor from independent creators and galleries.",
      },
      { name: "author", content: "ArtDera" },
      { name: "theme-color", content: "#171717" },
      { property: "og:site_name", content: "ArtDera" },
      { property: "og:title", content: "ArtDera - Discover Art. Shape Your Space." },
      {
        property: "og:description",
        content:
          "A premium marketplace for original works, prints, calligraphy, photography and curated decor from independent creators and galleries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ArtDera - Discover Art. Shape Your Space." },
      {
        name: "twitter:description",
        content:
          "A premium marketplace for original works, prints, calligraphy, photography and curated decor from independent creators and galleries.",
      },
      {
        property: "og:image",
        content: "https://www.artdera.com/images/hero-interior.jpg",
      },
      {
        name: "twitter:image",
        content: "https://www.artdera.com/images/hero-interior.jpg",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      // DNS prefetch for upload CDN and image sources
      { rel: "preconnect", href: "https://images.unsplash.com" },
      // Google Fonts — preconnect before stylesheet so DNS is warm
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Optimized font stack: 3 Manrope weights (was 5) + 1 DM Serif variant (was 2)
      // display=swap means text renders in system font while custom font loads (no FOIT)
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Manrope:wght@400;600;700&display=swap",
      },
    ],
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
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <AuthProvider>
          <MarketplaceLayout />
        </AuthProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

function MarketplaceLayout() {
  const { catalogVersion, catalogReady } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const locationHref = useRouterState({ select: (state) => state.location.href });
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref")?.trim();
    if (!code || !/^[A-Za-z0-9]{5,20}$/.test(code)) return;
    const captureKey = `artdera-ref-captured:${code.toUpperCase()}:${locationHref}`;
    if (window.sessionStorage.getItem(captureKey)) return;
    window.sessionStorage.setItem(captureKey, "1");
    void AffiliateService.capture(code, `${window.location.pathname}${window.location.search}`);
  }, [locationHref]);

  const isHome = pathname === "/";
  const catalogDependent =
    isHome ||
    pathname === "/discover" ||
    pathname === "/creators" ||
    pathname === "/galleries" ||
    pathname === "/collections" ||
    pathname.startsWith("/product/") ||
    pathname.startsWith("/creator/") ||
    pathname.startsWith("/store/");
  const privateWorkspace =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/artist/dashboard") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/admin") ||
    [
      "/artist/checkout",
      "/artist/payment-success",
      "/artist/payment-failed",
      "/artist/onboarding",
      "/artist/store-created",
    ].includes(pathname);

  // Load AdSense lazily on public pages only — defer until after first render
  // so it never blocks LCP or dashboard page loads.
  useEffect(() => {
    if (privateWorkspace) return;
    if (document.querySelector('script[data-adsense]')) return;
    const script = document.createElement("script");
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6561467807135376";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-adsense", "1");
    document.head.appendChild(script);
  }, [privateWorkspace]);

  // For catalog-dependent public pages, render immediately and let each page
  // show its own skeleton/loading state. Only block rendering for auth-gated
  // private workspaces where the user's data is strictly required.
  const showLoadingScreen = privateWorkspace && !catalogReady;

  return (
    <>
      <div className="min-h-screen flex flex-col" data-catalog-version={catalogVersion}>
        <Header />
        <main className={`flex-1 ${isHome ? "" : "pt-[var(--header-height)]"}`}>
          {showLoadingScreen ? (
            <CatalogLoadingScreen />
          ) : (
            <Outlet key={catalogDependent ? catalogVersion : "stable"} />
          )}
        </main>
        {!privateWorkspace && <Footer />}
      </div>
      <Toaster position="top-right" richColors />
    </>
  );
}

function CatalogLoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Loading gallery"
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "2rem",
        background: "var(--ivory)",
      }}
    >
      {/* Animated ArtDera logo mark */}
      <div
        style={{
          width: "3.5rem",
          height: "3.5rem",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%" }}
          aria-hidden="true"
        >
          {/* Outer ring — spinning */}
          <circle
            cx="28"
            cy="28"
            r="24"
            stroke="var(--oxblood)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="120 30"
            style={{
              transformOrigin: "28px 28px",
              animation: "artderaSpinner 1.2s linear infinite",
            }}
          />
          {/* Inner static mark */}
          <path
            d="M20 36 L28 18 L36 36"
            stroke="var(--ink)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M22.5 30 H33.5" stroke="var(--oxblood)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: "var(--font-display, serif)",
            fontSize: "1.5rem",
            color: "var(--ink)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          ArtDera
        </p>
        <p
          style={{
            fontFamily: "var(--font-sans, sans-serif)",
            fontSize: "0.8rem",
            color: "var(--stone, #a89f94)",
            marginTop: "0.35rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Curating the gallery&hellip;
        </p>
      </div>

      {/* Skeleton strip */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginTop: "0.5rem",
        }}
      >
        {["6rem", "9rem", "6.5rem", "8rem"].map((w, i) => (
          <div
            key={i}
            style={{
              width: w,
              height: "0.55rem",
              borderRadius: "999px",
              background: "var(--porcelain, #fffdfc)",
              animation: `artderaPulse 1.5s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes artderaSpinner {
          to { transform: rotate(360deg); }
        }
        @keyframes artderaPulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
