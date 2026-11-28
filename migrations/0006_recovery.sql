-- AFP orders: recovering from mistakes.
-- Undo: an admin's Mark paid, Reject or Cancel can be taken back for a few
-- minutes. undo_status is the status the order had before; undo_until is
-- when the chance ends.
ALTER TABLE orders ADD COLUMN undo_status TEXT;
ALTER TABLE orders ADD COLUMN undo_until TEXT;

-- A fingerprint (SHA-256) of the proof file, so the same file sent for two
-- orders can be pointed out to the owner. Never shown; only compared.
ALTER TABLE orders ADD COLUMN proof_hash TEXT;
CREATE INDEX IF NOT EXISTS orders_proof_hash_idx ON orders (proof_hash);

-- What the owner actually saw arrive in the bank, when it was not the order
-- total. A note for her; it never changes the order's status.
ALTER TABLE orders ADD COLUMN received_cents INTEGER;

-- An email that must wait (a customer email about a move that can still be
-- undone) is not sent before this time.
ALTER TABLE outbox ADD COLUMN send_after TEXT;
