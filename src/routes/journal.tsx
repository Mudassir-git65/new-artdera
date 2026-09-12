import { createFileRoute } from "@tanstack/react-router";
import { IMAGES } from "@/lib/artdera";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal — ArtDera" },
      {
        name: "description",
        content: "Creator stories, styling guides and quiet ideas from the ArtDera journal.",
      },
      { property: "og:title", content: "Journal — ArtDera" },
      { property: "og:url", content: "/journal" },
    ],
    links: [{ rel: "canonical", href: "/journal" }],
  }),
  component: Journal,
});

const POSTS = [
  {
    title: "Choosing your first original",
    excerpt: "A short field guide for new collectors — scale, budget and how to trust your eye.",
    tag: "Collecting",
    img: IMAGES.art1,
  },
  {
    title: "Framing calligraphy well",
    excerpt: "Materials, mounts and the small choices that let a work breathe.",
    tag: "Craft",
    img: IMAGES.art2,
  },
  {
    title: "Living with photography",
    excerpt: "Where fine-art prints belong, and how to hang them.",
    tag: "Interiors",
    img: IMAGES.art3,
  },
  {
    title: "Responsible AI in art",
    excerpt: "How we think about labels, disclosures and the creative contract with buyers.",
    tag: "Policy",
    img: IMAGES.art4,
  },
  {
    title: "The studio of Amina Qureshi",
    excerpt: "A morning in Lahore with the painter behind Quiet Horizon.",
    tag: "Studio Visit",
    img: IMAGES.creator1,
  },
  {
    title: "Notes from the Karakoram",
    excerpt: "Zara Baig on shooting first light, medium format and patience.",
    tag: "Studio Visit",
    img: IMAGES.creator3,
  },
];

function Journal() {
  return (
    <div className="container-editorial py-14">
      <div className="max-w-2xl">
        <div className="eyebrow">Journal</div>
        <h1 className="mt-3 font-display text-5xl">Stories, guides, quiet ideas.</h1>
      </div>
      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-10">
        {POSTS.map((p) => (
          <article key={p.title} className="group block">
            <div className="aspect-[4/3] overflow-hidden rounded-lg">
              <img
                src={p.img}
                alt=""
                className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                loading="lazy"
              />
            </div>
            <div className="mt-4">
              <div className="eyebrow">{p.tag}</div>
              <div className="mt-2 font-display text-2xl">{p.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{p.excerpt}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
