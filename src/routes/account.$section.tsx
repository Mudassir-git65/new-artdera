import { createFileRoute } from "@tanstack/react-router";
import { BuyerDashboard } from "@/marketplace/buyer";
export const Route = createFileRoute("/account/$section")({
  head: () => ({
    meta: [{ title: "Buyer Account — ArtDera" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AccountSection,
});
function AccountSection() {
  const { section } = Route.useParams();
  return <BuyerDashboard section={section} />;
}
