# AFP Store — Everyday Runbook

This is the non-technical guide. Everything here is done in a Google Sheet or
on one admin page. **You never need to touch code to run the store.**

---

## The one thing to understand

The Google Sheet **is** the store. The website just displays what the Sheet says.

```
You edit the Sheet  →  the site updates within about a minute
```

If the site shows something wrong, the fix is almost always in the Sheet.

---

## Adding a new product

1. Open the **Products** tab of the catalog Sheet.
2. Add one new row at the bottom. Fill in these columns:

| Column | What to put | Example |
| --- | --- | --- |
| `id` | A code no other product has. Never reuse an old one. | `w-014` |
| `slug` | The web address, lowercase with dashes, no spaces | `lime-zip-romper` |
| `name` | What customers see | `Lime Zip Romper` |
| `gender` | `women`, `men`, or `unisex` | `women` |
| `category` | Type of item. A new word here creates a new category. | `rompers` |
| `price_usd` | Just the number | `68.00` |
| `compare_at_usd` | Old price, to show a markdown. Leave blank if none. | `85.00` |
| `colors` | `Name:hexcode`, separated by `\|` | `Lime:#B5D334 \| Blush:#F7C8D0` |
| `sizes` | Separated by `\|`, in the order you want them shown | `XS \| S \| M \| L` |
| `image_url` | Paste from the upload page (see below) | |
| `image_alt` | Short description of the photo, for accessibility and Google | `Lime zip-front romper, front view` |
| `badge` | Optional. Leave blank unless you want a label. | `BESTSELLER` |
| `published` | `TRUE` to show it, `FALSE` to hide it | `TRUE` |

3. Open the **Stock** tab. Add one row for **every size and colour combination**:

| `product_id` | `size` | `color` | `quantity` |
| --- | --- | --- | --- |
| `w-014` | `S` | `Lime` | `6` |
| `w-014` | `M` | `Lime` | `4` |

A combination with no row, or `0`, shows as sold out automatically.

---

## Adding a product photo

1. Go to **`/admin/upload`** on the site and sign in.
2. Upload the image. The page gives you back a web address.
3. Paste that address into the `image_url` column in the Sheet.

Do not paste a Google Drive or Dropbox link — those will not display.

---

## Common jobs

**Change a price** — edit `price_usd`. Done.

**Put something on sale** — put the original price in `compare_at_usd` and the
new lower price in `price_usd`. The site shows the strikethrough automatically.

**Mark something sold out** — set its `quantity` to `0` in the Stock tab. Do not
delete the product.

**Hide a product without deleting it** — set `published` to `FALSE`.

**Restock** — change the `quantity` number back up. It reappears on its own.

---

## If the site doesn't update

Work down this list in order. Stop when it works.

1. **Wait 60 seconds and refresh.** Most of the time this is it.
2. **Go to `/admin/sync` and press the sync button.** This forces an update
   immediately and tells you if anything is wrong.
3. **Check the sync page for red error text.** It names the exact row and
   column that has a problem. Usually a typo — a price written as `$68` instead
   of `68.00`, or a missing `id`.
4. **Check `published` is `TRUE`** on the product you're looking for.

If the sync page reports an error it can't explain, that's a developer job.

---

## Things that will break the store

- **Renaming or reordering the column headers** in the Sheet. The headers are
  how the site finds the data. Add new columns at the far right if you need to.
- **Reusing an `id`** from a deleted product.
- **Deleting the `Products` or `Stock` tab**, or renaming them.
- **Two products with the same `slug`.**
- **Putting currency symbols or commas in price columns.** Numbers only.

Everything else is safe to experiment with. If a product looks wrong, set
`published` to `FALSE` and fix it calmly.

---

## Publishing website changes (not products)

Product changes go through the Sheet and need nothing else.

Changes to the actual website — wording, layout, new pages — happen in the code
and publish automatically when pushed to GitHub. Cloudflare rebuilds and the
change is live in about two minutes. Nobody has to press "deploy."

---

## Who to call

| Problem | Where it lives |
| --- | --- |
| Wrong price, stock, or product details | The Google Sheet |
| Photo won't show | `/admin/upload`, then the `image_url` column |
| Sync errors | `/admin/sync` — read the red text |
| Site completely down | Cloudflare dashboard → the Worker → Logs |
| Customer can't check out | Checkout hands off to WhatsApp — check that number |
