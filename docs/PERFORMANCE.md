# ArtDera performance implementation and verification

Measured on 11 November 2026. Application changes are in the working tree and have **not been deployed to artdera.com**. Additive database indexes have been applied to the configured database. Responsive derivatives were prepared for 197 existing public images. Of the 207 public upload records inspected, four legacy local files are unavailable in this checkout and six JPEGs contain truncated image data rejected by Sharp. The thumbnail endpoint falls back to original bytes on conversion failure, preserving browser compatibility. Originals and private uploads were not modified.

The targets are not all verified. The results below distinguish production observations, local production builds, and an isolated scale benchmark. No Lighthouse 95–100 or field INP claim is made.

The prepared-image audit confirmed **985 responsive variants covering all five sizes for 197 public images**. The four unavailable legacy local-upload IDs have no artwork-image references in the database audit. The six truncated JPEG originals remain unchanged; their original-file fallbacks are persisted so new server instances skip repeated failed conversions. A first failed conversion reuses the bytes already read rather than downloading the original again. Details are in `.performance/upload-images.json`, `.performance/image-verification.json`, `.performance/image-failures.json`, and `.performance/image-fallbacks.json`.

## Measured HTTP response improvements

Both versions used their real Vercel/Nitro production artifacts, the same local preview harness, and the configured remote MongoDB database. Five GETs were made per route; the table shows the median of the four requests after the first. These include network latency between this computer and MongoDB. They are not production CDN measurements or guaranteed response times.

| Page                     | Before TTFB | After TTFB |
| ------------------------ | ----------: | ---------: |
| Homepage                 |    1,440 ms |     230 ms |
| Discover                 |    1,185 ms |     189 ms |
| Painting category search |    1,391 ms |     180 ms |
| Text search              |    1,071 ms |     163 ms |
| Décora                   |      675 ms |     182 ms |
| Artists directory        |      912 ms |     131 ms |
| Galleries directory      |      324 ms |     145 ms |
| Collections              |      414 ms |     153 ms |
| Exhibition landing       |    1,644 ms |     166 ms |
| Artwork detail           |    1,389 ms |     137 ms |
| Artist profile           |      404 ms |     151 ms |

The artwork measurement follows the links emitted by each version. Earlier homepage links used a legacy slug and incurred a redirect; new links use the existing canonical ID-and-slug URL. Legacy URLs and their redirects remain supported.

All 17 representative route checks returned HTTP 200 without the application error page. The remaining checks covered login, cart, checkout, buyer account, seller dashboard, and administrator routes. Their anonymous HTML-shell timings do not measure an authenticated dashboard; authenticated commerce and account behavior were exercised by the integration suite.

Raw samples: `.performance/http-before.json` and `.performance/http-after-final.json`. The original production artifact is retained locally in `.performance/before-build` for repeatable comparisons.

The initial live request to `https://artdera.com/`, including the existing redirect to `www`, had a 2.52 s TTFB and a 3.41 s total response time. This observation is not compared directly with localhost timings.

## Lighthouse and browser evidence

The following are the **last completed local mobile Lighthouse runs**, before the final round of CSS, caching and upload improvements. Lighthouse 13.6.0 ran against the Node/Nitro production build with its normal mobile simulation. Scores are single lab samples on this Windows machine, not field measurements.

| Mobile lab metric   |   Before | Completed intermediate build |
| ------------------- | -------: | ---------------------------: |
| Performance score   |       30 |                           47 |
| Simulated LCP       |   6.95 s |                       3.26 s |
| Transferred bytes   | 13.65 MB |                      4.64 MB |
| CLS                 |        0 |                            0 |
| Total Blocking Time |   3.68 s |                       3.80 s |

The high blocking time remains a concern; this measurement does not establish an INP improvement. The test machine, remote database latency, advertising scripts, and the existing animated/video hero made the lab runs variable. The completed desktop baseline scored 59. The final mobile and desktop reruns could not be completed because the test browser exited before its debugging port became available. No after-desktop score is reported.

PageSpeed Insights was attempted and returned HTTP 429 with a daily quota limit of zero. A final production Lighthouse/PageSpeed comparison and real-user INP measurement remain necessary after deployment.

Raw reports: `.performance/lighthouse-before-mobile.json`, `.performance/lighthouse-before-desktop.json`, `.performance/lighthouse-after-intermediate-mobile.json`, and `.performance/pagespeed-error.json`. Failed browser runs were excluded from the comparison.

Browser checks confirmed client-side navigation without a new document, canonical artwork links, preserved search query strings, artwork details, and a mobile viewport without horizontal overflow. The earlier automated navigation sample was 358 ms including browser-driver overhead, so sub-200 ms navigation is not claimed. Final in-app browser checks rendered the marketplace and artwork detail page with no captured console errors. Screenshots are retained in `.performance/`.

## Implemented changes

- Added a bounded 24 MB public-data LRU with shared in-flight fills. Every request checks a small MongoDB revision record, including warm server instances. Relevant Mongoose writes change the revision; transactional invalidation commits with its transaction. Ordinary entries expire after 60 seconds, exhibition selection after five seconds. Analytics counters can age for up to 60 seconds. Direct database writes outside these model hooks rely on expiry unless they also update the revision.
- Kept personalized responses outside shared caches. Checkout, reservations, payments, and other financial writes continue to read authoritative data and validate totals. Client route data is reused for ten seconds and invalidates on catalog mutations and focus. This permits a short client freshness window; it is not a real-time push subscription to edits from other users.
- Persisted responsive WebP thumbnails in MongoDB, reused them across cold starts, coalesced fills, and limited concurrent transformations to two. Public image delivery skips session lookups and removes `Vary: Cookie`; private reads retain their authentication boundary. Derivatives are removed with the source upload.
- New public image uploads prepare 320, 480, 640, 960 and 1280 pixel variants from the original in-memory buffer. Existing uploads have a resumable, bounded backfill command. Unsupported/failed transformations can retry on demand without losing the original upload.
- Generated 72 content-addressed static WebP assets from the existing images. For example, the 2,126,334-byte artist PNG becomes a 128,296-byte 1280-pixel WebP, with smaller responsive variants also available. The hero image drops from 154,785 to 62,860 bytes at that size. Existing social-preview image URLs remain intact.
- Added responsive sizing throughout the main homepage, artwork cards, directories, collections and dashboard thumbnails. Offscreen images are lazy; primary listing images and the hero poster are prioritized. Secondary hover images load on intent. The video starts after critical resources and respects reduced-motion and data-saving preferences.
- Vendored the same Manrope weights and DM Serif Display fonts, with their licenses and unicode coverage, and preloaded their Latin files. This removes the external font stylesheet round trip.
- Moved exhibition CSS out of the global stylesheet: the main CSS falls from approximately 208 KB to 159 KB before compression. Split Recharts into an approximately 392 KB lazy chunk: the seller workspace chunk falls from approximately 576 KB to 185 KB. Inventory and order views no longer require the chart library.
- Enabled intent prefetching and client-side navigation in shared menus and marketplace links. Search submission and buy-now navigation reuse the application. Product detail resolves product and artist data in one server call and one warm revision check. Product state resets when switching artwork URLs.
- Removed redundant populated queries where store data was already loaded. Homepage artist hydration selects relevant creators rather than up to 1,000 unrelated biographies. Bootstrap profiles are scoped to its selected public stores. Artist and gallery directories use 36-item cursor pages; additional entries remain reachable by scrolling or Load more.
- Pushed indexed affordable-price predicates before Décora's computed-price stage and avoided sorting the count branch. Collection item lookups now use a map rather than repeated linear scans. Added indexes for discounted prices, popularity and stable directory ordering.
- Configured immutable delivery for content-addressed images and fonts in both Vercel configuration and Nitro route rules. Existing hashed JavaScript assets retain immutable caching. Public upload responses explicitly permit CDN caching; error responses do not.

The caching decisions follow [TanStack's preloading behavior](https://tanstack.com/router/latest/docs/guide/preloading) and [Vercel's cache-control contract](https://vercel.com/docs/caching/cache-control-headers). No paid service, Redis instance, or new storage vendor was introduced.

## Scale and database verification

`npm run perf:scale` created an isolated local replica set with **100,000 artworks and 1,000 artist stores**. It did not insert benchmark records into the configured database.

| Isolated benchmark                                                 |                           Result |
| ------------------------------------------------------------------ | -------------------------------: |
| Documents examined for a 25-item listing without the listing index |                          100,000 |
| Documents examined with the listing index                          |                               25 |
| Query execution without / with index                               |                      498 / 51 ms |
| Cold catalog load                                                  |                           669 ms |
| Median of 20 warm catalog loads                                    |                          5.97 ms |
| 50 concurrent cold catalog readers                                 | 393 ms total; consistent results |
| First creator directory page                                       |              36 entries in 30 ms |
| Cold affordable catalog / substring search                         |                   801 / 1,243 ms |

These are synthetic fixture results on local MongoDB without network latency. The no-index comparison validates index behavior; it does not imply that the production catalog previously lacked its existing listing index. The configured database contained 102 artwork records during the audit and already examined 25 documents for the main listing; measured execution was 7 ms before and 6 ms after the additive index migration.

The scale test does not establish thousands of concurrent production users or CDN capacity. Preserving existing substring-search semantics means cold searches can still scan many records. Large editorial collections are also proportional to their curated membership; they are not covered by the artwork-directory pagination claim.

Raw results: `.performance/scale-benchmark.json`, `.performance/database-before.json`, and `.performance/database-after.json`.

## Validation and operating commands

The full integration/unit suite passed **94 tests in 13 files**. It covers authentication, authorization, manual payment proofs, checkout totals, reservations, orders, subscription handling, catalog consistency, cache invalidation across revisions, committed and rolled-back transactions, image access, derivative preparation/deletion, and cursor pagination. After the final image fallback change, all **15 catalog tests** passed, including the new fallback regression test. TypeScript checks also passed for the final source.

SEO titles, meta tags, canonicals and JSON-LD matched the original build across all 17 checked routes (`.performance/seo-verification.json`). The final Vercel production build passed, and its generated deployment manifest contains the immutable image/font rules. Lint passed with no errors and one existing Fast Refresh warning concerning the exported currency options.

```powershell
npm test
npm run typecheck
$env:VERCEL='1'; npm run build
npm run preview:production
npm run perf:http -- http://127.0.0.1:4174 .performance/http-new.json
npm run perf:scale
npm run images:optimize
npm run fonts:vendor
npm run images:prepare-uploads                 # inventory only
npm run images:prepare-uploads -- --apply      # idempotent public-image backfill
npm run catalog:indexes -- --apply            # additive indexes; already applied here
```

Run production Lighthouse through its standard CLI once browser launching is available, for both mobile and `--preset=desktop`, using the deployed URL. Retain multiple samples and compare medians. Windows-generated server artifacts include Windows native Sharp binaries; deploy source through the existing Vercel/Lovable build pipeline so the production platform installs its correct native binaries.

Application publication, a successful final production Lighthouse comparison, production CDN HIT/TTFB verification, and field INP remain outstanding. The current changes and measurements are substantial improvements, but they do not certify every requested speed target.
