-- AFP orders, phase 2: payment proofs.

-- How many proofs this order has had accepted (a customer may replace theirs
-- a limited number of times).
ALTER TABLE orders ADD COLUMN proof_uploads INTEGER NOT NULL DEFAULT 0;

-- Upload attempts, for rate limits only. Holds a hashed visitor address, never
-- the address itself. Rows older than a day are deleted by the cron.
CREATE TABLE IF NOT EXISTS rate_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_hash TEXT NOT NULL,
  kind        TEXT NOT NULL,
  order_ref   TEXT,
  at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_events_client_idx ON rate_events (client_hash, kind, at);
CREATE INDEX IF NOT EXISTS rate_events_order_idx ON rate_events (order_ref, kind);
