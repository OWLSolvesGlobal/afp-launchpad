# AFP Storefront — working notes

Context for anyone (human or agent) making changes to this repo.

## What this is

E-commerce storefront for Alo Fitness Pro, a Barbados-based activewear brand.
React 18 + Vite + TypeScript + Tailwind + shadcn/ui. Supabase for auth,
catalog, and stock. Hosted on Cloudflare Workers static assets.

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

Config lives in `wrangler.jsonc`. It is deliberately an **assets-only Worker**
— no `main` entry point — so requests are served from edge cache and the
Worker is never invoked. If you add a Worker script, you change the billing
and performance characteristics of the whole site. Do that consciously.

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

**Never route Google Sheets access through a third-party gateway.** Sheets
calls go direct via a service account in
`supabase/functions/_shared/google-sheets.ts`. This replaced a dependency on
Loveable's connector gateway, which would have died with the subscription.

**Keep the routes lazy.** Everything except the landing page is code-split in
`App.tsx`. The 3D-heavy 404 page pulls in ~907 KB of three.js and the admin
panel is irrelevant to shoppers — neither belongs in the storefront bundle.
Converting a `lazy()` import back to a static one silently triples the
initial payload.

**Logo files stay PNG.** They need transparency. Photos should not be PNG —
three photos were shipping at 720 KB / 301 KB / 231 KB where WebP equivalents
are roughly 55 KB / 21 KB / 30 KB.

---

## Secrets

`VITE_`-prefixed variables are compiled into the browser bundle and are public
by design. Supabase's anon key is *meant* to be public — data is protected by
Row Level Security, not by hiding the key.

Anything actually secret (Google service account key, payment API secrets)
belongs in Supabase Edge Function secrets. Never in `.env`, never in client
code.

`.env` is currently still tracked in git from before it was gitignored. It
contains only publishable keys, so this is untidy rather than dangerous — but
do not add anything sensitive to it.

---

## Catalog architecture

**The Google Sheet is the source of truth for products.** It syncs into
Supabase via the `sync-products` edge function. Images are uploaded through
`/admin/upload` into Supabase Storage; the resulting URL goes in the sheet's
`image_url` column.

Do not hardcode product data into components. If a product needs to change,
it changes in the sheet. See `docs/CATALOG-ARCHITECTURE.md` and
`docs/RUNBOOK.md` (the latter is written for non-technical operators).

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
- **Supabase RLS policies.** These are the only thing protecting customer data.
- **`wrangler.jsonc` and `public/_headers`.** See gotchas above.

Never confirm a payment from a customer-supplied artifact such as a
screenshot. Screenshots are trivially forged. Reconcile against your own bank
record or a signed webhook, never against the buyer's evidence.

---

## Testing

Coverage is currently one placeholder test. Given `main` deploys straight to
production, any substantial change should come with at least a smoke test.
Highest-value things to cover first: cart totals, checkout state transitions,
and the product sync parser.

---

## Outstanding work

1. **Payments.** No processor is wired in; checkout hands off to WhatsApp.
   Fygaro is the leading candidate — it's First Atlantic Commerce's SMB
   platform, endorsed by both CIBC and RBC in Barbados, and supports
   JWT-signed payment links plus webhooks, which lets this storefront keep
   its own checkout.
2. **Google service account.** Until configured, the sheet sync does not run.
   Setup steps are in the README.
3. **Row Level Security audit.**
4. **Image optimisation** — the three oversized PNGs above.
5. **Brand voice split** — see above.
