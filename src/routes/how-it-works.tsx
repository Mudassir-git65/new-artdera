import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How ArtDera works" },
      {
        name: "description",
        content: "How to buy on ArtDera — from discovering a work to receiving it at your door.",
      },
      { property: "og:title", content: "How ArtDera works" },
      { property: "og:url", content: "/how-it-works" },
    ],
    links: [{ rel: "canonical", href: "/how-it-works" }],
  }),
  component: HowItWorks,
});

function HowItWorks() {
  return (
    <div className="container-editorial py-16 max-w-4xl">
      <div className="eyebrow">How it works</div>
      <h1 className="mt-3 font-display text-5xl">From discovering a work to living with it.</h1>
      <ol className="mt-12 space-y-10">
        {[
          [
            "01",
            "Browse & discover",
            "Search by category, style, colour, room or creator. Every listing carries clear labels for what it is — Original, Limited Edition, Handmade, AI-assisted.",
          ],
          [
            "02",
            "Order with confidence",
            "Buy through secure checkout with local and international payment options. Cash on delivery is available on eligible orders within Pakistan.",
          ],
          [
            "03",
            "Careful shipping",
            "Fragile works are packed by studios using our packaging guidelines and shipped with tracking. Higher-value works are insured.",
          ],
          [
            "04",
            "Confirm & enjoy",
            "Once you've confirmed delivery, the seller is paid on our protected payout schedule. You have a 7-day window to raise a dispute if needed.",
          ],
          [
            "05",
            "Return or resolve, if needed",
            "Eligible orders can be returned. Our team supports dispute resolution end-to-end.",
          ],
        ].map(([n, t, d]) => (
          <li key={n} className="grid grid-cols-[auto_1fr] gap-6 items-start">
            <div className="font-display text-4xl text-muted-foreground">{n}</div>
            <div>
              <div className="font-display text-2xl">{t}</div>
              <div className="mt-2 text-muted-foreground">{d}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
