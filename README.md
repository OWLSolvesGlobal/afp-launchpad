# Alo Fitness Pro — Storefront

Editorial activewear storefront for AFP. React + Vite + TypeScript +
Tailwind, hosted on Cloudflare Workers. Items, sizes, prices and stock live
in Loyverse (the shop's point of sale), mirrored into Cloudflare KV every 5
minutes by the site Worker.

---

## Running locally

```bash
npm install
npm run dev               # http://localhost:8080
```

No environment variables are needed. Without the Worker running, the site
uses the bundled seed catalog (`src/data/seed-catalog.json`). To exercise the
real `/api/catalog` route locally, use `npm run cf:preview`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run cf:preview` | Build + run the real Worker locally via wrangler |
| `npm test` | Run the test suite |
| `npm run verify` | Build **and** test — run this before every commit |
| `npm run lint` | Lint |


### Pre-commit checks

`main` deploys straight to production, so nothing should be committed that
doesn't build and pass tests. To have git enforce that automatically:

```bash
git config core.hooksPath .githooks
```

That runs `npm run build && npm test` on every commit and blocks the commit if
either fails. It adds about 40 seconds. If that becomes tiresome during rapid
iteration, drop the build step from `.githooks/pre-commit` and rely on
`npm run verify` before pushing instead.

---

## Deploying — Cloudflare Workers

The site is hosted on **Cloudflare Workers**. Config lives in
`wrangler.jsonc`. The Worker script (`worker/index.ts`) only runs for
`/api/*` requests and the sync cron; every other request is served straight
from Cloudflare's edge as a static asset.

### First-time setup (once, ~5 minutes)

1. Log in to the Cloudflare dashboard → **Compute (Workers)** → **Create**.
2. Choose **Import a repository** and connect `OWLSolvesGlobal/afp-launchpad`.
3. Set the build configuration:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
4. Deploy. You will get a URL like
   `https://afp-launchpad.<your-account>.workers.dev`.

From then on, **every push to `main` rebuilds and redeploys automatically.**
No further action is needed to publish changes.

### Deploying from your laptop instead

```bash
npx wrangler login     # once
npm run deploy         # builds and ships
```

### Right after the first deploy

Check that the hostname in the `X-Robots-Tag: noindex` block at the bottom of
`public/_headers` matches your real `workers.dev` hostname. This stops Google
indexing the temporary URL. If you skip it, the preview domain can end up
ranking for "Alo Fitness Pro" and competing with your real domain later.

### Adding alofitnesspro.com later

1. Add the domain to Cloudflare (dashboard → **Add a domain**) and point your
   registrar at the two Cloudflare nameservers it shows you.
2. In the Worker → **Settings** → **Domains & Routes** → **Add custom domain**.
3. Update the `canonical` URL in `index.html`.
4. Keep the `noindex` block in `public/_headers` scoped to the workers.dev
   hostname only.

TLS, CDN, and DNS are handled by Cloudflare automatically.

### A note on `_redirects`

Do not add a `/* /index.html 200` rule to a `_redirects` file. On Cloudflare
Workers, redirect rules are applied **even when a real file matches the
request**, so a splat rule would intercept your JavaScript and CSS and serve
HTML instead, breaking the site. SPA routing is handled by
`assets.not_found_handling` in `wrangler.jsonc` instead.

---

## Architecture notes

- **Catalog source of truth** is Loyverse (items, sizes, prices, stock),
  mirrored into Cloudflare KV by the Worker's 5-minute cron and served as
  one JSON snapshot at `GET /api/catalog`. Website-only details live in
  `src/data/site-settings.json`. See `docs/CATALOG-ARCHITECTURE.md`.
- **Images** are files in `src/assets`, referenced from
  `site-settings.json` by filename.
- **Checkout** collects the order and hands off to WhatsApp with an
  `AFP-YYYYMMDD-XXX` order reference. There is no card payment processor
  wired in yet.
- The site degrades gracefully: with no KV namespace, no token, or Loyverse
  unreachable, it serves the last snapshot. With no snapshot at all it shows
  an empty shop, never stale sample products.

## Catalog sync setup (one-time)

Both steps were completed on 24 Nov 2026; they are recorded here in case the
site is ever rebuilt in a new Cloudflare account.

1. **KV namespace.** `npx wrangler kv namespace create AFP_CATALOG`, then put
   the returned id in the `kv_namespaces` block in `wrangler.jsonc`.

2. **Loyverse access token.** In the Loyverse Back Office, open Access tokens
   and add a token. Store it in Cloudflare's **Secrets Store** (Storage &
   Databases > Secrets Store) as a secret named `AFPWebsite` with the Workers
   scope. The `secrets_store_secrets` block in `wrangler.jsonc` binds it to
   the Worker by store id.

   Never commit the token or paste it into chat, an issue, or a PR.

The next cron tick (within 5 minutes of a deploy) starts syncing. Verify with
`curl -sI https://<site>/api/catalog | grep x-afp`:
`x-afp-catalog-source: kv` means live Loyverse data; `seed` means the empty
fallback. `GET /api/catalog/status` shows how the latest sync went. Sync results and notes on left-out items appear in the Worker's
logs in the Cloudflare dashboard.

---

## Environment variables

There are none. `VITE_`-prefixed variables would be compiled into the public
browser bundle, so real secrets (the service-account JSON, future payment
keys) live exclusively in Cloudflare Worker secrets.

## Orders database

Orders are stored in the Cloudflare D1 database `afp-orders`, bound to the
Worker as `ORDERS_DB` in `wrangler.jsonc`. The schema is in `migrations/`.
A deploy does not apply migrations; apply a new one by hand:

```bash
npx wrangler d1 migrations apply afp-orders --remote
```

`0001_orders.sql` to `0004_network_limit.sql` were applied on 28 Nov 2026.

## Payment proofs

Customers' proofs of payment are stored in the private R2 bucket
`afp-order-proofs`, bound to the Worker as `PROOFS`. The bucket has no public
access and no custom domain, and must stay that way: proofs are read only by
the Worker, for a signed-in admin. R2 has to be enabled on the Cloudflare
account (it asks for a payment card) before the bucket can exist; a deploy
fails if the bucket is missing. The rules the orders code must
keep are in `CLAUDE.md`; the acceptance runs are in `docs/ORDER-TEST-RUNS.md`.

## Order emails (Cloudflare Email Sending)

The Worker emails the two owners when a proof of payment arrives, plus a
morning summary when something is waiting. Customer emails are built but
switched off (`CUSTOMER_EMAILS` in `wrangler.jsonc`).

One-time setup for owner emails (free plan):

1. Apply the migration: `npx wrangler d1 migrations apply afp-orders --remote`.
2. Cloudflare dashboard → alofitnesspro.com → Email → Email Routing: enable
   it (this adds MX and SPF records to the domain).
3. Under Destination addresses, add alofitnesspro@outlook.com and
   brandonhlouis@outlook.com. Each gets a verification email and must click
   the link.
4. Add the binding to `wrangler.jsonc` and deploy:
   `"send_email": [{ "name": "EMAIL", "allowed_destination_addresses": ["alofitnesspro@outlook.com", "brandonhlouis@outlook.com"] }]`

Until step 4 nothing is sent: alerts wait in the `outbox` table (up to 72
hours) and the portal home says email alerts are off.

To email customers as well: upgrade to Workers Paid, onboard
alofitnesspro.com for Email Sending, remove `allowed_destination_addresses`
from the binding, and set `CUSTOMER_EMAILS` to `"on"`.

## Owner's portal sign-in (Cloudflare Access)

`/admin` and `/api/admin/*` sit behind a Cloudflare Access application
(Zero Trust → Access → Applications, self-hosted) with two paths on
`alofitnesspro.com`: `admin` and `api/admin`. Its policy allows the emails
`alofitnesspro@outlook.com` and `brandonhlouis@outlook.com` with the one-time
PIN login method.

The Worker checks the Access token on every admin request. It needs two plain
vars in `wrangler.jsonc`:

- `ACCESS_TEAM_DOMAIN`: `https://<team-name>.cloudflareaccess.com`
- `ACCESS_AUD`: the application's Audience (AUD) tag

While either is empty the portal's API refuses every request. To add or remove
an admin, change BOTH the Access policy and `ADMIN_EMAILS` in
`src/lib/orders-core.ts`; either one alone is not enough.
