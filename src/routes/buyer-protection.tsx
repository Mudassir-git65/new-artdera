import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/buyer-protection")({
  head: () => ({
    meta: [
      { title: "Buyer protection — ArtDera" },
      {
        name: "description",
        content:
          "ArtDera protects buyers with verified sellers, protected payouts, tracked shipping and human dispute resolution.",
      },
      { property: "og:title", content: "Buyer protection — ArtDera" },
      { property: "og:url", content: "/buyer-protection" },
    ],
    links: [{ rel: "canonical", href: "/buyer-protection" }],
  }),
  component: Protection,
});

function Protection() {
  return (
    <div className="container-editorial py-16 max-w-4xl">
      <div className="eyebrow">Buyer protection</div>
      <h1 className="mt-3 font-display text-5xl">Buy with confidence.</h1>
      <p className="mt-4 text-muted-foreground max-w-2xl">
        Every ArtDera order is backed by a set of practical safeguards designed for the way people
        buy — and sell — art.
      </p>
      <div className="mt-12 grid md:grid-cols-2 gap-8">
        {[
          [
            "Verified sellers",
            "Every seller passes identity, portfolio and studio review before their store goes live. Verified badges are earned, not automatic.",
          ],
          [
            "Clear labels on every work",
            "Original, Limited Edition, Handmade, AI-assisted or AI-generated — you always know exactly what you're buying.",
          ],
          [
            "Protected seller payouts",
            "Buyers pay through our payment provider. Sellers are paid only after the delivery confirmation window closes — funds are protected, not held in speculative 'escrow'.",
          ],
          [
            "Careful, tracked shipping",
            "Every order ships with tracking. Fragile pieces follow our packaging guidelines; orders above a threshold are insured.",
          ],
          [
            "7-day resolution window",
            "Not right for your space? Damaged in transit? Raise a case within seven days of delivery and our team steps in.",
          ],
          [
            "Human support",
            "Real people review copyright complaints, AI-content reports and disputes. We don't hide behind auto-replies.",
          ],
        ].map(([t, d]) => (
          <div
            key={t}
            className="rounded-xl border p-6"
            style={{ borderColor: "var(--color-border)", background: "var(--porcelain)" }}
          >
            <div className="font-display text-xl">{t}</div>
            <div className="mt-2 text-sm text-muted-foreground">{d}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-10">
        ArtDera does not independently authenticate artworks unless explicitly stated on a listing.
        "Verified" refers to identity, portfolio and studio review — not third-party authentication
        of individual works.
      </p>
    </div>
  );
}
