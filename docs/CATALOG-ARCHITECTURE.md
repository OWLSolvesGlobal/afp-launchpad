# Google Sheets–driven product catalog

Goal: the owner edits a Google Sheet → the site updates within ~6 minutes,
with no deploy, no database, and no third-party gateway. This replaced the
earlier Supabase-backed pipeline entirely.

## Architecture

```text
Google Sheet (owner edits: Catalog / Orders / Config tabs)
      │  cron, every 5 minutes
      ▼
Sync Worker `scheduled()`  (service-account JWT, read-only Sheets API)
      │  writes one JSON snapshot
      ▼
Cloudflare KV  namespace AFP_CATALOG, key `catalog:v1`
      │
      ▼
GET /api/catalog   (same Worker's `fetch()`, Cache-Control: max-age=60)
      │
      ▼
React storefront   (React Query `useCatalog()`, renders catalog + stock)
```

- **One Worker** (`worker/index.ts`) handles both the cron and the API
  route. Every other request falls through to static assets via
  `env.ASSETS.fetch()`; `assets.run_worker_first: ["/api/*"]` in
  `wrangler.jsonc` keeps the Worker out of the static path entirely.
- **The site never reads the Sheet live.** Sheets API quota, latency, and
  outages are all absorbed by the snapshot.
- The snapshot shape is `{ generatedAt, products, categories, config }` —
  see `CatalogSnapshot` in `src/lib/catalog-core.ts`. That module is the
  single shared definition of parsing, guards, and derivations, imported
  by the Worker, the frontend, and the tests.

## Resilience ladder

| Failure | Behaviour |
| --- | --- |
| Secrets not configured yet | Sync logs "skipped: not configured" and exits. |
| KV namespace not bound | `/api/catalog` serves the bundled seed (`src/data/seed-catalog.json`); sync no-ops. |
| KV empty (first deploy) | `/api/catalog` serves the bundled seed. |
| Sheet fetch/auth fails | Sync logs and exits; **last good snapshot keeps serving**. |
| Sheet emptied (header-only tab) | Sync refuses to overwrite; last snapshot keeps serving. |
| `/api/catalog` unreachable (local dev) | Frontend `fetchCatalog()` falls back to the bundled seed. |

The response header `x-afp-catalog-source: kv | seed` tells you which path
you're on.

## Render guards (why a product doesn't show)

A product renders only when `active = TRUE` **and** `price_bbd > 0`
(`isPurchasable` in catalog-core). The price guard is deliberate belt and
suspenders: seed rows and half-filled Sheet rows carry price 0, so nothing
unpriced can ever go live. Prices are never invented by code — the Sheet
is authoritative.

Per-size stock renders sold-out sizes as disabled (never hidden); a fully
sold-out product stays visible with a "Sold out" state.

## Images

The Sheet's `image` column is a **filename** in `src/assets`, not a URL.
`productImageUrl()` in `src/lib/catalog.ts` maps filenames to Vite's
hashed bundle URLs via `import.meta.glob`; unknown or blank filenames get
`/placeholder.svg`. Adding a product photo = commit the file to
`src/assets`, then reference its filename in the Sheet.

## Categories and navigation

Categories are free text in the Sheet. `deriveCategories()` orders them
women-first (any-women → unisex-only → men-only, stable within groups) and
the header nav plus `/collection/:slug` pages are generated from that
list. There is no hardcoded category list anywhere — keep it that way.

## Orders

The `Orders` tab is a hand-maintained ledger for WhatsApp sales. The site
generates an `AFP-YYYYMMDD-XXX` reference in the checkout WhatsApp message
(`newOrderId()` in catalog-core) so the owner can copy it into the Sheet.
The site does not write to the Sheet; that arrives with payment webhooks
(Fygaro is the leading candidate).

## Activation

See `README.md` → "Catalog sync setup" for the exact commands: create the
`AFP_CATALOG` KV namespace and uncomment its binding in `wrangler.jsonc`,
create a Google service account with Sheets API enabled, share the Sheet
with it, and set the `GOOGLE_SERVICE_ACCOUNT_JSON` + `CATALOG_SHEET_ID`
Worker secrets. Until then the site serves the seed snapshot.

## Sheet template

Tabs and columns are documented for the owner in `SHEET_TEMPLATE.md`, with
importable CSVs (`sheet-catalog-template.csv`, `sheet-orders-template.csv`,
`sheet-config-template.csv`) pre-filled with the 12 launch products at
price 0 / inactive.
