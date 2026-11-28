# AFP Storefront — working notes

Context for anyone (human or agent) making changes to this repo.

## What this is

E-commerce storefront for Alo Fitness Pro, a Barbados-based activewear brand.
React 18 + Vite + TypeScript + Tailwind + shadcn/ui. Hosted on Cloudflare
Workers. The product catalog lives in Loyverse (the shop's point of sale),
mirrored into Cloudflare KV by a Worker cron.

```bash
npm run dev      # localhost:8080
npm run build    # -> dist/
npm test         # vitest
npm run deploy   # build + wrangler deploy (usually unnecessary, see below)
```

---

## Deployment: main IS production

Pushing to `main` rebuilds and deploys to the live site within ~2 minutes.
There is no staging environment. Treat every push to `main` as a release.

For anything non-trivial, work on a branch and open a PR rather than pushing
straight to `main`.

Config lives in `wrangler.jsonc`. The Worker script (`worker/index.ts`) exists
for three jobs: serving `GET /api/catalog` from KV, serving item photos at
`/api/image/*`, and running the catalog sync cron. `assets.run_worker_first` is scoped to `/api/*` so every
other request is still served straight from edge cache without invoking the
Worker. Widening that scope changes the billing and performance
characteristics of the whole site — don't.

---

## Catalog architecture

**Loyverse (the shop's point of sale) is the single source of truth for
items, sizes, prices and stock.** The owner manages them there and nowhere
else. Website-only details that Loyverse cannot hold (photo, description,
Men/Women section, show/hide, site config) live in
`src/data/site-settings.json`, keyed by Loyverse item name. Full detail in
`docs/CATALOG-ARCHITECTURE.md`.

```text
Loyverse API ──(cron every 5 min, Worker scheduled())──► KV AFP_CATALOG "catalog:v1"
   + site-settings.json (bundled)                              │
GET /api/catalog (max-age=60) ◄── Worker fetch() ──────────────┘ (seed JSON if empty)
        │
        ▼
React storefront (useCatalog / useProducts / useProduct)
```

- Loyverse mapping: `src/lib/loyverse-core.ts` (pure, tested). Shared types
  and render guards: `src/lib/catalog-core.ts`.
- **Nothing else feeds the catalog.** The Google Sheet pipeline and its
  sample products were removed on 25 Nov 2026. The bundled fallback
  (`src/data/seed-catalog.json`) is deliberately empty: if KV has no
  snapshot the shop shows no products, never stale ones. Do not put
  products in it.
- **The sync is read-only.** It sends GET requests to Loyverse and nothing
  else. Writing sales back to Loyverse is future work and needs human review.
- One Loyverse item = one product page. Each colour is its own item in
  Loyverse, so each colour is its own page for now.
- KV namespace binding `AFP_CATALOG`, key `catalog:v1`. Snapshot shape:
  `{ generatedAt, products, categories, config }` (unchanged).
- Sync cron: every 5 minutes. Site cache: 60s. A Loyverse edit is live in ~6
  minutes, no deploy. A `site-settings.json` edit needs a deploy.
- If Loyverse is unreachable, returns no items, or the token is missing, the
  sync exits and the last good snapshot keeps serving. The site must never
  white-screen because of catalog problems.

**Render guards — do not weaken them.** A product renders only when it is
active *and* has a price above 0 (`isPurchasable`). **Prices must never be
invented — Loyverse is authoritative.** A size with "Variable" pricing in
Loyverse has no price and is left out; an item with no fixed price stays
hidden. One product shows one price: sizes priced differently from the rest
are left out and logged rather than shown at the wrong amount.

**Do not hardcode product data or category lists into components.** Categories
are the Loyverse categories; navigation and collection pages derive from the
distinct values present, women-first (`deriveCategories`).

**Currency is BBD only**, integer cents internally, displayed as
`BDS $189.00` via `formatBbd`. No USD anywhere.

**Payment paths are Config-gated.** Checkout always offers WhatsApp. The
bank QR code section (`BankTransferSection.tsx`) renders when
`paymentsTransferEnabled` is `true` in `src/data/site-settings.json`; it was
switched on 25 Nov 2026. The card section is a stub until Fygaro and stays
`false`. The Fygaro integration must touch only
`src/components/checkout/CardPaymentSection.tsx`.

**How QR payment works.** AFP is paid into its CIBC account by 1st Pay.
One code is shown, `qr-1stpay-cibc.png`, which only CIBC customers can pay.
(The "1st Pay Plus" code for other banks did not work when tested on 25 Nov
2026 and was removed.) The site takes no payment itself: the customer pays
from their CIBC app, typing the amount and the `AFP-YYYYMMDD-XXX` reference
(a bank QR code cannot carry either), then sends the order on WhatsApp. The
owner confirms each payment against the bank record. Customers of any other
bank order on WhatsApp and arrange payment with the owner directly; their
items are held for 24 hours, a hold the owner keeps by hand. There is no
server-side order record or automatic stock hold yet; that is the next piece
of work. Keep the code large and on plain white so it scans off a screen.

**Prices include VAT.** Loyverse prices are VAT-inclusive, so the customer
pays the shelf price online exactly as at the till. `taxCents` adds nothing
on top (`PRICES_INCLUDE_VAT` in `src/lib/pricing.ts`). Total = subtotal +
delivery.

**No featured products.** The owner wants every item shown under its
category with equal standing: the home page renders one row per Loyverse
category. Products without a photo show a branded name tile
(`ProductImage.tsx`); never a generated or borrowed image standing in for a
real garment.

Order lifecycle vocabulary is `pending → paid → delivered → cancelled`
(`OrderStatus` in catalog-core).

**Product photos live in Loyverse.** The owner adds or changes an item's
photo in Loyverse and the site follows on the next sync. The sync records
each item's photo address in KV (`catalog:images`, private) and the Worker
serves it from this site at `/api/image/<item id>?v=<fingerprint>`; the
browser never talks to Loyverse. A Loyverse photo wins over a repo file.
Repo files in `src/assets`, mapped by filename in `site-settings.json`, are
the fallback, and an item with neither shows a name tile. Loyverse holds one
photo per item. `GET /api/catalog/status` reports `photos` (how many items
have one).

Sync setup (KV namespace + the `AFPWebsite` Loyverse token, held in the
account's Secrets Store and bound in `wrangler.jsonc`) is documented in
`README.md` → "Catalog sync setup". `GET /api/catalog/status` reports how
the latest sync went.

---

## Gotchas that have already caused outages

These are not style preferences. Each one broke something.

**Never add a `/*` splat rule to `_redirects`.** On Cloudflare Workers,
redirect rules are applied *even when a real file matches the request*. A
`/* /index.html 200` rule will intercept your JS and CSS and serve HTML,
producing a blank white page. SPA routing is handled by
`assets.not_found_handling: "single-page-application"` in `wrangler.jsonc`.
There is no `_redirects` file in this repo and there should not be one.

**The noindex rule in `public/_headers` is hostname-scoped.** Its first
segment must match the `name` field in `wrangler.jsonc` exactly. If they drift
apart the rule silently stops matching and the temporary workers.dev URL gets
indexed by Google. A header line in `_headers` is also meaningless without its
URL pattern line directly above it — commenting out one but not the other
attaches the header to the previous block, which is `/*`, i.e. the whole site.

**Images must be real files.** The repo previously contained `*.asset.json`
pointer stubs left behind by Loveable, referencing `/__l5e/assets-v1/...` —
a path only Loveable's hosting served. Every image using them broke on
migration. If you ever see a `.asset.json` file appear, it is a bug.

**Never route catalog access through a third-party gateway.** The sync
Worker talks to the Loyverse API directly with an access token held as a
Worker secret (`worker/index.ts`). This pattern replaced a dependency on Loveable's
connector gateway, which would have died with the subscription.

**Keep the routes lazy.** Everything except the landing page is code-split in
`App.tsx`. The 3D-heavy 404 page pulls in ~907 KB of three.js — it does not
belong in the storefront bundle. Converting a `lazy()` import back to a
static one silently triples the initial payload.

**Logo files stay PNG.** They need transparency. Photos should not be PNG —
photographic PNGs ship at 3–10× the size of their WebP equivalents.

---

## Secrets

`VITE_`-prefixed variables are compiled into the browser bundle and are public
by design. The storefront currently needs **no** environment variables at all.

Anything actually secret (the Loyverse access token, future payment API
secrets) lives in **Cloudflare Worker secrets** (`npx wrangler secret put …`).
Never in `.env`, never in client code, never `VITE_`-prefixed.

---

## Brand direction

The brand is **women-forward, editorial, minimal, image-led** — lots of white
space. The reference point is bodywerkz.com. The product mix is rompers,
seamless sets, golf and tennis dresses, and bodysuits, with a smaller "For
Him" section.

An earlier version of this site used a dark, masculine gym aesthetic. That was
a mismatch with both the product mix and the audience, and was deliberately
removed. Do not reintroduce it.

Marketing direction is **lifestyle over product** — sell the life, not the
garment.

**The logo must never be redesigned, recreated, or approximated.** Use the
existing files. If the bottom "ALO FITNESS PRO" text is ever adjusted, it must
stay proportional and must not extend beyond the inner weight-plate boundaries
of the barbell graphic.

### Unresolved — flag, don't unilaterally change

There are currently two competing brand voices in the codebase:

- `index.html` says *"For the life you live"* with editorial copy — this is
  what Google and social crawlers see.
- `src/pages/Index.tsx` overrides `document.title` at runtime with
  *"Fitness Fashion for the Unstoppable YOU"*, and the hero repeats it.

Similarly, the CSS design tokens are a restrained palette derived from actual
product (ink, bone, chalk, blush, lilac, sand), but `src/lib/afp-catalog.tsx`
hardcodes `TURQUOISE = "#00b5e2"` outside that system and the hero uses it.

Both need an owner decision. Raise it; don't pick one silently.

---

## Requires human review

Do not merge changes to these without a person reading them line by line:

- **Anything touching payments or money.** Amounts must be signed server-side
  so a customer cannot tamper with them. Webhooks — not browser redirects —
  are the source of truth for whether an order was paid, because customers
  close tabs.
- **`wrangler.jsonc` and `public/_headers`.** See gotchas above.
- **The render guards in `src/lib/catalog-core.ts` and the Loyverse mapping
  in `src/lib/loyverse-core.ts`.** They are what keeps unpriced or hidden
  products off the live site.

Never confirm a payment from a customer-supplied artifact such as a
screenshot. Screenshots are trivially forged. Reconcile against your own bank
record or a signed webhook, never against the buyer's evidence.

---

## Testing

`npm run verify` = build + tests, and must pass with **zero** environment
variables set. Suites cover cart totals, order pricing (VAT/shipping/credit
rules), the Loyverse mapping (sizes, prices, stock, sections, settings), the
sync Worker (paging, read-only, token handling, refusal to publish an empty
shop), the render guards (inactive and price-0 exclusion), the empty
fallback (KV empty, endpoint unavailable), and the order-reference format.
If you change semantics in `catalog-core.ts` or `loyverse-core.ts`, expect
tests to fail, and update them deliberately.

---

## Outstanding work

1. **Orders and holds.** Checkout shows the bank QR codes but nothing is
   recorded server-side: the order exists only as the customer's WhatsApp
   message, and stock is not held. Next: save orders, hold stock for 24
   hours, email the owner (alofitnesspro@outlook.com, with
   brandonhlouis@outlook.com as the test address), an orders page to mark
   paid / delivered / cancelled, and record paid orders in Loyverse so stock
   drops. Card payments via Fygaro (First Atlantic Commerce) come after.
2. **Product photos.** Items without a photo in Loyverse show a name tile.
   The owner adds photos in Loyverse.
3. **Placeholder prices.** 15 items carry estimated prices entered in
   Loyverse on 24 Nov 2026 and are `hidden` in `site-settings.json` until the
   owner confirms them.
4. **A product photo for A-SOC-001 (crew socks)** — no dedicated shot exists;
   the socks only appear incidentally in other photos.
5. **Brand voice split** — see above.
6. **Colour grouping.** One page per product with a colour picker, instead
   of one page per Loyverse item.
