import { createFileRoute } from "@tanstack/react-router";
import { Building2, Gift, Hotel, Landmark } from "lucide-react";

export const Route = createFileRoute("/trade")({
  head: () => ({
    meta: [
      { title: "Art for Spaces That Matter - ArtDera" },
      {
        name: "description",
        content:
          "ArtDera business services for interior designers, hotels, restaurants, offices and corporate gifting teams.",
      },
    ],
  }),
  component: TradePage,
});

function TradePage() {
  return (
    <div>
      <section className="bg-[var(--indigo)] text-[var(--ivory)]">
        <div className="container-editorial py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="eyebrow text-white/55">Interior designers and businesses</div>
            <h1 className="mt-3 font-display text-5xl md:text-6xl">Art for Spaces That Matter</h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/72">
              Curated sourcing for residences, hospitality, offices, restaurants, developers and
              thoughtful corporate gifting.
            </p>
          </div>
        </div>
      </section>
      <section className="container-editorial py-16">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Interior designers", "Room-aware sourcing by scale, colour and budget.", Building2],
            ["Hotels and restaurants", "Collections that support the mood of a place.", Hotel],
            ["Developers and offices", "Art programs for shared spaces and suites.", Landmark],
            ["Corporate gifting", "Editioned works and meaningful gift selections.", Gift],
          ].map(([title, text, Icon]) => (
            <div
              key={title as string}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5"
            >
              <Icon className="h-6 w-6 text-[var(--indigo)]" />
              <h2 className="mt-8 font-display text-2xl">{title as string}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text as string}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 md:p-8">
          <h2 className="font-display text-3xl">Start a sourcing conversation</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Tell ArtDera about the space, timeline, budget and number of works required. A dedicated
            trade workflow can be connected here when backend support is ready.
          </p>
          <a href="/messages" className="btn-primary mt-6">
            Message ArtDera
          </a>
        </div>
      </section>
    </div>
  );
}
