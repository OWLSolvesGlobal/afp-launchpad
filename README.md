# Alo Fitness Pro — Storefront

Editorial activewear storefront for AFP. React + Vite + TypeScript + Tailwind,
with Supabase for auth, catalog, and stock.

---

## Running locally

```bash
npm install
cp .env.example .env      # fill in your Supabase values
npm run dev               # http://localhost:8080
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
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

The site is hosted on **Cloudflare Workers static assets**. Config lives in
`wrangler.jsonc`. There is deliberately no Worker script, which means every
request is served straight from Cloudflare's edge — the Worker is never
invoked, so the free plan's 100k requests/day limit does not apply to normal
storefront traffic.

### First-time setup (once, ~5 minutes)

1. Log in to the Cloudflare dashboard → **Compute (Workers)** → **Create**.
2. Choose **Import a repository** and connect `OWLSolvesGlobal/afp-launchpad`.
3. Set the build configuration:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
4. Deploy. You will get a URL like
   `https://afp-storefront.<your-account>.workers.dev`.

From then on, **every push to `main` rebuilds and redeploys automatically.**
No further action is needed to publish changes.

### Deploying from your laptop instead

```bash
npx wrangler login     # once
npm run deploy         # builds and ships
```

### Right after the first deploy

Open `public/_headers` and uncomment the `X-Robots-Tag: noindex` block at the
bottom, pasting in your real `workers.dev` hostname. This stops Google indexing
the temporary URL. If you skip it, the preview domain can end up ranking for
"Alo Fitness Pro" and competing with your real domain later.

### Adding alofitnesspro.com later

1. Add the domain to Cloudflare (dashboard → **Add a domain**) and point your
   registrar at the two Cloudflare nameservers it shows you.
2. In the Worker → **Settings** → **Domains & Routes** → **Add custom domain**.
3. Update the `canonical` URL in `index.html`.
4. Re-comment the `noindex` block in `public/_headers`.

TLS, CDN, and DNS are handled by Cloudflare automatically.

### A note on `_redirects`

Do not add a `/* /index.html 200` rule to a `_redirects` file. On Cloudflare
Workers, redirect rules are applied **even when a real file matches the
request**, so a splat rule would intercept your JavaScript and CSS and serve
HTML instead, breaking the site. SPA routing is handled by
`assets.not_found_handling` in `wrangler.jsonc` instead.

---

## Architecture notes

- **Catalog source of truth** is a Google Sheet, synced into Supabase by the
  `sync-products` edge function. See `docs/CATALOG-ARCHITECTURE.md`.
- **Images** are uploaded through `/admin/upload` into Supabase Storage.
- **Checkout** currently collects the order and hands off to WhatsApp. There is
  no card payment processor wired in yet.

### Google Sheets access

The sheet functions talk to the Google Sheets API **directly** via a service
account (`supabase/functions/_shared/google-sheets.ts`). One-time setup:

1. In Google Cloud Console, create a service account and download its JSON key.
2. Enable the **Google Sheets API** for that project.
3. Share the products Google Sheet with the service account's email as **Editor**.
4. Set these Supabase Edge Function secrets:

```bash
supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL="afp-sheets@your-project.iam.gserviceaccount.com"
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY="$(cat service-account.json | jq -r .private_key)"
```

The older `LOVABLE_API_KEY` and `GOOGLE_SHEETS_API_KEY` secrets are no longer
used and can be deleted.

---

## Environment variables

`VITE_`-prefixed variables are compiled into the browser bundle and are
**public by design**. Supabase's anon key is meant to be public — your data is
protected by Row Level Security policies, not by hiding the key. Anything truly
secret belongs in Supabase Edge Function secrets, never in `.env`.
