import { writeFile } from "node:fs/promises";

const origin = process.argv[2] ?? "http://127.0.0.1:4174";
const destination = process.argv[3];
const headers = { "cache-control": "no-cache" };
const get = (path) => fetch(`${origin}${path}`, { headers, redirect: "manual" });
const artworks = [];
let cursor;
do {
  const response = await get(
    `/api/artworks?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
  if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
  const { data } = await response.json();
  artworks.push(...data.items);
  cursor = data.nextCursor;
} while (cursor);
const bootstrap = await (await get("/api/bootstrap")).json();
const jobs = [
  ...artworks.map((item) => ({
    type: "product",
    id: item.id,
    slug: item.slug,
    path: `/product/${item.id}-${item.slug}`,
  })),
  ...bootstrap.data.stores.map((store) => ({
    type: "profile",
    id: store.id,
    expectedCount: Math.min(60, artworks.filter((item) => item.storeId === store.id).length),
    path: `/${store.ownerType === "gallery" || store.type === "Gallery" ? "store" : "creator"}/${store.slug}`,
  })),
  { type: "missing", path: "/product/no-such-artwork" },
  { type: "missing", path: "/creator/no-such-creator" },
];
const results = [];
for (let i = 0; i < jobs.length; i += 5) {
  results.push(
    ...(await Promise.all(
      jobs.slice(i, i + 5).map(async (job) => {
        const start = performance.now();
        const response = await get(job.path);
        const html = await response.text();
        const legacy = job.type === "product" ? await get(`/product/${job.slug}`) : null;
        const ids = [...html.matchAll(/data-artwork-id="([a-f0-9]{24})"/g)].map(
          (match) => match[1],
        );
        return {
          ...job,
          status: response.status,
          ms: performance.now() - start,
          legacyStatus: legacy?.status,
          legacyLocation: legacy?.headers.get("location"),
          count: ids.length,
          duplicates: new Set(ids).size !== ids.length,
          valid:
            (job.type !== "profile" || ids.length === job.expectedCount) &&
            response.status === (job.type === "missing" ? 404 : 200) &&
            (!legacy ||
              (legacy.status === 301 && legacy.headers.get("location")?.endsWith(job.path))),
        };
      }),
    )),
  );
  console.log(`Verified ${results.length}/${jobs.length} routes`);
}
const report = {
  origin,
  checkedAt: new Date().toISOString(),
  published: artworks.length,
  uniquePublished: new Set(artworks.map((item) => item.id)).size,
  profiles: jobs.filter((job) => job.type === "profile").length,
  passed: results.every((row) => row.valid && !row.duplicates),
  results,
};
if (destination) await writeFile(destination, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    { ...report, results: report.results.filter((row) => !row.valid || row.duplicates) },
    null,
    2,
  ),
);
process.exitCode = report.passed && report.published === report.uniquePublished ? 0 : 1;
