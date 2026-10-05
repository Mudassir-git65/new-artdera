// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import "dotenv/config";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type {} from "nitro/vite";

const isVercelBuild = process.env.VERCEL === "1";
const apiProxyTarget = process.env.API_PROXY_TARGET?.trim();

export default defineConfig({
  vite: {
    // Vercel's Node entry exposes the native request/response pair required by
    // the existing Express API. Lovable/Cloudflare builds keep their default
    // web entry and continue to use the development API proxy below.
    nitro: isVercelBuild
      ? {
          serverDir: "./nitro",
          vercel: {
            entryFormat: "node",
            functions: { runtime: "nodejs22.x" },
          },
        }
      : undefined,
    resolve: {
      alias: {
        "punycode/": "punycode",
      },
    },
    server: apiProxyTarget
      ? {
          proxy: {
            "/api": apiProxyTarget,
            "/uploads": apiProxyTarget,
          },
        }
      : undefined,
    // Pre-bundle heavy deps so dev server starts faster and avoids waterfall requests
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@tanstack/react-router",
        "@tanstack/react-query",
        "lucide-react",
        "sonner",
        "clsx",
        "tailwind-merge",
      ],
    },
    build: {
      target: "es2022",
      minify: "esbuild",
      // Produce smaller, parallel-loadable chunks
      cssCodeSplit: true,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
