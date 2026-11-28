-- AFP orders: fairer order limits.
-- client_hash now identifies one device on one network. net_hash is the
-- network alone (hashed, never the address itself), used only for a much
-- higher ceiling so many customers sharing a phone network are not blocked.
ALTER TABLE orders ADD COLUMN net_hash TEXT;

CREATE INDEX IF NOT EXISTS orders_net_idx ON orders (net_hash, created_at);
