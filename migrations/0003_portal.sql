-- AFP orders, phase 3: owner's portal.

-- Whether the customer agreed to marketing email, and when. Only customers
-- with marketing_opt_in = 1 may ever be exported for a campaign.
ALTER TABLE orders ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN marketing_opt_in_at TEXT;

CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at);

-- The audit log is append-only. The database itself refuses to change or
-- remove a row, whatever code asks.
CREATE TRIGGER IF NOT EXISTS audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit log is append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit log is append-only');
END;
