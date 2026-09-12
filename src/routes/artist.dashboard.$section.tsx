import { createFileRoute } from "@tanstack/react-router";
import { SellerDashboard } from "@/marketplace/dashboard";

export const Route = createFileRoute("/artist/dashboard/$section")({
  head: () => ({
    meta: [{ title: "Seller Workspace — ArtDera" }, { name: "robots", content: "noindex" }],
  }),
  component: ArtistDashboardSection,
});

function ArtistDashboardSection() {
  const { section } = Route.useParams();
  return <SellerDashboard section={section === "subscription" ? "billing" : section} />;
}
