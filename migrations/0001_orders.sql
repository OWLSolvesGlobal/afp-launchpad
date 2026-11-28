-- AFP orders, phase 1. Applied to the D1 database "afp-orders".
-- Money is integer cents (BBD). Times are ISO-8601 UTC strings.

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ref              TEXT NOT NULL UNIQUE,          -- AFP-YYYYMMDD-XXX, shown to the customer
  token_hash       TEXT NOT NULL,                 -- SHA-256 of the customer's private order token
  status           TEXT NOT NULL CHECK (status IN
                     ('reserved','proof_uploaded','paid','delivered','expired','rejected','cancelled')),
  payment_method   TEXT,                          -- set when proof is uploaded (phase 2)
  fulfillment      TEXT NOT NULL CHECK (fulfillment IN ('delivery','pickup')),
  pickup_location  TEXT,
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  customer_email   TEXT,
  delivery_address TEXT,
  subtotal_cents   INTEGER NOT NULL,
  shipping_cents   INTEGER NOT NULL,
  total_cents      INTEGER NOT NULL,
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,                 -- end of the pay window while status = 'reserved'
  proof_key        TEXT,
  proof_uploaded_at TEXT,
  paid_at          TEXT,
  delivered_at     TEXT,
  closed_at        TEXT,
  closed_reason    TEXT,
  loyverse_receipt TEXT,                          -- set once the sale is recorded in Loyverse (phase 5)
  client_hash      TEXT NOT NULL                  -- hashed visitor address, for rate limits only
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, expires_at);
CREATE INDEX IF NOT EXISTS orders_client_idx ON orders (client_hash, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  sku         TEXT NOT NULL,                      -- LV-<Loyverse item id>
  name        TEXT NOT NULL,
  size        TEXT NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0)
);

CREATE INDEX IF NOT EXISTS order_items_hold_idx ON order_items (sku, size);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

-- Who did what, and when. Never holds bank details or tokens.
CREATE TABLE IF NOT EXISTS audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT NOT NULL,
  actor     TEXT NOT NULL,                        -- 'customer', 'system', or an admin's email
  action    TEXT NOT NULL,
  order_ref TEXT,
  detail    TEXT
);

CREATE INDEX IF NOT EXISTS audit_log_ref_idx ON audit_log (order_ref);

-- Owner-editable settings (bank details, pickup locations). Filled from the
-- owner's portal in phase 3; never from the repo.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
