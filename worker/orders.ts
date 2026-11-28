/**
 * Orders: reserve, look up, hold stock, expire.  (Phase 1 of the orders build.)
 *
 *   POST /api/orders        reserve an order; items are held for 60 minutes
 *   GET  /api/orders/:ref   the customer's own order (needs their order token)
 *
 * The database (D1, binding ORDERS_DB) is the only place orders live. The
 * rules that do not need a database are in src/lib/orders-core.ts.
 *
 * Safety properties this file is responsible for:
 *  - Prices and totals come from the catalog snapshot, never from the request.
 *  - Stock is checked and the hold is taken in ONE database statement per
 *    line, inside one transaction, so two customers cannot both reserve the
 *    last piece.
 *  - An order can only be read with its reference AND its private token. A
 *    wrong token and a missing order give the same answer.
 *  - Only a hash of the token is stored.
 *  - Each visitor is limited in how many orders they can open.
 */
import { sizeStock, type CatalogSnapshot } from "../src/lib/catalog-core";
import {
  ORDER_LIMITS,
  expiryFor,
  holdKey,
  newOrderRef,
  parseOrderInput,
  priceOrder,
  type OrderStatus,
  type PricedLine,
  type PublicOrder,
} from "../src/lib/orders-core";

/** The slice of the D1 API this file uses (lets tests supply a real SQLite). */
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface OrdersDb {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]>;
}

/**
 * An order holds stock while it is:
 *  - reserved and still inside its pay window, or
 *  - waiting for the owner to check an uploaded proof, or
 *  - paid/delivered but not yet recorded in Loyverse (once it is recorded,
 *    Loyverse's own stock count already reflects the sale).
 * `?` is the current time.
 */
const HOLDS = `(
  (o.status = 'reserved' AND o.expires_at > ?)
  OR o.status = 'proof_uploaded'
  OR (o.status IN ('paid','delivered') AND o.loyverse_receipt IS NULL)
)`;

const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare two equal-length hex strings without leaking where they differ. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** A browser on another site must not be able to place orders for a visitor. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients send none; they carry no visitor cookies either
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Active holds per sku+size, as a lookup. Empty if the database is unavailable. */
export async function loadHolds(db: OrdersDb | undefined, now: Date): Promise<Map<string, number>> {
  const holds = new Map<string, number>();
  if (!db) return holds;
  const rows = await db
    .prepare(
      `SELECT oi.sku AS sku, oi.size AS size, SUM(oi.quantity) AS held
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE ${HOLDS}
        GROUP BY oi.sku, oi.size`,
    )
    .bind(now.toISOString())
    .all<{ sku: string; size: string; held: number }>();
  for (const r of rows.results) holds.set(holdKey(r.sku, r.size), Number(r.held));
  return holds;
}

interface OrderRow {
  id: number;
  ref: string;
  token_hash: string;
  status: OrderStatus;
  fulfillment: "delivery" | "pickup";
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  created_at: string;
  expires_at: string;
}

async function publicOrder(db: OrdersDb, row: OrderRow, status: OrderStatus): Promise<PublicOrder> {
  const items = await db
    .prepare(
      `SELECT sku, name, size, quantity, price_cents AS priceCents
         FROM order_items WHERE order_id = ? ORDER BY id`,
    )
    .bind(row.id)
    .all<PricedLine>();
  return {
    ref: row.ref,
    status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    fulfillment: row.fulfillment,
    items: items.results,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
  };
}

export interface OrdersEnv {
  ORDERS_DB?: OrdersDb;
}

/** POST /api/orders */
export async function createOrder(
  request: Request,
  env: OrdersEnv,
  snapshot: CatalogSnapshot | null,
  now: Date = new Date(),
): Promise<Response> {
  const db = env.ORDERS_DB;
  if (!db || !snapshot) {
    return json({ error: "Ordering is not available right now. Please try again in a few minutes." }, 503);
  }
  if (!sameOrigin(request)) return json({ error: "That request can't be accepted." }, 403);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return json({ error: "We couldn't read that order." }, 415);
  }

  const text = await request.text();
  if (text.length > ORDER_LIMITS.maxBodyBytes) return json({ error: "That order is too large." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "We couldn't read that order." }, 400);
  }

  const parsed = parseOrderInput(body);
  if (!parsed.ok) return json({ error: parsed.error, field: parsed.field }, 400);
  const priced = priceOrder(parsed.value, snapshot);
  if (!priced.ok) return json({ error: priced.error, field: priced.field }, 409);

  // --- Rate limits, per visitor (hashed address; the address itself is not stored)
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  const clientHash = await sha256Hex(`afp-client|${address}`);
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - ORDER_LIMITS.windowMinutes * 60_000).toISOString();

  const recent = await db
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE client_hash = ? AND created_at > ?`)
    .bind(clientHash, windowStart)
    .first<{ n: number }>();
  if (Number(recent?.n ?? 0) >= ORDER_LIMITS.maxOrdersPerWindow) {
    return json(
      { error: "Too many orders in a short time. Please wait a few minutes and try again." },
      429,
      { "retry-after": String(ORDER_LIMITS.windowMinutes * 60) },
    );
  }
  const open = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM orders
        WHERE client_hash = ? AND status = 'reserved' AND expires_at > ?`,
    )
    .bind(clientHash, nowIso)
    .first<{ n: number }>();
  if (Number(open?.n ?? 0) >= ORDER_LIMITS.maxOpenReservations) {
    return json(
      { error: "You already have unpaid orders reserved. Please complete or wait for those first." },
      429,
      { "retry-after": "600" },
    );
  }

  // --- Reserve: one transaction; each line takes its hold only if stock allows
  const input = parsed.value;
  const order = priced.value;
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = expiryFor(now);
  const stockBySkuSize = new Map<string, number>();
  for (const p of snapshot.products) {
    for (const size of p.sizes) stockBySkuSize.set(holdKey(p.sku, size), sizeStock(p, size));
  }

  let ref = "";
  let results: { meta: { changes: number } }[] | null = null;
  for (let attempt = 0; attempt < 6 && !results; attempt += 1) {
    ref = newOrderRef(now);
    const statements: Statement[] = [
      db
        .prepare(
          `INSERT INTO orders
             (ref, token_hash, status, fulfillment, pickup_location, customer_name, customer_phone,
              customer_email, delivery_address, subtotal_cents, shipping_cents, total_cents,
              created_at, expires_at, client_hash)
           VALUES (?, ?, 'reserved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          ref,
          tokenHash,
          input.fulfillment,
          input.pickupLocation || null,
          input.customer.name,
          input.customer.phone,
          input.customer.email || null,
          input.customer.address || null,
          order.subtotalCents,
          order.shippingCents,
          order.totalCents,
          nowIso,
          expiresAt,
          clientHash,
        ),
      ...order.lines.map((line) =>
        db
          .prepare(
            `INSERT INTO order_items (order_id, sku, name, size, quantity, price_cents)
             SELECT n.id, ?, ?, ?, ?, ?
               FROM orders n
              WHERE n.ref = ?
                AND ? - (SELECT COALESCE(SUM(oi.quantity), 0)
                           FROM order_items oi JOIN orders o ON o.id = oi.order_id
                          WHERE oi.sku = ? AND oi.size = ? AND ${HOLDS}) >= ?`,
          )
          .bind(
            line.sku,
            line.name,
            line.size,
            line.quantity,
            line.priceCents,
            ref,
            stockBySkuSize.get(holdKey(line.sku, line.size)) ?? 0,
            line.sku,
            line.size,
            nowIso,
            line.quantity,
          ),
      ),
    ];
    try {
      results = await db.batch(statements);
    } catch (err) {
      // A reference collision (same day, same 3 digits): pick another and retry.
      if (!/UNIQUE/i.test(String(err instanceof Error ? err.message : err))) throw err;
    }
  }
  if (!results) return json({ error: "We couldn't reserve that order. Please try again." }, 503);

  const short = order.lines.filter((_, i) => results![i + 1].meta.changes !== 1);
  if (short.length > 0) {
    // Not everything could be held: release the whole order. Nothing is half-reserved.
    await db.batch([
      db.prepare(`DELETE FROM order_items WHERE order_id = (SELECT id FROM orders WHERE ref = ?)`).bind(ref),
      db.prepare(`DELETE FROM orders WHERE ref = ?`).bind(ref),
    ]);
    const holds = await loadHolds(db, now);
    return json(
      {
        error: "Some items just sold out or have fewer left than you asked for.",
        field: "items",
        unavailable: short.map((l) => ({
          sku: l.sku,
          name: l.name,
          size: l.size,
          requested: l.quantity,
          available: Math.max(
            0,
            (stockBySkuSize.get(holdKey(l.sku, l.size)) ?? 0) - (holds.get(holdKey(l.sku, l.size)) ?? 0),
          ),
        })),
      },
      409,
    );
  }

  await db
    .prepare(`INSERT INTO audit_log (at, actor, action, order_ref, detail) VALUES (?, 'customer', 'order_reserved', ?, ?)`)
    .bind(nowIso, ref, `${order.lines.length} line(s), total ${order.totalCents} cents, ${input.fulfillment}`)
    .run();

  const row = await db.prepare(`SELECT * FROM orders WHERE ref = ?`).bind(ref).first<OrderRow>();
  return json({ order: await publicOrder(db, row!, "reserved"), token }, 201);
}

/** GET /api/orders/:ref  (header x-order-token) */
export async function getOrder(
  request: Request,
  env: OrdersEnv,
  ref: string,
  now: Date = new Date(),
): Promise<Response> {
  const notFound = () => json({ error: "We couldn't find that order." }, 404);
  const db = env.ORDERS_DB;
  if (!db) return json({ error: "Orders are not available right now." }, 503);

  const token = (request.headers.get("x-order-token") ?? "").trim();
  if (!/^AFP-\d{8}-\d{3}$/.test(ref) || !/^[0-9a-f]{64}$/.test(token)) return notFound();

  const row = await db.prepare(`SELECT * FROM orders WHERE ref = ?`).bind(ref).first<OrderRow>();
  // Hash even when there is no row, so both failures take the same path.
  const given = await sha256Hex(token);
  if (!row || !sameHash(given, row.token_hash)) return notFound();

  let status = row.status;
  if (status === "reserved" && row.expires_at <= now.toISOString()) {
    await expireOrders(env, now);
    status = "expired";
  }
  return json({ order: await publicOrder(db, row, status) });
}

/** Close reservations whose pay window has passed. Run by the cron. */
export async function expireOrders(env: OrdersEnv, now: Date = new Date()): Promise<number> {
  const db = env.ORDERS_DB;
  if (!db) return 0;
  const nowIso = now.toISOString();
  const due = await db
    .prepare(`SELECT ref FROM orders WHERE status = 'reserved' AND expires_at <= ?`)
    .bind(nowIso)
    .all<{ ref: string }>();
  if (due.results.length === 0) return 0;
  await db.batch([
    db
      .prepare(
        `UPDATE orders SET status = 'expired', closed_at = ?, closed_reason = 'no proof within the pay window'
          WHERE status = 'reserved' AND expires_at <= ?`,
      )
      .bind(nowIso, nowIso),
    ...due.results.map((r) =>
      db
        .prepare(`INSERT INTO audit_log (at, actor, action, order_ref, detail) VALUES (?, 'system', 'order_expired', ?, 'stock released')`)
        .bind(nowIso, r.ref),
    ),
  ]);
  return due.results.length;
}
