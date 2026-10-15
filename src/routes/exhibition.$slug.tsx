import { createFileRoute, notFound } from "@tanstack/react-router";
import { fetchExhibitionBySlug } from "@/lib/server-loaders";
import { generateMeta } from "@/lib/seo";
import { ExhibitionDetailPage } from "@/components/exhibition/Exhibition";

export const Route = createFileRoute("/exhibition/$slug")({
  loader: async ({ params }) => {
    const data = await fetchExhibitionBySlug({ data: params.slug });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) =>
    generateMeta({
      title: loaderData?.exhibition.name ?? "Online Exhibition",
      description:
        loaderData?.exhibition.description ||
        "A curated online exhibition at ArtDera. Discover the artists, experience the collection and request a private preview.",
      canonicalPath: `/exhibition/${params.slug}`,
      ogImage: loaderData?.exhibition.coverImageUrl || loaderData?.artworks[0]?.images[0]?.url,
    }),
  component: () => <ExhibitionDetailPage initial={Route.useLoaderData()} />,
  notFoundComponent: () => (
    <div className="container-editorial py-24 text-center">
      <div className="eyebrow">Online exhibitions</div>
      <h1 className="mt-4 font-display text-4xl">This exhibition is not on view.</h1>
      <a href="/exhibition" className="btn-primary mt-8">
        Browse exhibitions
      </a>
    </div>
  ),
});
