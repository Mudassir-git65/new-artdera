import { mkdir, writeFile } from "node:fs/promises";
const origin = process.argv[2] ?? "http://127.0.0.1:4174";
const output = process.argv[3] ?? ".performance/http.json";
const paths = [
  "/",
  "/discover",
  "/discover?category=painting",
  "/discover?q=art",
  "/decora",
  "/creators",
  "/galleries",
  "/collections",
  "/exhibition",
  "/auth/login",
  "/cart",
  "/checkout",
  "/account",
  "/artist/dashboard",
  "/admin",
];
const home = await (await fetch(origin)).text();
const product = home.match(/href="(\/product\/[^"?#]+)"/)?.[1];
const creator = home.match(/href="(\/creator\/[^"?#]+)"/)?.[1];
if (product) paths.push(product);
if (creator) paths.push(creator);
const runs = [];
for (const path of paths) {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const response = await fetch(`${origin}${path}`);
    const ttfbMs = performance.now() - start;
    const html = await response.text();
    samples.push({
      status: response.status,
      ttfbMs: Math.round(ttfbMs),
      totalMs: Math.round(performance.now() - start),
      bytes: Buffer.byteLength(html),
      errorPage: /This page didn't load|This page didn&#x27;t load|Production preview failed/.test(
        html,
      ),
    });
  }
  const warm = samples
    .slice(1)
    .map((s) => s.ttfbMs)
    .sort((a, b) => a - b);
  runs.push({
    path,
    samples,
    warmMedianTtfbMs: (warm[1] + warm[2]) / 2,
  });
  console.log(JSON.stringify(runs.at(-1)));
}
const report = { origin, measuredAt: new Date().toISOString(), runs };
await mkdir(".performance", { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2));
