import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SellerDashboard } from "@/marketplace/dashboard";

export const Route = createFileRoute("/artist/dashboard")({
  head: () => ({
    meta: [{ title: "Artist Dashboard — ArtDera" }, { name: "robots", content: "noindex" }],
  }),
  component: ArtistDashboardRoute,
});

function ArtistDashboardRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/artist/dashboard" ? <SellerDashboard /> : <Outlet />;
}
