# ArtDera production catalog repair

Code is ready on branch `codex/fix-catalog-consistency`, with local verification against the configured production database. **The code has not been deployed.** The user requested that Vercel deployment be skipped because the hosting account is inaccessible. The additive indexes and the verified demo provenance flags described below have been applied to the database. Existing deployed code will not honor the new demo flag until this code is released.

The affected profile is https://www.artdera.com/creator/artbyayesha19. Database `artdera`, store `6a91d1080fb45abeab27ac95`, owner `6a91be9d5325e6ddab9cfe58`. Its current inventory is **25 records: 13 published and approved, 10 pending review, one draft, and one rejected**. All ownership references match. The active Professional subscription has a 200-listing limit and expires 2027-08-28; entitlement is not hiding these works. The report of 21 expected artworks does not identify a particular subset of the 25 records. Every actual record is reconciled in the table below; approvals have not been changed to force a count of 21.

**Root causes and resulting behavior**

1. SSR loaders inspected whether Mongoose was already connected, returned sample data when it was cold, and swallowed failures. They now explicitly await the shared connection, query the database, return a true missing result only when a record is absent, and propagate database failures.
2. Creator rendering replaced the dedicated store query with any matching entries from the global 24-work bootstrap summary. Loading more store data mutated arrays without notifying that page, and bootstrap completion remounted the root outlet. The live browser reproduced an initial empty/generated profile and then three works despite the store API containing 13. Profiles now own a dedicated SSR snapshot, true database count, and guarded pagination state; bootstrap cannot overwrite it.
3. Listing pagination skipped only 80% of a page while returning a full organic page. Promotions were excluded from totals and reinserted across pages. Queries now sort by a stable tuple ending in immutable ID, fetch each ID once, and use scoped cursors. Promotions reorder only selected IDs inside the current page. Legacy page offsets use the full page size.
4. Aggregations did not cast string ownership IDs, and the verified-seller filter overwrote a supplied store filter. Mongoose queries now cast IDs and intersect restrictions. SSR, public APIs, sharing previews, sitemap, curated collections, and merchant feeds share published/approved eligibility and exclude classified demo records.
5. Storefront code treated editorial products as artwork records, fabricated empty-store data, applied a default price ceiling, and had a ternary precedence error in availability filtering. It now uses authoritative typed store/artwork data, starts with unrestricted filters, renders real counts, and deduplicates by ID.
6. Detail and shipping-quote flows depended on the partial global catalog. Links were slug-only and earlier slugs were discarded on edits. Detail and quote loaders now resolve the database record independently. Canonical artwork URLs contain the permanent ID; existing slugs and retained aliases redirect permanently to the current URL. Store aliases are preserved too. Missing/ineligible records return 404; database failures are not converted to 404 or demo content.
7. Dashboard bulk-status responses contain only edited records, but the UI replaced its entire list with that response. An empty store also showed the first four global works. Bulk updates now merge by immutable ID, empty stores stay empty, and the owner inventory endpoint refreshes the artwork manager. Analytics and promotion selection use the current owner's works.
8. Bootstrap used a public cache window for a potentially personalized response. It now uses private/no-store and varies by Cookie. Mutable reads revalidate rather than retain stale responses. Mutation events and window focus invalidate active router loaders. Browser GETs share only in-flight requests and clear both successes and failures, so later requests remain fresh. Page generations reject responses from older filters, routes, or invalidations.
9. Published curated collections were populated only from the latest 24 works. Their members now come from a separate complete database lookup, preserving curator order and filtering visibility independently of the home summary.
10. Native collection inspection identified six actual legacy seed works, two stores, a collection, and an exhibition. Their owner identities, titles, slugs, and image paths exactly matched `server/scripts/seed-data.ts`. A guarded migration added `isDemo: true` to 10 verified records. Public loaders exclude them; future seeds carry provenance. No records were deleted, merged, reset, or republished.

**Visibility and the artist's exact records**

The first profile response contains up to 60 eligible records and the complete database total, so a studio with 21 eligible works shows all 21 without Load more. Larger studios use a stable cursor. The 83-work fixture verifies both pages, tied timestamps, all sort orders, promotions, and insertion between requests.

| Artwork ID | Title | Publication | Moderation | Public visibility / exact hidden reason |
| --- | --- | --- | --- | --- |
| 6aa7e5d48231dc65d13d7385 | The Golden Horse | rejected | rejected | duplicate |
| 6aa7e56e8231dc65d13d7381 | The Golden Horse | published | approved | Visible exactly once |
| 6a9bf2481eb0e60299e24bd0 | Surah Ar Rehman 💚 | pending_review | pending | Awaiting administrator approval |
| 6a9bf2431eb0e60299e24bcc | Surah Ar Rehman 💚 | pending_review | pending | Awaiting administrator approval |
| 6a92c8624e60be557e28355b | Fantasy Wonderland 🦢 | pending_review | pending | Awaiting administrator approval |
| 6a92c74e4e60be557e283547 | Blush in Bloom 🌸 | published | approved | Visible exactly once |
| 6a92c6024e60be557e28353f | Brushstrokes of Nature 🖌 | published | approved | Visible exactly once |
| 6a92c5007da1e5dcb8b183f4 | Starry Nights 🌙🌠 | published | approved | Visible exactly once |
| 6a92c3967da1e5dcb8b183d9 | Petals in Motion 🌺 | pending_review | pending | Awaiting administrator approval |
| 6a92c2547da1e5dcb8b183cb | Surah Fatiha ~ The Opening ✨️ | published | approved | Visible exactly once |
| 6a92c1037da1e5dcb8b183ba | Noor of the Qur’an | published | approved | Visible exactly once |
| 6a92c0227da1e5dcb8b183a4 | Sufi Dreams | published | approved | Visible exactly once |
| 6a92bf627da1e5dcb8b18397 | The Blessed Entrance 💛 | published | approved | Visible exactly once |
| 6a92be2d1ad4c3caf510d464 | 3D Modern Art 🖤 | published | approved | Visible exactly once |
| 6a92bd081ad4c3caf510d456 | Into the Light ~ Sufism | published | approved | Visible exactly once |
| 6a92bc101ad4c3caf510d44c | Dhikr of the Soul 📿 | pending_review | pending | Awaiting administrator approval |
| 6a92bb3145dee436ca3d9c5e | Abstract Ayat al Kursi | published | approved | Visible exactly once |
| 6a92ba6f45dee436ca3d9c57 | 99 Names of Allah 🕋 | draft | not_submitted | Draft; not submitted for publication |
| 6a92b85484364535fa6a717e | Between Earth & Eternity ✨️ | pending_review | pending | Awaiting administrator approval |
| 6a92b72e84364535fa6a7174 | Heart in Madina 💚 | pending_review | pending | Awaiting administrator approval |
| 6a92b64384364535fa6a7168 | Ayat al Kursi in Diwani Style ♥️ | published | approved | Visible exactly once |
| 6a92b4a084364535fa6a7155 | Surah Yaseen ✨️ | pending_review | pending | Awaiting administrator approval |
| 6a92b29a84364535fa6a7148 | Soul in Surrender ~Alif ✨️ | pending_review | pending | Awaiting administrator approval |
| 6a92b28c84364535fa6a7144 | Soul in Surrender ~Alif ✨️ | published | approved | Visible exactly once |
| 6a91d10922d332bec86a8536 | Kiswa-e-Kabaa 🖤 | pending_review | pending | Awaiting administrator approval |

Equal titles do not imply equal records. The rejected Golden Horse has the recorded moderation reason “duplicate”; it remains intact. Other repeated-title records also remain intact.

The wider audit examined 100 artwork records, found no orphan store references or artist-owner mismatches, and counted 74 eligible non-demo works across 21 active public non-demo stores. Details: [database audit](catalog-after.json), [demo identification](catalog-demo-audit.json), [applied provenance classification](catalog-demo-classification.json).

**Database and delivery optimizations**

The additive, idempotent index migration uses `createIndexes`, never `syncIndexes` or index drops:

- `artworks(status, moderationStatus, createdAt DESC, _id DESC)`
- `artworks(storeId, status, moderationStatus, createdAt DESC, _id DESC)`
- `artworks(status, moderationStatus, price, _id)`
- `artworks(slugAliases)` and `stores(slugAliases)`

Automatic index creation is disabled for web cold starts. Known-store queries reuse the resolved store instead of populating it and its owner again; artwork, total, and store-promotion reads run in parallel. Profile metadata reads run alongside the catalog query. General relationship lookups and collection memberships are batched, avoiding one query per artwork.

Public upload URLs support five bounded responsive WebP widths (320, 480, 640, 960, 1280) with immutable browser/CDN caching. Originals remain intact. Above-fold images have high priority; other cards are lazy loaded, and images no longer wait behind a zero-opacity load state. The Golden Horse original was 998,796 bytes; the 640px WebP was 106,812 bytes (89.3% smaller), and 320px was 34,544 bytes. External Cloudinary/Unsplash images use their transformation URLs; unknown external providers retain originals. Canceled thumbnail responses are guarded against late writes.

Existing Google Fonts preconnect/display=swap and route code splitting remain in use. The audited build's entry chunk is about 485 KB (150 KB gzip), and the seller dashboard chunk about 571 KB (155 KB gzip). These remain material costs; this patch does not establish that the real-user LCP target has been reached. Sharp is native: deployment should rebuild from source on the hosting OS rather than upload the Windows-built function artifact to Linux.

**Measured results**

All times are milliseconds. HTTP comparisons use different environments: baseline is the deployed website; after is the local Vercel/Nitro build using the remote production database. Both use 30 logged-out loads in batches of five. The after measurements overlapped the route audit. They are not controlled production before/after benchmarks.

| Probe | Before median / p75 | After median / p75 | Interpretation |
| --- | --- | --- | --- |
| Native store database read, same machine | 125.3 / 137.0 | 121.8 / 126.0 | Includes remote DB network; small variation, not a dramatic speedup |
| MongoDB execution | 1 | 1 | After examines/returns 13/13 records using IXSCAN, no blocking sort |
| Store API, full response | 954.4 / 1276.6 | 431.7 / 499.5 | Different hosting environments |
| Creator HTML, full response | 1365.1 / 1790.9 | 687.5 / 811.4 | Different hosting environments; meaningful work content present in HTML |

The first database timing already used the compound store index; it is not a pre-index baseline. API-first HTTP baseline probes warmed the database and returned 13 work links, while the actual browser hydration still replaced the result with three. Final API/HTML samples all contain 13 identical eligible IDs. Browser refresh checks independently covered 30 hydrated refreshes, with all 13 IDs unique every time, including desktop and mobile viewport sizes.

Final hydrated screenshot: [creator-page proof](catalog-creator-proof.png). Final browser IDs: [hydration check](catalog-final-browser.json).

Evidence: [production baseline](catalog-production-before.json), [local after measurements](catalog-local-after.json), [browser refreshes](catalog-browser-refreshes.json), [all route checks](catalog-route-verification.json).

**Verification and practical limits**

- Full regression suite: 72 tests passed in 10 files. Final catalog suite: 11 tests passed, including cold connection, database failure propagation, owner permissions, 21-work counts, 83-work cursor coverage, duplicate browser requests, mutation invalidation, publication changes, alias/ID lookup, approved visibility, classified seeds, collection membership, and responsive images.
- TypeScript frontend/backend checks passed. Vercel production build passed. Changed-file ESLint: zero errors and zero warnings. Repository-wide lint still has 82 pre-existing errors and two warnings in 17 untouched files; [lint report](catalog-lint.json).
- Logged-out local route sweep: 74 unique eligible artwork detail pages, their 74 legacy-slug 301 redirects, 21 profiles, and two genuine missing-route 404s all passed. There were no repeated card IDs. Browser checks additionally confirmed ID navigation, artwork refresh, marketplace search, hydrated count stability, loaded WebP images, and no JavaScript errors. An existing AdSense warning remains.
- Test-only MongoDB process startup timeout was raised from 10s to 60s after Windows startup flakiness under load; no application timeout or test assertions were weakened.
- No artist credentials were supplied, so the affected account's authenticated dashboard was verified through database reconciliation and isolated authenticated regression fixtures, not by impersonating her live session.
- No access to ArtDera's Vercel project: no deployment, production logs, deployed after measurements, or real-user LCP verification. Only the in-app browser was available. Mobile viewport checks are not physical mobile-device or cross-browser tests, and no slow-network throttling was available. Those acceptance dimensions remain unverified.

**Reproduce and release**

`npm test`, `npm run typecheck`, and `npm run catalog:audit -- artbyayesha19 docs/catalog-after.json` reproduce the regression and audit checks. `npm run catalog:indexes` prints the additive migration; append `-- --apply` to apply it idempotently. The legacy-demo script defaults to verification-only; its applied record IDs are preserved in the JSON report. To undo a provenance classification, unset `isDemo` only on those exact verified IDs after review; do not run the seed/reset scripts against production.

For the local Vercel artifact, set `VERCEL=1`, run `npm run build`, then `npm run preview:production`. It binds to 127.0.0.1:4174. `npm run catalog:verify -- http://127.0.0.1:4174 artbyayesha19 docs/catalog-local-after.json` verifies 30 API/HTML loads. `node scripts/verify-catalog-routes.mjs http://127.0.0.1:4174 docs/catalog-route-verification.json` sweeps all current public links.

An authorized host owner must release this branch using the existing deployment workflow and then rerun the verification scripts against the deployed domain. Check deployment/runtime logs and mobile/desktop field LCP before claiming the production performance targets. No commit history has been rewritten, and no branch has been pushed during this repair.

**Exact changed files**

- [package-lock.json](../package-lock.json)
- [package.json](../package.json)
- [server/app.ts](../server/app.ts)
- [server/db.ts](../server/db.ts)
- [server/lib/http.ts](../server/lib/http.ts)
- [server/lib/serializers.ts](../server/lib/serializers.ts)
- [server/models/index.ts](../server/models/index.ts)
- [server/routes/artworks.ts](../server/routes/artworks.ts)
- [server/routes/bootstrap.ts](../server/routes/bootstrap.ts)
- [server/routes/feeds.ts](../server/routes/feeds.ts)
- [server/routes/og.ts](../server/routes/og.ts)
- [server/routes/stores.ts](../server/routes/stores.ts)
- [server/routes/uploads.ts](../server/routes/uploads.ts)
- [server/scripts/seed-data.ts](../server/scripts/seed-data.ts)
- [src/components/site/ProductCard.tsx](../src/components/site/ProductCard.tsx)
- [src/lib/artdera.ts](../src/lib/artdera.ts)
- [src/lib/creator-db.server.ts](../src/lib/creator-db.server.ts)
- [src/lib/creator-meta.ts](../src/lib/creator-meta.ts)
- [src/lib/server-loaders.ts](../src/lib/server-loaders.ts)
- [src/marketplace/dashboard.tsx](../src/marketplace/dashboard.tsx)
- [src/marketplace/data.ts](../src/marketplace/data.ts)
- [src/marketplace/services.ts](../src/marketplace/services.ts)
- [src/routes/__root.tsx](../src/routes/__root.tsx)
- [src/routes/calligraphy.tsx](../src/routes/calligraphy.tsx)
- [src/routes/collections.tsx](../src/routes/collections.tsx)
- [src/routes/creator.$slug.tsx](../src/routes/creator.$slug.tsx)
- [src/routes/creators.tsx](../src/routes/creators.tsx)
- [src/routes/discover.tsx](../src/routes/discover.tsx)
- [src/routes/galleries.tsx](../src/routes/galleries.tsx)
- [src/routes/index.tsx](../src/routes/index.tsx)
- [src/routes/paintings.tsx](../src/routes/paintings.tsx)
- [src/routes/photography.tsx](../src/routes/photography.tsx)
- [src/routes/prints.tsx](../src/routes/prints.tsx)
- [src/routes/product.$slug.tsx](../src/routes/product.$slug.tsx)
- [src/routes/request-quote.tsx](../src/routes/request-quote.tsx)
- [src/routes/sitemap[.]xml.ts](../src/routes/sitemap[.]xml.ts)
- [src/routes/store.$slug.tsx](../src/routes/store.$slug.tsx)
- [src/routes/wall-art.tsx](../src/routes/wall-art.tsx)
- [tests/creator-social-preview.test.ts](../tests/creator-social-preview.test.ts)
- [tests/product-social-preview.test.ts](../tests/product-social-preview.test.ts)
- [tests/production-ui.test.ts](../tests/production-ui.test.ts)
- [tests/setup.ts](../tests/setup.ts)
- [vitest.config.ts](../vitest.config.ts)
- [docs/CATALOG-REPAIR.md](../docs/CATALOG-REPAIR.md)
- [docs/catalog-after.json](../docs/catalog-after.json)
- [docs/catalog-before.json](../docs/catalog-before.json)
- [docs/catalog-browser-refreshes.json](../docs/catalog-browser-refreshes.json)
- [docs/catalog-creator-proof.png](../docs/catalog-creator-proof.png)
- [docs/catalog-demo-audit.json](../docs/catalog-demo-audit.json)
- [docs/catalog-demo-classification.json](../docs/catalog-demo-classification.json)
- [docs/catalog-final-browser.json](../docs/catalog-final-browser.json)
- [docs/catalog-lint.json](../docs/catalog-lint.json)
- [docs/catalog-local-after.json](../docs/catalog-local-after.json)
- [docs/catalog-production-before.json](../docs/catalog-production-before.json)
- [docs/catalog-route-verification.json](../docs/catalog-route-verification.json)
- [docs/catalog-test-results.json](../docs/catalog-test-results.json)
- [scripts/audit-catalog.ts](../scripts/audit-catalog.ts)
- [scripts/catalog-indexes.ts](../scripts/catalog-indexes.ts)
- [scripts/classify-legacy-demo.ts](../scripts/classify-legacy-demo.ts)
- [scripts/preview-production.mjs](../scripts/preview-production.mjs)
- [scripts/verify-catalog-routes.mjs](../scripts/verify-catalog-routes.mjs)
- [scripts/verify-public-catalog.mjs](../scripts/verify-public-catalog.mjs)
- [server/services/catalog.ts](../server/services/catalog.ts)
- [src/lib/artwork-image.ts](../src/lib/artwork-image.ts)
- [src/lib/catalog-product.ts](../src/lib/catalog-product.ts)
- [src/lib/catalog.server.ts](../src/lib/catalog.server.ts)
- [tests/catalog-consistency.test.ts](../tests/catalog-consistency.test.ts)
