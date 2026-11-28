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

Config lives in `wrangler.jsonc`. The Worker (`worker/index.ts`, deployed
through the one-line `worker/entry.ts`) serves `GET /api/catalog` from KV and
item photos at `/api/image/*`, runs the catalog sync cron, and handles orders
(`/api/orders*`, `/api/checkout-config`) and the owner's portal
(`/api/admin/*`). `worker/entry.ts` must export the handler and nothing else:
the runtime rejects an entry module with other exports. `assets.run_worker_first` is scoped to `/api/*` so every
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

**Checkout is four steps: Details → Pay → Upload proof → Done.** Details
reserves the order on the server (items held 60 minutes). Pay shows the
order reference, the amount and the payment method. Upload proof takes an
image or PDF. Only then is the order submitted. There is no "order first,
pay after" and no ordering by WhatsApp; one small "Need help? WhatsApp us"
link remains, for help only. `/order/:ref` is the customer's status page.

**Payment methods.** The site takes no payment itself; the customer pays
from their own banking app.

- **CIBC 1st Pay QR** (`qr-1stpay-cibc.png`), shown when
  `paymentsTransferEnabled` is `true` in `src/data/site-settings.json`. Only
  CIBC customers can pay it. A bank QR code cannot carry the amount or the
  reference, so the customer types both; they are shown with copy buttons.
  Keep the code large and on plain white so it scans off a screen. (The
  "1st Pay Plus" code for other banks did not work when tested on 25 Nov 2026
  and was removed.)
- **Bank transfer**, shown only when an admin has entered AFP's bank details
  in the portal (settings key `bank_details`). Hidden, never blank, until
  then. The details are sent only to a customer holding a valid order token,
  while that order is waiting for payment.
- **Card** is a stub until Fygaro and stays `false`. The Fygaro integration
  must touch only `src/components/checkout/CardPaymentSection.tsx`.

**Prices include VAT.** Loyverse prices are VAT-inclusive, so the customer
pays the shelf price online exactly as at the till. `taxCents` adds nothing
on top (`PRICES_INCLUDE_VAT` in `src/lib/pricing.ts`). Total = subtotal +
delivery.

**No featured products.** The owner wants every item shown under its
category with equal standing: the home page renders one row per Loyverse
category. Products without a photo show a branded name tile
(`ProductImage.tsx`); never a generated or borrowed image standing in for a
real garment.

**Orders (being built in phases; see `docs/ORDER-TEST-RUNS.md`).** Orders
live in the D1 database `afp-orders` (binding `ORDERS_DB`, schema in
`migrations/`). Statuses: `reserved → proof_uploaded → paid → delivered`,
plus `expired`, `rejected`, `cancelled`. Rules that must hold:

- **The server decides the money.** `POST /api/orders` takes item, size and
  quantity only; prices, delivery and totals come from the Loyverse snapshot
  (`priceOrder` in `src/lib/orders-core.ts`). Never trust a total from the
  browser.
- **Stock shown = Loyverse stock minus active holds.** A hold is a reserved
  order inside its 60-minute window, an order with proof awaiting an admin,
  or a paid order not yet recorded in Loyverse (`HOLDS` in
  `worker/orders.ts`). Reserving checks stock and inserts the lines in one
  transaction, so the last piece cannot be sold twice.
- **An order is read with its reference and its private token** (header
  `x-order-token`). Only a hash of the token is stored. Wrong token and
  unknown reference give the same 404.
- **Proof is evidence, never confirmation.** Only an admin marks an order
  paid, after checking the bank account. After upload the customer is told
  "We're checking your payment", never "Paid".
- **Proofs are private.** They go to the R2 bucket `afp-order-proofs`
  (binding `PROOFS`) under a random name; the original filename is not kept.
  The type (JPEG, PNG, WebP, PDF) is decided from the file's first bytes
  (`sniffProof`), never its name. 8 MB limit, enforced while reading. No
  customer-facing route serves a proof back. The bucket must never get a
  public URL or custom domain.
- **Late uploads cannot revive an order.** The upload's status change
  re-checks the order in the same statement (`worker/order-actions.ts`).
- **The token never goes in a query string.** Links carry it after the `#`
  (`statusPath`); requests carry it in the `x-order-token` header.
- **Screens show the server's figures.** After an order is reserved, totals,
  reference and time left all come from the order, and the countdown uses the
  server's clock.
- Bank details live in the `settings` table, typed in the owner's portal.
  Never in the repo, the logs or the browser bundle.
- If D1 is unreachable the catalog still serves (without holds) and
  ordering returns 503. The shop must not white-screen.

**Order limits are per device, with a higher ceiling per network.** The
browser sends a random id it made up for itself (`x-afp-device`); phone
networks put many customers behind one address, so counting by address alone
would block real customers on a busy day. Per device: 6 orders in 10 minutes,
3 unpaid at once. Per network: 40 and 15 (`ORDER_LIMITS`). Only hashes are
stored. `/api/checkout-config` says whether bank transfer is on (yes/no, never
the details) so checkout can name the payment methods before reserving.

A customer may cancel while the order is reserved, and replace their proof
while it is being checked (three uploads per order in all).

**The owner's portal (`/admin`, `worker/admin.ts`, `src/admin/`).** Built for
one person on her phone, around four questions: does anything need me, did
this money arrive, what do I hand over, how is the shop doing. Rules that
must hold:

- **A hidden page is not a lock.** The `/admin` page is public code. The data
  is protected: `handleAdmin` calls `verifyAccess` (`worker/access.ts`)
  before anything else, on every `/api/admin/*` request. It checks the
  Cloudflare Access token itself: RS256 signature against the team's
  published keys, issuer, audience, expiry, and the email against
  `ADMIN_EMAILS`. Every failure gets the same 403. Missing Access settings or
  unreachable keys also mean 403: it fails closed. Never trust an email
  header or the cookie alone.
- The Access application must cover both `/admin*` and `/api/admin/*`. Its
  team address and audience tag are the plain vars `ACCESS_TEAM_DOMAIN` and
  `ACCESS_AUD` in `wrangler.jsonc`.
- **GETs never change anything.** Changes are POSTs that must be same-origin
  (an `Origin` header is required), JSON, and carry `x-afp-admin: 1`.
- **Status moves are the four in `ADMIN_MOVES` and nothing else**, each one
  conditional UPDATE that re-checks the current status, with its audit line
  written in the same transaction (`WHERE changes() = 1`). Mark paid needs
  `confirmed: true`: the admin's statement that she checked the bank account.
  Reject needs a reason, which the customer sees.
- **The audit log is append-only.** Database triggers refuse UPDATE and
  DELETE on `audit_log`. Do not remove them.
- **Proofs** are streamed only by `GET /api/admin/orders/:ref/proof`, with
  `nosniff`, a `default-src 'none'; sandbox` policy, `no-store`, and a
  download disposition for anything that is not an image.
- **Bank details** are saved whole and returned masked (last four digits).
  Their values never go in the audit log or the logs.
- **"Not yet in Loyverse".** Marking paid does not write to Loyverse yet. The
  owner rings the sale up at the till and presses "I've rung this up in
  Loyverse", which releases the website's hold. Until she does, the stock is
  held here AND still counted in Loyverse, so it is right; if she rings it up
  and does not press the button, the shop shows one too few.
- **Marketing consent** is stored per order (`marketing_opt_in`, unticked by
  default). Only customers who ticked it may ever be exported for a campaign.
- Pickup locations come from Settings (`/api/checkout-config`), with the old
  two as the default. A pickup order must name one of them.
- The portal is a lazy route and must stay out of the storefront bundle.

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
- **`worker/access.ts` and `worker/admin.ts`.** They are the lock on the
  owner's portal and the only code that can mark an order paid.
- **`worker/orders.ts`, `worker/order-actions.ts`, `src/lib/orders-core.ts`
  and `migrations/`.** They decide what a customer is charged, what stock is
  held, and which uploads are accepted.
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

Order tests run against a real SQLite loaded from `migrations/`
(`src/test/orders-db.ts`). Checkout and the status page have component tests
(`src/pages/Checkout.test.tsx`).

**Running the Worker locally.** `npx wrangler dev --local` runs the real
Worker with a local database and bucket (apply migrations with
`npx wrangler d1 migrations apply afp-orders --local`). The portal's API
refuses everything locally unless a test Access key is injected; the unit
tests in `src/lib/admin.test.ts` sign real RS256 tokens instead.

---

## Outstanding work

1. **Orders: what is left.** Customers can reserve, pay and upload proof, and
   the owner's portal manages orders (phases 1 to 3). Still to build: email
   alerts to alofitnesspro@outlook.com and brandonhlouis@outlook.com when a
   proof arrives (phase 4); recording paid orders in Loyverse automatically,
   replacing the "rung up at the till" button (phase 5); per-item show/hide
   and section in the portal (needs a decision on how portal overrides
   combine with `site-settings.json`); a marketing export for customers who
   opted in. Card payments via Fygaro come after.
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
