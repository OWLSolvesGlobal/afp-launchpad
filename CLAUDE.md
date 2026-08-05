# AFP Storefront — working notes

Context for anyone (human or agent) making changes to this repo.

## What this is

E-commerce storefront for Alo Fitness Pro, a Barbados-based activewear brand.
React 18 + Vite + TypeScript + Tailwind + shadcn/ui. Hosted on Cloudflare
Workers. The product catalog lives in a Google Sheet, mirrored into
Cloudflare KV by a Worker cron.

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
for exactly two jobs: serving `GET /api/catalog` from KV and running the
catalog sync cron. `assets.run_worker_first` is scoped to `/api/*` so every
other request is still served straight from edge cache without invoking the
Worker. Widening that scope changes the billing and performance
characteristics of the whole site — don't.

---

## Catalog architecture

**The Google Sheet is the single source of truth for products, stock, and
site config.** Nothing else is. Full detail in `docs/CATALOG-ARCHITECTURE.md`;
owner-facing instructions in `docs/RUNBOOK.md`; the Sheet schema in
`docs/SHEET_TEMPLATE.md`.

```text
Google Sheet ──(cron every 5 min, Worker scheduled())──► KV AFP_CATALOG "catalog:v1"
                                                               │
GET /api/catalog (max-age=60) ◄── Worker fetch() ──────────────┘ (seed JSON if empty)
        │
        ▼
React storefront (useCatalog / useProducts / useProduct)
```

- Shared parsing/guard logic: `src/lib/catalog-core.ts` — imported by the
  Worker, the frontend, and the tests. Change sheet semantics there and only
  there.
- KV namespace binding `AFP_CATALOG`, key `catalog:v1`. Snapshot shape:
  `{ generatedAt, products, categories, config }`.
- Sync cron: every 5 minutes. Site cache: 60s. A Sheet edit is live in ~6
  minutes, no deploy.
- If the Sheet is unreachable or secrets are missing, the sync exits and the
  last good snapshot (or the bundled `src/data/seed-catalog.json`) keeps
  serving. The site must never white-screen because of catalog problems.

**Render guards — do not weaken them.** A product renders only when
`active = TRUE` *and* `price_bbd > 0` (`isPurchasable`). **Prices must never
be invented — the Sheet is authoritative.** Seed rows ship with price 0 and
inactive precisely so nothing unpriced can go live.

**Do not hardcode product data or category lists into components.** Categories
are free text in the Sheet; navigation and collection pages derive from the
distinct values present, women-first (`deriveCategories`).

**Currency is BBD only**, integer cents internally, displayed as
`BDS $189.00` via `formatBbd`. No USD anywhere.

**Product images** are repo files in `src/assets`, referenced from the Sheet
by filename and resolved through `productImageUrl()`. Never image URLs in the
Sheet, never hotlinked images.

Activating the sync (service account → share Sheet → secrets → KV namespace)
is documented in `README.md` → "Catalog sync setup".

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

**Never route Google Sheets access through a third-party gateway.** The sync
Worker talks to the Sheets API directly with a service-account JWT
(`worker/index.ts`). This pattern replaced a dependency on Loveable's
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

Anything actually secret (the Google service-account JSON, future payment API
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
- **The render guards and sheet parsing in `src/lib/catalog-core.ts`.** They
  are what keeps unpriced or hidden products off the live site.

Never confirm a payment from a customer-supplied artifact such as a
screenshot. Screenshots are trivially forged. Reconcile against your own bank
record or a signed webhook, never against the buyer's evidence.

---

## Testing

`npm run verify` = build + tests, and must pass with **zero** environment
variables set. Suites cover cart totals, order pricing (VAT/shipping/credit
rules), sheet parsing (sizes default, one-size stock, per-size availability),
the render guards (inactive and price-0 exclusion), the seed fallback (KV
empty, endpoint unavailable), and the order-reference format. The sheet
parsing and guard tests have been mutation-checked — if you change semantics
in `catalog-core.ts`, expect tests to fail, and update them deliberately.

---

## Outstanding work

1. **Payments.** No processor is wired in; checkout hands off to WhatsApp
   with an `AFP-YYYYMMDD-XXX` order reference. Fygaro is the leading
   candidate — it's First Atlantic Commerce's SMB platform, endorsed by both
   CIBC and RBC in Barbados, and supports JWT-signed payment links plus
   webhooks, which lets this storefront keep its own checkout. When it lands,
   webhooks should also write rows to the Sheet's `Orders` tab.
2. **Catalog sync activation.** KV namespace + Google service account +
   two Worker secrets; steps in `README.md`. Until then the site serves the
   seed catalog (12 products, all hidden at price 0).
3. **Real prices and stock in the Sheet.** Every seed row is `active=FALSE`
   with `price_bbd=0` on purpose.
4. **A product photo for A-SOC-001 (crew socks)** — no dedicated shot exists;
   the socks only appear incidentally in other photos.
5. **Brand voice split** — see above.
