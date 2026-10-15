import { createFileRoute } from "@tanstack/react-router";
import { fetchExhibitionLanding } from "@/lib/server-loaders";
import { generateMeta } from "@/lib/seo";
import { ExhibitionLandingPage } from "@/components/exhibition/Exhibition";

export const Route = createFileRoute("/exhibition/")({
  loader: () => fetchExhibitionLanding(),
  head: () =>
    generateMeta({
      title: "ArtDera Online Exhibition 2026 — Opening 24 November",
      description:
        "Discover Pakistan's Artists. Collect From Anywhere. ArtDera Online Exhibition 2026 opens 24 November. Get early access and request a private collector preview.",
      canonicalPath: "/exhibition",
    }),
  component: () => <ExhibitionLandingPage initial={Route.useLoaderData()} />,
});
