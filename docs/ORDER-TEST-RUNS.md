# Order test runs

Sixteen runs that must pass before the orders system is trusted with real
customers. Each one is covered by an automated test where a machine can check
it, and is repeated by hand on the live site before go-live.

Status key: **Auto** = automated test passes. **Hand** = done by a person on
the live site, with the date. A blank means not yet possible (the phase that
builds it has not shipped).

Reservation window: 60 minutes. Delivery: BDS $15, free at BDS $300 or more.

## Should work

| # | Run | Expected | Phase | Auto | Hand |
|---|-----|----------|-------|------|------|
| 1 | CIBC customer pays by QR, uploads a screenshot, admin marks paid, then delivered | Order moves reserved → proof uploaded → paid → delivered; stock drops in Loyverse once | 1–5 | yes, up to delivered. Loyverse sale: phase 5 | |
| 2 | Bank transfer, PDF proof, pickup | No delivery charge; PDF accepted; admin can open it | 2–3 | yes (PDF is sent to the admin as a download) | |
| 3 | Two items totalling BDS $300 or more, delivery | Delivery is free | 1 | yes | |
| 4 | Customer closes the tab and returns by their status link | Same order, same countdown, can still upload proof | 1–2 | yes (resume after refresh, status link, upload from the status page) | |
| 5 | Admin rejects a proof | Order becomes rejected, stock is released, customer sees why | 3 | yes (reason required, shown to the customer, stock released) | |

## Should be refused, or fail safely

| # | Run | Expected | Phase | Auto | Hand |
|---|-----|----------|-------|------|------|
| 6 | Order more than the stock on hand | Refused with the number available; nothing saved | 1 | yes | |
| 7 | Two customers try for the last piece | One gets it; the other is told it has just gone | 1 | yes | |
| 8 | No proof within 60 minutes | Order expires; stock returns to the shop | 1 | yes | |
| 9 | Proof is the wrong type, over 8 MB, or a renamed file (e.g. `.exe` called `.jpg`) | Refused; checked by content, not by name | 2 | yes (renamed program, web page named .jpg, SVG, empty file, 8 MB + 1 byte) | |
| 10 | Browser sends an altered price or total | Ignored; the Loyverse price is charged | 1 | yes | |
| 11 | Open `/admin` signed out, or signed in with an address not on the list | No access to any `/api/admin/*` data; the page shows only a sign-in screen | 3 | yes (no token, tampered, expired, wrong audience, unlisted email, forged header, on every route) | |
| 12 | Guess another order's reference without its token | Same "not found" as an order that does not exist | 1 | yes | |
| 13 | Item sells out at the till, or its price changes, while in a cart | Sold out: refused. Price change: new price shown and charged | 1 | yes | |
| 14 | Admin presses Mark paid twice | One sale in Loyverse, not two | 5 | | |
| 15 | Loyverse unreachable when marking paid | Order is still Paid; flagged "not recorded in Loyverse"; stock stays held | 5 | Hold: yes | |
| 16 | Fifty rapid order attempts from one visitor | One device: slowed after 6 in 10 minutes, never more than 3 unpaid orders. One sender inventing devices: stopped at 40 per network | 1 | yes | |

## Log of hand runs

| Date | Run | Who | Result | Notes |
|------|-----|-----|--------|-------|

## Also covered by automated tests (phase 2)

- Upload without a token, with another order's token, after expiry, and on a
  cancelled, rejected, paid or delivered order: refused.
- A proof can be replaced twice; a fourth upload is refused; only the latest
  file is kept.
- Twelve upload attempts in ten minutes, then slowed.
- A double tap on "Reserve my items and pay" creates one order.
- Cancelling releases the stock and puts the bag back.
- Bank details are withheld without the order's token, absent from the
  catalog, and hidden at checkout until they have been entered.
- After proof, the customer is told the payment is being checked, never that
  it is paid.
- An order that changes while a file is uploading keeps its state, and the
  stray file is deleted.

## Also covered by automated tests (phase 3)

- The Access token check: wrong key, unknown key, unsigned, wrong algorithm,
  no expiry, not yet valid, wrong issuer, lookalike email; keys are never
  fetched from an address the token supplies; fails closed when Access is not
  configured or its keys cannot be fetched; a rotated key is picked up.
- Cross-site, header-less and non-JSON writes refused; GET changes nothing.
- Every status move from every status: only the four allowed moves work.
- Mark paid needs the bank-check confirmation; two admins pressing at once
  change one row and write one log line.
- The audit log cannot be changed or deleted, by the API or in the database.
- Proofs: protective headers; unreachable without an admin; a customer's
  order token is not an admin pass.
- Bank details never appear in logs, audit rows, the catalog, checkout config
  or a response to someone without the order's token; the account number is
  only ever returned masked.
- Marketing consent is a yes only when explicitly ticked.
- A pickup order must name a location the owner offers.

## Also covered by automated tests (phase 4, emails)

- A proof emails both owners once, and again when it is replaced, with the
  amount and reference to look for and a portal link. Never the proof, the
  customer's private link or their token.
- Customer-typed text is shown as text; a subject cannot carry a second line.
- The mail service being down does not stop a proof being saved; the email
  is retried, given up on after five tries or three days, and the log names
  no person and no content.
- With email not set up, alerts wait and go out once it is.
- The morning summary goes once, between 8 and 9 am Barbados time, only when
  something is waiting, with counts only.
- The portal's line: "off" when not set up, "trouble" when an alert is stuck.
- Customer emails: none queued while off; when on, one per status change,
  the private link only in the first and cleared once sent.

## Hand runs that need the live site

- After email setup: upload a proof on a test order and see the alert arrive
  at both owner addresses within a minute; open its link and land on the
  order after sign-in.

- Sign in at /admin as each allowed address; be refused as any other.
- Enter the real bank details in Settings and see bank transfer appear at
  checkout.
