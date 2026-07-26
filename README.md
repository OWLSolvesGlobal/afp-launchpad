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
| `npm run lint` | Lint |

---

## Deploying

This is a static SPA. It builds to `dist/` and can be hosted anywhere.
Config for three hosts is already committed — pick one, no code changes needed.

**Recommended: Vercel** (fastest path from GitHub to live)

1. Go to vercel.com → **Add New → Project** → import `afp-launchpad`.
2. Vercel reads `vercel.json`, so build settings auto-fill. Leave them.
3. Add the three `VITE_` environment variables from your `.env`.
4. Deploy. You get `afp-launchpad.vercel.app` immediately — no domain required.
5. Every push to `main` redeploys automatically.

**Alternative: Cloudflare Pages** — better if image bandwidth grows. Build
command `npm run build`, output directory `dist`. Reads `public/_redirects`.

**Alternative: Netlify** — reads `netlify.toml`. Same env vars.

### Adding the domain later

Add it in the host's dashboard and point the DNS records it gives you. Then
update the `canonical` URL in `index.html`. Nothing else changes.

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
