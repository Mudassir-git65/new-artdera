import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SellerDashboard } from "@/marketplace/dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Seller Dashboard — ArtDera" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LegacyDashboardRoute,
});

function LegacyDashboardRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/dashboard" ? <SellerDashboard section="overview" /> : <Outlet />;
}
