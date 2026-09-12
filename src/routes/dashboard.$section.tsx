import { createFileRoute } from "@tanstack/react-router";
import { SellerDashboard } from "@/marketplace/dashboard";

export const Route = createFileRoute("/dashboard/$section")({
  head: () => ({
    meta: [
      { title: "Seller Dashboard — ArtDera" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DashboardSectionRoute,
});

function DashboardSectionRoute() {
  const { section } = Route.useParams();
  return <SellerDashboard section={section} />;
}
