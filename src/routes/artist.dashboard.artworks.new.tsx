import { createFileRoute } from "@tanstack/react-router";
import { SellerDashboard } from "@/marketplace/dashboard";

export const Route = createFileRoute("/artist/dashboard/artworks/new")({
  head: () => ({
    meta: [{ title: "Add Artwork — ArtDera" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <SellerDashboard section="add-artwork" />,
});
