import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Facebook,
  HelpCircle,
  Instagram,
  Linkedin,
  MessageCircle,
  ShieldCheck,
  Truck,
  Youtube,
} from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/artdera";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Centre - ArtDera" },
      {
        name: "description",
        content: "Get help with buying, selling, delivery, returns and messages on ArtDera.",
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <div className="container-editorial py-16">
      <div className="max-w-2xl">
        <div className="eyebrow">Help centre</div>
        <h1 className="mt-3 font-display text-5xl">How can we help?</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Quick support paths for buying, selling, delivery, protection and messages.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-4">
        {[
          ["Buying art", "Explore products, quick view and product details.", HelpCircle],
          ["Delivery", "Track delivery expectations and seller updates.", Truck],
          ["Buyer protection", "Understand eligibility and dispute support.", ShieldCheck],
          ["Messages", "Contact creators about products or commissions.", MessageCircle],
        ].map(([title, text, Icon]) => (
          <a
            key={title as string}
            href={
              title === "Buyer protection"
                ? "/buyer-protection"
                : title === "Messages"
                  ? "/messages"
                  : "/discover"
            }
            className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 transition hover:border-[var(--oxblood)]"
          >
            <Icon className="h-6 w-6 text-[var(--oxblood)]" />
            <h2 className="mt-8 font-display text-2xl">{title as string}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text as string}</p>
          </a>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-8 md:p-10">
        <div className="eyebrow">Connect with us</div>
        <h2 className="mt-2 font-display text-3xl">Official Social Channels</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Follow ArtDera for real-time announcements, featured artist drop alerts, customer stories,
          and direct messaging support.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                className="group flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-white/70 p-4 transition hover:border-[var(--oxblood)] hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ink)] text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.handle}</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-40 transition group-hover:opacity-100 group-hover:text-[var(--oxblood)]" />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
