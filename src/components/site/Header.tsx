import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ChevronDown,
  Facebook,
  Heart,
  Instagram,
  Linkedin,
  Menu,
  MessageCircle,
  Search,
  ShoppingBag,
  Sparkles,
  User,
  X,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CATEGORIES, CREATORS, IMAGES, PRODUCTS, SOCIAL_LINKS, formatPKR } from "@/lib/artdera";
import { cn } from "@/lib/utils";
import { useAuth } from "@/marketplace/auth";
import { useCurrency, CURRENCIES } from "@/marketplace/currency";
import { Logo } from "./Logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV = [
  { label: "Explore Art", href: "/discover" },
  { label: "Artists", href: "/creators" },
  { label: "Galleries", href: "/galleries" },
  { label: "Collections", href: "/collections" },
  { label: "Ambassadors", href: "/affiliate" },
];

const DISCOVER_LINKS = [
  ["Shop by category", "/discover"],
  ["Browse by room", "/#shop-this-space"],
  ["Browse by colour", "/#browse-by-colour"],
  ["Browse by price", "/#affordable-discoveries"],
  ["New arrivals", "/discover?q=new"],
  ["The ArtDera Edit", "/collections"],
  ["Featured creator", "/creators"],
  ["Limited editions", "/discover?kind=Limited%20Edition"],
];

export function Announcement({ light = false }: { light?: boolean }) {
  return (
    <div
      className={cn(
        "hidden border-b text-[11px] uppercase tracking-[0.15em] transition-colors sm:block",
        light ? "border-white/15 text-white/75" : "border-white/10 text-[var(--ivory)]",
      )}
      style={!light ? { backgroundColor: "var(--ink)" } : undefined}
    >
      <div className="container-editorial flex items-center justify-center gap-6 py-2">
        <span>Verified sellers</span>
        <span className="opacity-40">/</span>
        <span>Protected purchases</span>
        <span className="opacity-40">/</span>
        <a href="/sell" className="underline-offset-4 hover:underline">
          Apply to sell on ArtDera
        </a>
      </div>
    </div>
  );
}

export function Header() {
  const { user } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const locationHref = useRouterState({ select: (state) => state.location.href });
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isHome = pathname === "/";
  const heroMode = isHome && !scrolled && !drawerOpen && !searchOpen;
  const loginHref = `/auth/login?redirect=${encodeURIComponent(locationHref || pathname)}`;
  const accountHref = user ? (user.role === "admin" ? "/admin" : "/account") : loginHref;
  const sellerWorkspace = Boolean(
    user && ["artist", "gallery", "gallery_staff"].includes(user.role),
  );
  const sellerHref = sellerWorkspace ? "/artist/dashboard" : "/sell";
  const sellerLabel = sellerWorkspace ? "Seller Dashboard" : "Sell on ArtDera";

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 28);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const linkTone = heroMode
    ? "text-white/82 hover:text-white"
    : "text-foreground/78 hover:text-foreground";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        heroMode
          ? "text-white"
          : "border-b border-[var(--color-border)] text-foreground shadow-[0_8px_30px_rgba(23,23,23,0.06)]",
      )}
      style={{
        background: heroMode
          ? "linear-gradient(to bottom, rgba(23,23,23,0.54), rgba(23,23,23,0.16), transparent)"
          : "color-mix(in oklab, var(--ivory) 88%, transparent)",
        backdropFilter: heroMode ? "none" : "blur(18px)",
      }}
    >
      <Announcement light={heroMode} />
      <div className="container-editorial">
        <div
          className={cn(
            "flex items-center justify-between transition-all duration-500",
            scrolled ? "h-14" : "h-[4.5rem]",
          )}
        >
          <div className="flex min-w-0 items-center gap-8">
            <Logo variant={heroMode ? "light" : "dark"} />
            <nav className="hidden items-center gap-5 text-[13px] font-semibold xl:flex">
              <div
                className="relative"
                onMouseEnter={() => setMegaOpen(true)}
                onMouseLeave={() => setMegaOpen(false)}
              >
                <button
                  className={cn("inline-flex items-center gap-1 transition-colors", linkTone)}
                  aria-expanded={megaOpen}
                  onFocus={() => setMegaOpen(true)}
                >
                  Discover <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {megaOpen && <DiscoverMegaMenu onClose={() => setMegaOpen(false)} />}
              </div>
              {NAV.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={cn("whitespace-nowrap transition-colors", linkTone)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as any)}
              className={cn(
                "hidden h-10 cursor-pointer appearance-none rounded-full border border-transparent bg-transparent pl-3 pr-2 text-[13px] font-semibold transition hover:bg-secondary focus:outline-none xl:block",
                heroMode ? "text-white hover:bg-white/12" : "text-foreground",
              )}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code} className="text-foreground bg-background">
                  {c.code}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search ArtDera"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
                heroMode ? "hover:bg-white/12" : "hover:bg-secondary",
              )}
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
            <a
              aria-label="Wishlist"
              href="/wishlist"
              className={cn(
                "hidden h-10 w-10 items-center justify-center rounded-full transition sm:inline-flex",
                heroMode ? "hover:bg-white/12" : "hover:bg-secondary",
              )}
            >
              <Heart className="h-[18px] w-[18px]" />
            </a>
            <a
              aria-label="Messages"
              href="/messages"
              className={cn(
                "hidden h-10 w-10 items-center justify-center rounded-full transition md:inline-flex",
                heroMode ? "hover:bg-white/12" : "hover:bg-secondary",
              )}
            >
              <MessageCircle className="h-[18px] w-[18px]" />
            </a>
            <a
              aria-label="Account"
              href={accountHref}
              className={cn(
                "hidden h-10 w-10 items-center justify-center rounded-full transition sm:inline-flex",
                heroMode ? "hover:bg-white/12" : "hover:bg-secondary",
              )}
            >
              <User className="h-[18px] w-[18px]" />
            </a>
            <a
              aria-label="Cart"
              href="/cart"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
                heroMode ? "hover:bg-white/12" : "hover:bg-secondary",
              )}
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
            </a>
            <a
              href={sellerHref}
              className={cn(
                "ml-2 hidden rounded-full px-4 py-2 text-sm font-semibold transition md:inline-flex",
                heroMode
                  ? "border border-white/25 text-white hover:bg-white hover:text-[var(--ink)]"
                  : "bg-[var(--ink)] text-[var(--ivory)] hover:-translate-y-0.5",
              )}
            >
              {sellerLabel}
            </a>
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-full transition xl:hidden",
                    heroMode ? "hover:bg-white/12" : "hover:bg-secondary",
                  )}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <MobileDrawer
                onNavigate={() => setDrawerOpen(false)}
                onSearch={() => setSearchOpen(true)}
                accountHref={accountHref}
                sellerHref={sellerHref}
                sellerLabel={sellerLabel}
              />
            </Sheet>
          </div>
        </div>
      </div>
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}

function DiscoverMegaMenu({ onClose }: { onClose: () => void }) {
  const featured = PRODUCTS.find((product) => product.featured) ?? PRODUCTS[0];
  if (!featured)
    return (
      <div className="absolute left-0 top-8 w-[520px] rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4 text-[var(--ink)] shadow-[var(--shadow-lift)]">
        <div className="grid grid-cols-2 gap-1">
          {DISCOVER_LINKS.map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={onClose}
              className="group flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-[var(--ivory)]"
            >
              {label}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-40" />
            </a>
          ))}
        </div>
        <p className="px-3 pb-2 pt-4 text-xs text-muted-foreground">
          New artwork will appear here after it is published.
        </p>
      </div>
    );
  const creator = CREATORS.find((item) => item.slug === featured.creatorSlug);

  return (
    <div className="absolute left-0 top-8 w-[760px] rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4 text-[var(--ink)] shadow-[var(--shadow-lift)]">
      <div className="grid grid-cols-[1.2fr_0.9fr] gap-5">
        <div className="grid grid-cols-2 gap-1">
          {DISCOVER_LINKS.map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={onClose}
              className="group flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-[var(--ivory)]"
            >
              {label}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
            </a>
          ))}
        </div>
        <a
          href={`/product/${featured.slug}`}
          onClick={onClose}
          className="group block overflow-hidden rounded-xl bg-[var(--ink)] text-white"
        >
          <div className="relative h-44 overflow-hidden">
            <img
              src={featured.images[0]}
              alt={featured.title}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                Featured creator
              </div>
              <div className="mt-1 font-display text-xl">{creator?.name}</div>
            </div>
          </div>
          <div className="p-4 text-xs text-white/72">
            <div className="font-semibold text-white">{featured.title}</div>
            <div className="mt-1">
              {formatPKR(featured.price)} / {featured.kind}
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}

function SearchOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!normalized) return PRODUCTS.filter((product) => product.featured).slice(0, 4);
    return PRODUCTS.filter((product) => {
      const creator = CREATORS.find((item) => item.slug === product.creatorSlug);
      return [
        product.title,
        product.medium,
        product.kind,
        product.description,
        creator?.name,
        product.colours.join(" "),
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    }).slice(0, 4);
  }, [normalized]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    window.location.href = q ? `/discover?q=${encodeURIComponent(q)}` : "/discover";
  }

  const suggestions = [
    "Warm abstract art for a neutral living room",
    "Black calligraphy under PKR 25,000",
    "Large blue artwork for an office",
    "Limited-edition photography",
    "Custom wedding calligraphy",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-20 max-h-[calc(100vh-7rem)] max-w-5xl translate-y-0 overflow-y-auto rounded-2xl bg-[var(--porcelain)] p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-[var(--color-border)] p-5 pr-12 text-left">
          <DialogTitle className="font-display text-3xl font-normal">
            Describe what belongs on your wall.
          </DialogTitle>
          <DialogDescription>
            Search products, creators, categories and collection ideas.
          </DialogDescription>
        </DialogHeader>
        <div className="p-5">
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="global-search">
              Search ArtDera
            </label>
            <input
              id="global-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="Warm abstract art for a neutral living room"
              className="art-input min-h-12 flex-1"
            />
            <button type="submit" className="btn-primary min-h-12">
              Search
            </button>
          </form>
          <div className="mt-6 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <div className="eyebrow">Suggestions</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setQuery(item)}
                    className="chip text-left"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-8 grid grid-cols-2 gap-2">
                {CATEGORIES.slice(0, 6).map((category) => (
                  <a
                    href={`/discover?category=${category.slug}`}
                    key={category.slug}
                    className="rounded-xl border border-[var(--color-border)] bg-white/45 p-3 text-sm font-semibold transition hover:border-[var(--oxblood)]"
                  >
                    {category.name}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="eyebrow">Products</div>
                <a href="/discover" className="text-xs font-semibold hover:underline">
                  View all
                </a>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {matches.map((product) => {
                  const creator = CREATORS.find((item) => item.slug === product.creatorSlug);
                  return (
                    <a
                      key={product.slug}
                      href={`/product/${product.slug}`}
                      className="group grid grid-cols-[76px_1fr] gap-3 rounded-xl border border-[var(--color-border)] bg-white/50 p-2 transition hover:border-[var(--oxblood)]"
                    >
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="h-24 w-full rounded-lg object-cover"
                      />
                      <span className="min-w-0 py-1">
                        <span className="block truncate font-display text-xl">{product.title}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {creator?.name}
                        </span>
                        <span className="mt-2 block text-sm font-semibold">
                          {formatPKR(product.price)}
                        </span>
                      </span>
                    </a>
                  );
                })}
              </div>
              <div className="mt-5 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--ink)] text-white">
                <div className="grid sm:grid-cols-[1fr_160px]">
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
                      <Sparkles className="h-3.5 w-3.5" /> The ArtDera Edit
                    </div>
                    <p className="mt-2 text-sm text-white/78">
                      A concise editorial collection for expressive rooms and serious first
                      purchases.
                    </p>
                  </div>
                  <img
                    src={IMAGES.heroInterior}
                    alt=""
                    className="hidden h-full w-full object-cover sm:block"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MobileDrawer({
  onNavigate,
  onSearch,
  accountHref,
  sellerHref,
  sellerLabel,
}: {
  onNavigate: () => void;
  onSearch: () => void;
  accountHref: string;
  sellerHref: string;
  sellerLabel: string;
}) {
  return (
    <SheetContent className="w-full overflow-y-auto bg-[var(--porcelain)] p-0 sm:max-w-md">
      <SheetHeader className="border-b border-[var(--color-border)] p-5 text-left">
        <SheetTitle asChild>
          <div>
            <Logo />
          </div>
        </SheetTitle>
        <SheetDescription>Art, decor, creators and collections.</SheetDescription>
      </SheetHeader>
      <div className="p-5">
        <button
          type="button"
          onClick={() => {
            onNavigate();
            onSearch();
          }}
          className="flex min-h-12 w-full items-center gap-3 rounded-full border border-[var(--color-border)] bg-white/60 px-4 text-left text-sm text-muted-foreground"
        >
          <Search className="h-4 w-4" />
          Describe what belongs on your wall...
        </button>

        <div className="mt-6 space-y-4">
          <details
            open
            className="group rounded-xl border border-[var(--color-border)] bg-white/45 p-4"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              Discover
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid gap-1">
              {DISCOVER_LINKS.slice(0, 6).map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  onClick={onNavigate}
                  className="rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-[var(--ivory)] hover:text-foreground"
                >
                  {label}
                </a>
              ))}
            </div>
          </details>
          <details
            open
            className="group rounded-xl border border-[var(--color-border)] bg-white/45 p-4"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              Marketplace
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid gap-1">
              {NAV.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  className="rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-[var(--ivory)] hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </details>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 text-sm font-semibold">
          {utilityLinks.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={label === "Account" ? accountHref : href}
              onClick={onNavigate}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/45 px-3"
            >
              <Icon className="h-4 w-4" />
              {label}
            </a>
          ))}
        </div>

        <a href={sellerHref} onClick={onNavigate} className="btn-primary mt-6 w-full">
          {sellerLabel}
        </a>

        <div className="mt-8 border-t border-[var(--color-border)] pt-6">
          <div className="eyebrow text-muted-foreground">Follow ArtDera</div>
          <div className="mt-3 flex items-center gap-2">
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
                  aria-label={`Follow ArtDera on ${item.name}`}
                  title={`${item.name} (${item.handle})`}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-white/50 text-foreground/75 transition hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onNavigate}
        aria-label="Close menu"
        className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </SheetContent>
  );
}

const utilityLinks: Array<{ label: string; href: string; Icon: LucideIcon }> = [
  { label: "Wishlist", href: "/wishlist", Icon: Heart },
  { label: "Messages", href: "/messages", Icon: MessageCircle },
  { label: "Account", href: "/auth/login", Icon: User },
  { label: "Cart", href: "/cart", Icon: ShoppingBag },
];
