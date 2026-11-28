-- AFP orders: email notifications.
-- Every email is written here first and sent from here, so a failed send is
-- retried and nothing is lost if the mail service is briefly unavailable.
CREATE TABLE IF NOT EXISTS outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe_key  TEXT NOT NULL UNIQUE,              -- one email per event, however often it is queued
  audience    TEXT NOT NULL CHECK (audience IN ('owner','customer')),
  kind        TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  order_ref   TEXT,
  subject     TEXT NOT NULL,
  body_text   TEXT NOT NULL,                     -- cleared once sent
  body_html   TEXT NOT NULL,                     -- cleared once sent
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  sent_at     TEXT,
  last_error  TEXT
);

CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox (status, created_at);
