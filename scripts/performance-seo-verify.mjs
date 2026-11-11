import { mkdir, readFile, writeFile } from "node:fs/promises";
const before = process.argv[2] ?? "http://127.0.0.1:4175";
const after = process.argv[3] ?? "http://127.0.0.1:4174";
const inventory = JSON.parse(await readFile(".performance/http-after-final.json", "utf8"));
function metadata(html) {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  return [
    ...head.matchAll(/<title[^>]*>[\s\S]*?<\/title>/gi),
    ...head.matchAll(/<meta\b[^>]*>/gi),
    ...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/gi),
    ...head.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi),
  ]
    .map((match) => match[0])
    .sort();
}
const results = [];
for (const { path } of inventory.runs) {
  const pages = await Promise.all(
    [before, after].map(async (origin) => {
      const response = await fetch(`${origin}${path}`);
      return { status: response.status, metadata: metadata(await response.text()) };
    }),
  );
  results.push({
    path,
    same: JSON.stringify(pages[0]) === JSON.stringify(pages[1]),
    beforeTags: pages[0].metadata.length,
    afterTags: pages[1].metadata.length,
  });
}
await mkdir(".performance", { recursive: true });
await writeFile(".performance/seo-verification.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.same)) process.exitCode = 1;
