// Vite's React transform reads NODE_ENV while it creates both the client and
// React-server bundles. A development value during `vite build` emits jsxDEV,
// which is intentionally unavailable from React's production server runtime.
// Pin the build process to production even if a hosting dashboard inherited a
// local NODE_ENV value.
process.env.NODE_ENV = "production";

const { createBuilder } = await import("vite");

// Vite's legacy `build()` API compiles only the first environment. TanStack
// Start needs the application builder so client, SSR, and Nitro/Vercel output
// are all rebuilt together; otherwise a stale function can survive while only
// browser assets are refreshed.
const builder = await createBuilder({ mode: "production" }, null);
await builder.buildApp();
await builder.runDevTools();
