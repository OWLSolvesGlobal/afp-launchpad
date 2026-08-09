# Alo Fitness Pro — Storefront

Editorial activewear storefront for AFP. React + Vite + TypeScript +
Tailwind, hosted on Cloudflare Workers. The catalog, stock, and site config
live in a Google Sheet, mirrored into Cloudflare KV every 5 minutes by the
site Worker.

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

- **Catalog source of truth** is a Google Sheet, mirrored into Cloudflare KV
  by the Worker's 5-minute cron and served as one JSON snapshot at
  `GET /api/catalog`. See `docs/CATALOG-ARCHITECTURE.md` (developer detail),
  `docs/SHEET_TEMPLATE.md` (sheet schema + importable CSVs), and
  `docs/RUNBOOK.md` (owner guide).
- **Images** are files in `src/assets`, referenced from the Sheet by
  filename.
- **Checkout** collects the order and hands off to WhatsApp with an
  `AFP-YYYYMMDD-XXX` order reference. There is no card payment processor
  wired in yet.
- The site degrades gracefully: with no KV namespace, no secrets, and no
  Sheet, it serves the bundled seed catalog.

## Catalog sync setup (one-time)

Until these steps are done, the site works but serves the seed catalog and
the cron sync no-ops.

1. **Create the KV namespace** and wire it up:

   ```bash
   npx wrangler kv namespace create AFP_CATALOG
   ```

   Paste the returned id into the commented `kv_namespaces` block in
   `wrangler.jsonc` and uncomment it.

2. **Create a Google service account**: in Google Cloud Console, create a
   service account, enable the **Google Sheets API** for the project, and
   download the service account's JSON key.

3. **Share the catalog Sheet** with the service account's email address
   (Viewer is enough — the sync only reads).

4. **Set the two Worker secrets**:

   ```bash
   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON   # paste the whole JSON key file
   npx wrangler secret put CATALOG_SHEET_ID              # the id from the Sheet's URL
   ```

Deploy (or wait for the next push to `main`), and the next cron tick starts
syncing. Verify with `curl -sI https://<site>/api/catalog | grep x-afp` —
`x-afp-catalog-source: kv` means live Sheet data; `seed` means the fallback.

---

## Environment variables

There are none. `VITE_`-prefixed variables would be compiled into the public
browser bundle, so real secrets (the service-account JSON, future payment
keys) live exclusively in Cloudflare Worker secrets.
