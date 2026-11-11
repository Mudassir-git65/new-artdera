import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Hover/touch intent preloads one likely destination rather than every
    // card in a large mobile catalog. Reuse it briefly, then revalidate.
    defaultPreload: "intent",
    defaultPreloadDelay: 80,
    defaultPreloadStaleTime: 10_000,
    defaultStaleTime: 10_000,
    defaultGcTime: 5 * 60_000,
  });

  return router;
};
