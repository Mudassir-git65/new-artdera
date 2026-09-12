import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { BuyerDashboard } from "@/marketplace/buyer";
export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: "Buyer Account — ArtDera" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AccountRoute,
});

function AccountRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/account" ? <BuyerDashboard section="profile" /> : <Outlet />;
}
