import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/marketplace/admin";
export const Route = createFileRoute("/admin/$section")({
  head: () => ({
    meta: [{ title: "ArtDera Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminSection,
});
function AdminSection() {
  const { section } = Route.useParams();
  return <AdminDashboard section={section} />;
}
