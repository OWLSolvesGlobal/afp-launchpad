
# Google Sheets–driven product catalog

Goal: edit a Google Sheet → site updates almost instantly. Stock tracked per size + color. Images uploaded through a small admin page in the app.

## Architecture

```text
 Google Sheet ── Apps Script onEdit ──► /functions/sync-products ──► Cloud DB
                                                                        │
 Admin /admin/upload ── upload image ──► Cloud Storage (public bucket) ─┤
                                                                        ▼
                                                            Site reads from DB
```

- **Source of truth**: Google Sheet (catalog) + Cloud Storage (images).
- **Cache**: Cloud DB tables that the site queries (fast, filterable, resilient).
- **Sync**: Apps Script in the sheet hits an edge function on every edit.

## Sheet design — two tabs

### Tab 1: `Products` (one row per product)

| Column | Example | Notes |
|---|---|---|
| `id` | `m-001` | Stable key. Never reuse. |
| `slug` | `apex-compression-tee` | URL slug. |
| `name` | `Apex Compression Tee` | |
| `gender` | `men` | `men` / `women` / `unisex` |
| `category` | `tops` | Free text — new value = new category. |
| `price_usd` | `48.00` | |
| `compare_at_usd` | `58.00` | Optional. |
| `colors` | `Black:#0A0A0A \| Graphite:#4B4B4B` | `name:hex`, pipe-separated. |
| `sizes` | `S \| M \| L \| XL` | Pipe-separated. Order preserved. |
| `image_url` | `https://…/tee.jpg` | Pasted from the admin upload page. |
| `image_alt` | `Men's Apex tee in black` | |
| `badge` | `BESTSELLER` | Optional manual override. Auto-derives `LOW STOCK` / sold out from Tab 2. |
| `published` | `TRUE` | Hide without deleting. |

### Tab 2: `Stock` (one row per variant)

| Column | Example |
|---|---|
| `product_id` | `m-001` |
| `size` | `M` |
| `color` | `Black` |
| `quantity` | `12` |

Why two tabs: keeps Tab 1 narrow and easy to read; Tab 2 is just a long list anyone can edit. A helper script can pre-generate empty rows for every size×color when you add a product.

## Database schema (Lovable Cloud)

`products`
- `id` text pk, `slug` text unique, `name`, `gender`, `category`, `price_cents` int, `compare_at_cents` int null, `colors` jsonb (`[{name, hex}]`), `sizes` text[], `image_url`, `image_alt`, `badge` text null, `published` bool, `updated_at`

`product_stock`
- `id` uuid pk, `product_id` fk, `size` text, `color` text, `quantity` int, unique(`product_id`, `size`, `color`)

`sync_log`
- `id`, `started_at`, `finished_at`, `rows_processed`, `errors` jsonb, `status`

RLS: public `select` on `products` (where `published = true`) and `product_stock`. Writes restricted to service role (used by the edge function) and admin role (for image uploads).

Storage: public bucket `product-images` with admin-only write policy.

## Edge functions

1. **`sync-products`** (POST, called by Apps Script and the manual button)
   - Auth: shared secret header `X-Sync-Token` (stored as runtime secret).
   - Reads both tabs via the Google Sheets connector gateway.
   - Validates rows with Zod; collects errors per row.
   - Upserts `products` by `id`; deletes/marks unpublished any rows missing from the sheet.
   - Replaces `product_stock` for each touched product.
   - Writes a `sync_log` entry; returns summary JSON.

2. **`upload-product-image`** (POST, admin only)
   - Accepts a file, stores it in `product-images/<uuid>.<ext>`, returns the public URL.
   - Used by `/admin/upload`.

## Admin pages (gated by an `admin` role)

- `/admin/upload` — drag-and-drop image upload, returns a URL to paste into the sheet. Shows a thumbnail preview and a copy button.
- `/admin/sync` — "Sync now" button + last sync status from `sync_log` (useful when the webhook fails).
- Auth uses the existing Lovable Cloud auth + a `user_roles` table with an `admin` role (separate table, never on profiles — standard pattern).

## Site refactor

Replace static `src/data/products.ts` with a data layer:
- `src/lib/catalog.ts` — `getProducts()`, `getProductBySlug()`, `getStockFor(productId)`.
- React Query hooks: `useProducts(filters)`, `useProduct(slug)`, `useStock(productId)`.
- Components touched: `Shop`, `ProductDetail`, `FeaturedCarousel`, `ProductCard`, `ShopFilters` (categories now derived from `DISTINCT category`).
- Stock UX on `ProductDetail`: each size button disabled if every color for that size is 0; each color swatch disabled if 0 for the selected size; "Add to bag" disabled when the chosen variant has 0 stock; "Only N left" message under 5.
- Cart: include `size` + `color` (already does) and check stock at add time.

Keep the existing `Product` type shape so component changes are minimal — the hook just returns the same interface, sourced from the DB.

## Sheets webhook setup (one-time, user-facing)

After the function is deployed, the user opens the sheet → Extensions → Apps Script → pastes a small `onEdit(e)` snippet that POSTs to the sync function with the shared `X-Sync-Token`. We'll provide the snippet with the URL + token pre-filled.

To avoid a sync per keystroke, the script debounces: it writes a "dirty" flag to script properties and a time-driven trigger flushes every ~30 seconds. Net effect: edits appear on the site within ~30s, without hammering the API.

## Build order

1. Enable Lovable Cloud, add Google Sheets connector, add `SYNC_SHARED_SECRET` runtime secret.
2. Create DB tables + storage bucket + RLS + `user_roles` + `has_role()` function.
3. Build `upload-product-image` edge function + `/admin/upload` page.
4. Create the Google Sheet (we'll seed it with the current 12 products) and capture its ID.
5. Build `sync-products` edge function; run it once manually to populate the DB.
6. Refactor the site to read from the DB via React Query hooks.
7. Build `/admin/sync` page with status + manual trigger.
8. Provide the Apps Script snippet for the user to paste into the sheet.

## Trade-offs to know upfront

- **Sheet as source of truth** means a typo in the sheet can hide products. The sync log + per-row validation errors mitigate this; bad rows are skipped, not fatal.
- **Webhook ~30s debounce** is a deliberate choice over true real-time to stay within Sheets API limits.
- **Image URLs in the sheet** are pasted manually after upload. That's the simplest reliable workflow; a future improvement is an "Upload" button inside the sheet via Apps Script.
- **Stock is eventually consistent** — between syncs, a product could oversell by one or two if traffic is high. Real-time stock would require reading the DB on every page view (slower) or moving inventory fully into the DB and using the sheet only for product metadata. We can revisit if it becomes a problem.

## What you'll do vs what I'll do

You: create a Google account / sheet (or let me create the sheet via the connector after you connect it), paste the Apps Script snippet once, upload images through `/admin/upload`, edit the sheet to manage the catalog.

Me: everything else — schema, functions, admin pages, site refactor, seeded sheet content.
