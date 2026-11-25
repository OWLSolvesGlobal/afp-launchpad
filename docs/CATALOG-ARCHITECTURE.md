# Loyverse-driven product catalog

Goal: the owner manages items, sizes, prices and stock in Loyverse, the
point of sale she already uses in the shop, and the site follows within
about 6 minutes. No deploy, no database, no third-party gateway. This
replaced the Google Sheet pipeline (which itself replaced Supabase).

## Architecture

```text
Loyverse API  (items, categories, inventory levels: read-only GETs)
      │  cron, every 5 minutes
      ▼
Sync Worker `scheduled()`  + src/data/site-settings.json (bundled)
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
  route. Every other request falls through to static assets.
- **The site never reads Loyverse live.** API rate limits, latency and
  outages are absorbed by the snapshot.
- **The sync never writes to Loyverse.** It cannot change a price, a stock
  count or an item.
- The snapshot shape is unchanged: `{ generatedAt, products, categories,
  config }`, see `CatalogSnapshot` in `src/lib/catalog-core.ts`. The
  storefront did not need to change.

## How a Loyverse item becomes a product

All of this lives in `src/lib/loyverse-core.ts` and is covered by
`src/lib/loyverse-core.test.ts`.

| Loyverse | Website |
| --- | --- |
| Item | One product page. Each colour is its own Loyverse item, so each colour is its own page for now. |
| Item name | Product name and URL slug |
| Category | Category filter and collection page. No category reads as "More". |
| Variant option (Small, Medium, Large...) | Size (S, M, L...). An item with one unnamed variant is ONE SIZE. |
| Variant price, pricing type FIXED | Price. "Variable" pricing means no price. |
| Inventory level per variant | Stock per size, summed across stores, never below 0 |
| Deleted item or variant | Left out |

Section (Women / Men / Accessories) is derived: an item whose category is
listed in `accessoryCategories` is unisex, an item with "Men's" in its name
is men's, everything else is women's. `site-settings.json` can override it
per item.

## Website-only settings

`src/data/site-settings.json`, keyed by Loyverse item name (case ignored):
`image`, `imageAlt`, `description`, `gender`, `hidden`, `badge`, plus the
site `config` block (announcement bar, featured products, payment switches).
Changing it needs a deploy. A setting whose name matches no Loyverse item is
reported in the sync log, which catches renames.

## Resilience ladder

| Failure | Behaviour |
| --- | --- |
| Token secret not set | Sync logs "skipped" and exits. |
| KV namespace not bound | `/api/catalog` serves the empty built-in fallback (no products); sync no-ops. |
| KV empty (first deploy) | Empty fallback until the first cron run, at most 5 minutes. |
| Loyverse errors or times out | Sync logs the status and exits; **last good snapshot keeps serving**. |
| Loyverse returns no items | Sync refuses to overwrite; last snapshot keeps serving. |
| Loyverse answers but no product comes out sellable | Sync refuses to publish an empty shop; last snapshot keeps serving. |
| `/api/catalog` unreachable (local dev) | Frontend `fetchCatalog()` falls back to the empty built-in catalog. |

The response header `x-afp-catalog-source: kv | seed` tells you which path
you're on. `GET /api/catalog/status` reports how the latest sync went.

The built-in fallback (`src/data/seed-catalog.json`) is deliberately empty.
Loyverse is the only source of products; the old Google Sheet pipeline and
its sample products were removed on 25 Nov 2026.

## Render guards (why a product doesn't show)

A product renders only when it is active **and** its price is above 0
(`isPurchasable` in catalog-core). On top of that, the Loyverse mapping:

- leaves out any size with "Variable" pricing; an item with no fixed price
  at all is hidden;
- shows one price per product: if sizes carry different prices, the most
  common price wins and the other sizes are left out and logged, so the site
  never quotes the wrong amount for a size;
- hides anything marked `hidden` in `site-settings.json`.

Prices are never invented by code. Loyverse is authoritative.

Per-size stock renders sold-out sizes as disabled (never hidden); a fully
sold-out product stays visible with a "Sold out" state.

## Images

`image` in `site-settings.json` is a **filename** in `src/assets`, not a
URL. `productImageUrl()` in `src/lib/catalog.ts` maps filenames to Vite's
hashed bundle URLs; unknown or blank filenames get `/placeholder.svg`.
Adding a product photo = commit the file to `src/assets`, then map it to the
Loyverse item name in `site-settings.json`.

## Orders

Checkout still hands off to WhatsApp with an `AFP-YYYYMMDD-XXX` reference
(`newOrderId()` in catalog-core). Online orders are not yet recorded in
Loyverse; the owner rings them up at the till so stock stays right.
