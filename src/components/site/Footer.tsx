import { Facebook, Instagram, Linkedin, Youtube, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "./Logo";
import { NewsletterService } from "@/marketplace/services";
import { SOCIAL_LINKS } from "@/lib/artdera";
import { useCurrency, CURRENCIES, CurrencyCode } from "@/marketplace/currency";

const ICON_MAP: Record<string, LucideIcon> = {
  YouTube: Youtube,
  Instagram: Instagram,
  LinkedIn: Linkedin,
  Facebook: Facebook,
};

const COLS = [
  {
    title: "Marketplace",
    links: [
      ["Discover", "/discover"],
      ["Painting", "/discover?category=painting"],
      ["Calligraphy", "/discover?category=calligraphy"],
      ["Photography", "/discover?category=photography"],
      ["Prints & Editions", "/discover?category=prints-editions"],
      ["Crochet", "/discover?category=crochet"],
    ],
  },
  {
    title: "Buyer Help",
    links: [
      ["How it works", "/how-it-works"],
      ["Buyer protection", "/buyer-protection"],
      ["Wishlist", "/wishlist"],
      ["Messages", "/messages"],
      ["Cart", "/cart"],
      ["Help centre", "/help"],
    ],
  },
  {
    title: "Seller Resources",
    links: [
      ["Sell on ArtDera", "/sell"],
      ["Seller plans", "/sell/plans"],
      ["Commissions", "/discover?category=custom-commissions"],
      ["Creator stories", "/journal"],
      ["Seller support", "/help"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Creators", "/creators"],
      ["Collections", "/collections"],
      ["Journal", "/journal"],
      ["Business services", "/trade"],
      ["Ambassador program", "/affiliate"],
    ],
  },
];

export function Footer() {
  const { currency, setCurrency } = useCurrency();
  return (
    <footer
      style={{ backgroundColor: "var(--ink)", color: "var(--ivory)" }}
      className="relative mt-24 overflow-hidden"
    >
      <div className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 font-display text-[22vw] leading-none text-white/[0.035]">
        ArtDera
      </div>
      <div className="container-editorial relative py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr_1fr]">
          <div>
            <Logo variant="light" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/66">
              A Global Marketplace for Art &amp; Decor. A trusted meeting place for independent
              creators, galleries and considered buyers.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {SOCIAL_LINKS.map((item) => {
                const Icon = ICON_MAP[item.name];
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Follow ArtDera on ${item.name}`}
                    title={`${item.name} (${item.handle})`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:scale-110 hover:border-white/60 hover:bg-white/10 hover:text-white"
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                  </a>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {COLS.map((col) => (
              <div key={col.title}>
                <div className="eyebrow text-white/48">{col.title}</div>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="text-white/72 transition hover:text-white">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <h4 className="font-display text-3xl">A More Beautiful Inbox</h4>
            <p className="mt-2 text-sm leading-relaxed text-white/66">
              New collections, creator stories and inspiration for meaningful spaces.
            </p>
            <form
              className="mt-5 flex gap-2"
              onSubmit={(event) =>
                void (async () => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const email = String(new FormData(form).get("email") ?? "");
                  const result = await NewsletterService.subscribe(email, "footer");
                  if (result.error) return toast.error(result.error.message);
                  form.reset();
                  toast.success("Newsletter preference saved");
                })()
              }
            >
              <label className="sr-only" htmlFor="footer-email">
                Email address
              </label>
              <input
                id="footer-email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="min-h-11 min-w-0 flex-1 rounded-full border border-white/18 bg-transparent px-4 text-sm outline-none placeholder:text-white/35 focus:border-white/60"
              />
              <button
                type="submit"
                className="min-h-11 rounded-full px-4 text-sm font-semibold"
                style={{ background: "var(--terracotta)", color: "var(--ink)" }}
              >
                Join
              </button>
            </form>
            <div className="mt-6 grid gap-2 text-xs text-white/62">
              <FooterSelect label="Ship to" value="Pakistan" />
              <FooterSelect
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
              />
              <FooterSelect label="Language" value="English" />
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50">
          <div>© {new Date().getFullYear()} ArtDera. Discover Art. Shape Your Space.</div>
          <div className="flex flex-wrap gap-4">
            <a href="/legal/terms" className="hover:text-white">
              Terms
            </a>
            <a href="/legal/privacy" className="hover:text-white">
              Privacy
            </a>
            <a href="/legal/cookies" className="hover:text-white">
              Cookies
            </a>
            <a href="/legal/copyright" className="hover:text-white">
              Copyright
            </a>
            <a href="/legal/ai-policy" className="hover:text-white">
              AI Policy
            </a>
            <a href="/legal/sponsored" className="hover:text-white">
              Sponsored Content
            </a>
            <a href="/legal/community" className="hover:text-white">
              Community
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: { value: string; label: string }[];
}) {
  if (!options) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-full border border-white/12 px-3 py-2">
        <span>{label}</span>
        <span className="text-white">{value}</span>
      </div>
    );
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-full border border-white/12 px-3 py-2">
      <span>{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="bg-transparent text-right text-white outline-none [&>option]:text-black"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
