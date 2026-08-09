# AFP Store — Everyday Runbook

This is the non-technical guide. Everything here is done in one Google
Sheet. **You never need to touch code to run the store.**

---

## The one thing to understand

The Google Sheet **is** the store. The website copies the Sheet every
5 minutes and displays what it finds.

```
You edit the Sheet  →  the site updates within about 6 minutes
```

If the site shows something wrong, the fix is almost always in the Sheet.
All prices are in **Barbados dollars** and show on the site as `BDS $189.00`.

The Sheet has three tabs: **Catalog** (products), **Orders** (your sales
log), and **Config** (site settings). The exact columns are described in
`SHEET_TEMPLATE.md`, next to this file.

---

## Adding a new product

1. Open the **Catalog** tab. Add one row at the bottom.
2. Fill in, at minimum: `sku` (a code no other product has — never reuse an
   old one), `name`, `gender` (`women`, `men`, or `unisex`), `category`,
   `color`, `price_bbd`, the stock columns, `image`, and `image_alt`.
3. Leave `sizes` blank for normal clothing — that automatically means
   S, M, L, XL. For one-size items (visor, socks) type `ONE SIZE` in
   `sizes` and put the quantity in `one_size_stock` instead.
4. Set `active` to `TRUE` when you're ready for it to appear.

Two safety rules to know:

- **A product with a price of 0 never shows on the site**, even if
  `active` is `TRUE`. So you can prepare rows safely and fill in the price
  last.
- A row missing its `sku` or `name` is ignored completely.

**Categories are yours to invent.** Whatever you type in `category`
becomes a collection page and a menu link automatically — women's
categories are listed before men's. To retire a category, just stop using
it; to add one, just type it.

## Product photos

The `image` column holds a **filename**, not a link — it must match a
photo that's already in the website's image folder (`src/assets`). Adding
a brand-new photo is currently a developer job: send them the photo and
the sku, and they'll commit it and tell you the filename to paste.

---

## Stock

Stock is per size: `stock_S`, `stock_M`, `stock_L`, `stock_XL` (or
`one_size_stock` for one-size items).

- A size at `0` shows crossed-out on the site — customers can't pick it.
- When **every** size is 0, the product shows "Sold out" but stays
  visible. Don't delete it.
- **After each sale, subtract what you sold** from the right stock column.
  The site has no other way to know.
- Restock by putting the number back up. It reappears on its own.

## Common jobs

**Change a price** — edit `price_bbd`. Numbers only, no `$` sign.

**Put something on sale** — original price into `compare_at_bbd`, new
lower price into `price_bbd`. The strikethrough appears automatically.

**Hide a product without deleting it** — set `active` to `FALSE`.

**Change the banner across the top of the site** — Config tab, edit the
`announcement_bar` value. Blank = no banner.

**Choose what's featured on the front page** — Config tab, list skus in
`featured_skus` separated by `|`, e.g. `W-ROM-001 | W-DRS-002`.

## Turning payment options on and off

Checkout always offers WhatsApp. Two more options live in the **Config**
tab and are OFF until you switch them on — no developer needed:

- **Bank transfer**: put your bank/BimPay details into
  `transfer_instructions` (one detail per line), then set
  `payments_transfer_enabled` to `TRUE`. Customers see your instructions
  plus their order reference, and a note that the order is confirmed once
  payment is verified. **Check your own bank record before marking an
  order `paid` — never trust a screenshot.**
- **Card**: `payments_card_enabled` stays `FALSE` until card processing
  (Fygaro) is actually connected. Turning it on early shows customers a
  "coming soon" card section, nothing more.

The value must be exactly `TRUE` to switch on; anything else counts as off.

---

## Logging orders (until card payments arrive)

Checkout on the site ends with the customer sending you a WhatsApp
message. That message starts with an order reference like
`AFP-20260805-042`.

For **every sale**, add one row to the **Orders** tab:

| date | order_id | customer_name | whatsapp_number | items | total_bbd | status | payment_method | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-05 | AFP-20260805-042 | Jane W. | +1 246 … | Romper / M × 1 | 189.00 | paid | bank transfer | |

- Copy the `order_id` straight from the customer's WhatsApp message.
- `status` is one of: `pending`, `paid`, `delivered`, `cancelled`.
- **Never mark an order `paid` from a customer's screenshot.** Check your
  own bank record first — screenshots are easy to fake.
- Then update the stock columns in the Catalog tab.

The site never writes to this tab; it's your ledger.

---

## If the site doesn't update

Work down this list in order. Stop when it works.

1. **Wait 6 minutes and refresh.** The site copies the Sheet every
   5 minutes, plus up to a minute of caching. Most of the time this is it.
2. **Check `active` is `TRUE` and `price_bbd` is a real number** (not 0,
   not blank, no `$` sign) on the product you're looking for.
3. **Check the tab is named exactly `Catalog`** and the column headers
   haven't been renamed.
4. If it's still wrong after 15 minutes, that's a developer job — the
   sync logs live in the Cloudflare dashboard → the Worker → Logs.

## Things that will break the store

- **Renaming or deleting the `Catalog`, `Orders`, or `Config` tabs.**
- **Renaming column headers.** Add new columns at the far right instead.
- **Reusing a `sku`** from a deleted product.
- **Currency symbols or commas in price columns.** Numbers only.
- **Un-sharing the Sheet** from the sync's service account email.

Everything else is safe to experiment with. If a product looks wrong, set
`active` to `FALSE` and fix it calmly — it disappears from the site on the
next refresh.

---

## Publishing website changes (not products)

Product and stock changes go through the Sheet and need nothing else.

Changes to the actual website — wording, layout, photos, new pages —
happen in the code and publish automatically when pushed to GitHub.
Cloudflare rebuilds and the change is live in about two minutes. Nobody
has to press "deploy."

---

## Who to call

| Problem | Where it lives |
| --- | --- |
| Wrong price, stock, or product details | The Google Sheet, Catalog tab |
| Product not appearing | `active` = TRUE? `price_bbd` > 0? |
| Front page featured items | Config tab, `featured_skus` |
| New product photo needed | Developer (photo goes into the code repo) |
| Site completely down | Cloudflare dashboard → the Worker → Logs |
| Customer can't check out | Checkout hands off to WhatsApp — check that number |
