import { writeFile } from "node:fs/promises";
const origin = process.argv[2] ?? "https://www.artdera.com";
const slug = process.argv[3] ?? "artbyayesha19";
const output = process.argv[4];
const runs = [];
async function sample(index) {
  const start = performance.now();
  const response = await fetch(`${origin}/api/stores/${slug}`, {
    headers: { "cache-control": "no-cache" },
  });
  const payload = await response.json();
  const apiMs = performance.now() - start;
  const items = payload.data?.artworks ?? [];
  const pageStart = performance.now();
  const page = await fetch(`${origin}/creator/${slug}`, {
    headers: { "cache-control": "no-cache" },
  });
  const html = await page.text();
  const cardIds = [...html.matchAll(/data-artwork-id="([a-f0-9]{24})"/g)].map((match) => match[1]);
  const legacySlugs = [
    ...new Set([...html.matchAll(/href="\/product\/([^"?#]+)"/g)].map((match) => match[1])),
  ];
  return {
    index,
    apiStatus: response.status,
    pageStatus: page.status,
    apiMs,
    htmlMs: performance.now() - pageStart,
    count: items.length,
    total: payload.data?.total,
    ids: items.map((item) => item.id),
    cardIds,
    legacySlugs,
    duplicateIds: items.length !== new Set(items.map((item) => item.id)).size,
    duplicatesInHtml: cardIds.length !== new Set(cardIds).size,
    incorrect404: /Creator not found|This studio is not on the wall/.test(html),
    bytes: Buffer.byteLength(html),
  };
}
for (let batch = 0; batch < 6; batch++) {
  runs.push(...(await Promise.all(Array.from({ length: 5 }, (_, i) => sample(batch * 5 + i)))));
  console.log(`Completed ${runs.length}/30 logged-out API and HTML loads`);
}
const api = [...runs.map((run) => run.apiMs)].sort((a, b) => a - b);
const html = [...runs.map((run) => run.htmlMs)].sort((a, b) => a - b);
const report = {
  origin,
  slug,
  measuredAt: new Date().toISOString(),
  apiP50Ms: api[15],
  apiP75Ms: api[22],
  htmlP50Ms: html[15],
  htmlP75Ms: html[22],
  counts: [...new Set(runs.map((run) => run.count))],
  visibleCounts: [...new Set(runs.map((run) => run.cardIds.length || run.legacySlugs.length))],
  stableApi: runs.every((run) => JSON.stringify(run.ids) === JSON.stringify(runs[0].ids)),
  runs,
};
if (output) await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, runs: undefined }, null, 2));
