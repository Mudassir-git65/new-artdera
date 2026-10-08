import "dotenv/config";
import express from "express";
import path from "node:path";

// Exercise the same Node/Nitro artifact that Vercel runs, including /api routes.
// vite preview expects dist/server/server.js, which this Vercel build does not emit.
process.env.NODE_ENV = "production";
process.env.APP_URL = "https://www.artdera.com";
const { default: handler } = await import("../.vercel/output/functions/__server.func/index.mjs");
const app = express();
app.use(express.static(path.resolve(".vercel/output/static")));
app.use((req, res) => {
  // Local test transport stands in for Vercel's TLS-terminating proxy.
  // The Vercel adapter annotates each invocation socket once. Close dynamic
  // connections to model its invocation boundary in this local HTTP harness.
  res.setHeader("Connection", "close");
  req.headers["x-forwarded-proto"] = "https";
  req.headers["x-forwarded-for"] = "127.0.0.1";
  Promise.resolve(handler(req, res)).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.status(500).end("Production preview failed");
  });
});
app.listen(Number(process.env.PREVIEW_PORT ?? 4174), "127.0.0.1", () => {
  console.log("Production artifact preview: http://127.0.0.1:4174");
});
