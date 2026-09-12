import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminDashboard } from "@/marketplace/admin";
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "ArtDera Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/admin" ? <AdminDashboard section="overview" /> : <Outlet />;
}
