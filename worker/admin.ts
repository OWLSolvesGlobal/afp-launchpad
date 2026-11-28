/**
 * The owner's portal API: everything under /api/admin/*.  (Phase 3.)
 *
 * One door: handleAdmin(). Nothing in this file runs until verifyAccess()
 * has confirmed a signed Cloudflare Access token for an allowed email. A
 * hidden page is not a lock; this check is.
 *
 * Safety properties this file is responsible for:
 *  - Every route, read or write, needs a verified admin. Every failure to
 *    verify gets the same answer.
 *  - GETs never change anything. Changes must be same-origin, JSON, and carry
 *    the x-afp-admin header, which a cross-site form cannot set.
 *  - An order's status changes in ONE statement that re-checks its current
 *    status, so two taps, two admins or a stale screen cannot apply a change
 *    twice or skip a step. The audit line is written in the same transaction.
 *  - Only the moves in ADMIN_MOVES exist. "Mark paid" also needs the admin's
 *    explicit confirmation that the bank account was checked.
 *  - A proof is streamed from the private bucket with headers that stop a
 *    browser treating it as anything but a picture or a download.
 *  - Bank details are never written to the audit log or the logs, and the
 *    account number is only ever returned masked.
 */
import {
  ADMIN_MOVES,
  barbadosDate,
  maskAccountNumber,
  parseBankInput,
  parsePickupInput,
  type AdminMove,
  type OrderStatus,
  type PricedLine,
} from "../src/lib/orders-core";
import { verifyAccess, type AccessEnv, type KeyFetcher } from "./access";
import { customerKindFor, notifyCustomer, orderForEmail, ownerEmailHealth, type EmailEnv } from "./email";
import { json, loadBankDetails, loadPickupLocations, type OrdersDb, type OrdersEnv } from "./orders";

/** The slice of the R2 API used to read a proof back for an admin. */
export interface ProofReader {
  get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null>;
}

export interface AdminEnv extends OrdersEnv, AccessEnv {
  PROOFS?: ProofReader;
}

const ADMIN_LIMITS = { writesPerMinute: 30, maxBodyBytes: 8_000, listMax: 100 } as const;
const REF = /^AFP-\d{8}-\d{3}$/;
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const refused = (): Response => json({ error: "Please sign in to the AFP portal." }, 403);
const notFound = (): Response => json({ error: "We couldn't find that." }, 404);

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface AdminOrderRow {
  id: number;
  ref: string;
  status: OrderStatus;
  payment_method: string | null;
  fulfillment: "delivery" | "pickup";
  pickup_location: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_address: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  created_at: string;
  expires_at: string;
  proof_key: string | null;
  proof_uploaded_at: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  loyverse_receipt: string | null;
  marketing_opt_in: number;
  item_count?: number;
}

/** An order as the portal shows it. Never includes tokens, hashes or storage keys. */
function present(row: AdminOrderRow, nowIso: string) {
  const status: OrderStatus = row.status === "reserved" && row.expires_at <= nowIso ? "expired" : row.status;
  return {
    ref: row.ref,
    status,
    customerName: row.customer_name,
    totalCents: row.total_cents,
    fulfillment: row.fulfillment,
    pickupLocation: row.pickup_location ?? "",
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    proofUploadedAt: row.proof_uploaded_at,
    paidAt: row.paid_at,
    deliveredAt: row.delivered_at,
    closedAt: row.closed_at,
    hasProof: Boolean(row.proof_key),
    // Paid, but the sale is not in Loyverse yet: the owner rings it up at the till.
    needsLoyverse: (row.status === "paid" || row.status === "delivered") && !row.loyverse_receipt,
    itemCount: Number(row.item_count ?? 0),
  };
}

/** Filters for the orders list. `needsNow` marks the ones that compare against the clock. */
const VIEWS: Record<string, { where: string; needsNow?: boolean }> = {
  // "Needs you": proofs to check first, then paid orders to hand over or still to ring up.
  needs: { where: `(o.status = 'proof_uploaded' OR o.status = 'paid' OR (o.status = 'delivered' AND o.loyverse_receipt IS NULL))` },
  reserved: { where: `(o.status = 'reserved' AND o.expires_at > ?)`, needsNow: true },
  proof_uploaded: { where: `o.status = 'proof_uploaded'` },
  paid: { where: `o.status = 'paid'` },
  delivered: { where: `o.status = 'delivered'` },
  expired: { where: `(o.status = 'expired' OR (o.status = 'reserved' AND o.expires_at <= ?))`, needsNow: true },
  rejected: { where: `o.status = 'rejected'` },
  cancelled: { where: `o.status = 'cancelled'` },
  all: { where: `1 = 1` },
};

async function listOrders(db: OrdersDb, url: URL, nowIso: string): Promise<Response> {
  const view = VIEWS[url.searchParams.get("view") ?? "all"];
  if (!view) return json({ error: "Unknown filter." }, 400);
  const q = (url.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const binds: unknown[] = view.needsNow ? [nowIso] : [];
  let search = "";
  if (q) {
    // LIKE wildcards in what she typed are matched literally.
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    search = `AND (o.ref LIKE ? ESCAPE '\\' OR o.customer_name LIKE ? ESCAPE '\\'
                   OR o.customer_phone LIKE ? ESCAPE '\\' OR o.customer_email LIKE ? ESCAPE '\\')`;
    binds.push(like, like, like, like);
  }
  binds.push(ADMIN_LIMITS.listMax);
  const rows = await db
    .prepare(
      `SELECT o.*, (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
         FROM orders o
        WHERE ${view.where} ${search}
        ORDER BY CASE o.status WHEN 'proof_uploaded' THEN 0 WHEN 'paid' THEN 1 ELSE 2 END,
                 CASE WHEN o.status = 'proof_uploaded' THEN o.proof_uploaded_at END ASC,
                 o.created_at DESC
        LIMIT ?`,
    )
    .bind(...binds)
    .all<AdminOrderRow>();
  return json({ orders: rows.results.map((r) => present(r, nowIso)), serverTime: nowIso });
}

async function summary(db: OrdersDb, env: EmailEnv, now: Date): Promise<Response> {
  const nowIso = now.toISOString();
  // "Today" is the Barbados day (UTC-4), expressed as a UTC instant.
  const local = barbadosDate(now);
  const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 4 * 3600_000).toISOString();
  const row = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'proof_uploaded' THEN 1 ELSE 0 END) AS proofs_waiting,
         SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS to_deliver,
         SUM(CASE WHEN status = 'reserved' AND expires_at > ?1 THEN 1 ELSE 0 END) AS held_unpaid,
         SUM(CASE WHEN status IN ('paid','delivered') AND loyverse_receipt IS NULL THEN 1 ELSE 0 END) AS needs_loyverse,
         SUM(CASE WHEN status IN ('paid','delivered') AND paid_at >= ?2 THEN 1 ELSE 0 END) AS paid_today_count,
         SUM(CASE WHEN status IN ('paid','delivered') AND paid_at >= ?2 THEN total_cents ELSE 0 END) AS paid_today_cents
       FROM orders`,
    )
    .bind(nowIso, dayStart)
    .first<Record<string, number | null>>();
  return json({
    proofsWaiting: Number(row?.proofs_waiting ?? 0),
    toDeliver: Number(row?.to_deliver ?? 0),
    heldUnpaid: Number(row?.held_unpaid ?? 0),
    needsLoyverse: Number(row?.needs_loyverse ?? 0),
    paidTodayCount: Number(row?.paid_today_count ?? 0),
    paidTodayCents: Number(row?.paid_today_cents ?? 0),
    // "off" = email alerts are not set up; "trouble" = a recent alert could not be sent.
    emailAlerts: await ownerEmailHealth(env, now),
    serverTime: nowIso,
  });
}

async function orderDetail(db: OrdersDb, ref: string, nowIso: string): Promise<Response> {
  const row = await db
    .prepare(
      `SELECT o.*, (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
         FROM orders o WHERE o.ref = ?`,
    )
    .bind(ref)
    .first<AdminOrderRow>();
  if (!row) return notFound();
  const [items, history] = await Promise.all([
    db
      .prepare(`SELECT sku, name, size, quantity, price_cents AS priceCents FROM order_items WHERE order_id = ? ORDER BY id`)
      .bind(row.id)
      .all<PricedLine>(),
    db
      .prepare(`SELECT at, actor, action, detail FROM audit_log WHERE order_ref = ? ORDER BY id`)
      .bind(ref)
      .all<{ at: string; actor: string; action: string; detail: string | null }>(),
  ]);
  return json({
    order: {
      ...present(row, nowIso),
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email ?? "",
      deliveryAddress: row.delivery_address ?? "",
      subtotalCents: row.subtotal_cents,
      shippingCents: row.shipping_cents,
      closedReason: row.closed_reason ?? "",
      marketingOptIn: row.marketing_opt_in === 1,
      items: items.results,
      history: history.results,
    },
    serverTime: nowIso,
  });
}

async function serveProof(db: OrdersDb, bucket: ProofReader | undefined, ref: string): Promise<Response> {
  const row = await db.prepare(`SELECT proof_key FROM orders WHERE ref = ?`).bind(ref).first<{ proof_key: string | null }>();
  if (!row?.proof_key || !bucket) return notFound();
  const object = await bucket.get(row.proof_key);
  if (!object) return notFound();
  const stored = object.httpMetadata?.contentType ?? "";
  // Only the four types uploads can be; anything else goes out as an opaque download.
  const type = PROOF_TYPES.includes(stored) ? stored : "application/octet-stream";
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[type] ?? "bin";
  const inline = type.startsWith("image/");
  return new Response(object.body, {
    headers: {
      "content-type": type,
      "content-length": String(object.size),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="proof-${ref}.${ext}"`,
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      // If a browser is ever pointed straight at this URL, nothing in the file may run or load anything.
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    },
  });
}

const cleanText = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

async function moveOrder(
  env: EmailEnv,
  db: OrdersDb,
  ref: string,
  move: AdminMove,
  body: Record<string, unknown>,
  email: string,
  nowIso: string,
): Promise<Response> {
  const rule = ADMIN_MOVES[move];
  let reason = "";
  if (move === "paid" && body.confirmed !== true) {
    return json({ error: "Tick the box to confirm you have checked the bank account.", field: "confirmed" }, 400);
  }
  if (move === "reject") {
    reason = cleanText(body.reason, 300);
    if (reason.length < 3) return json({ error: "Give a short reason. The customer will see it.", field: "reason" }, 400);
  }
  if (move === "cancel") reason = cleanText(body.reason, 300) || "cancelled by AFP";

  const current = await db.prepare(`SELECT id, status FROM orders WHERE ref = ?`).bind(ref).first<{ id: number; status: OrderStatus }>();
  if (!current) return notFound();

  const from = rule.from.map((s) => `'${s}'`).join(",");
  const closing = move === "reject" || move === "cancel";
  const stamp = move === "paid" ? "paid_at" : "delivered_at";
  const set = closing ? `status = '${rule.to}', closed_at = ?, closed_reason = ?` : `status = '${rule.to}', ${stamp} = ?`;
  const setBinds: unknown[] = closing ? [nowIso, reason] : [nowIso];
  // A reservation whose time has passed is already over, whatever its row says.
  const live = move === "cancel" ? `AND NOT (status = 'reserved' AND expires_at <= ?)` : "";
  const liveBinds: unknown[] = move === "cancel" ? [nowIso] : [];

  const results = await db.batch([
    db.prepare(`UPDATE orders SET ${set} WHERE ref = ? AND status IN (${from}) ${live}`).bind(...setBinds, ref, ...liveBinds),
    // Written only if the statement just above changed the order (changes() = 1),
    // in the same transaction: no change, no log line; a change, exactly one.
    db
      .prepare(
        `INSERT INTO audit_log (at, actor, action, order_ref, detail)
         SELECT ?, ?, ?, ?, ? WHERE changes() = 1`,
      )
      .bind(nowIso, email, `order_${rule.to}`, ref, `${current.status} -> ${rule.to}${reason ? `: ${reason}` : ""}`),
  ]);

  if (results[0].meta.changes !== 1) {
    const latest = await db.prepare(`SELECT status FROM orders WHERE ref = ?`).bind(ref).first<{ status: OrderStatus }>();
    return json(
      { error: "This order has already moved on. The screen has been refreshed.", status: latest?.status ?? null },
      409,
    );
  }
  // Tell the customer what changed (when customer emails are on).
  const kind = customerKindFor(rule.to);
  const forEmail = kind ? await orderForEmail(db, ref).catch(() => null) : null;
  if (kind && forEmail) await notifyCustomer(env, kind, forEmail, new Date(nowIso));
  return orderDetail(db, ref, nowIso);
}

/** "I've rung this up at the till": the sale is in Loyverse, so stop holding the stock here. */
async function markRecorded(db: OrdersDb, ref: string, email: string, nowIso: string): Promise<Response> {
  const marker = `manual:${nowIso}`;
  const results = await db.batch([
    db
      .prepare(`UPDATE orders SET loyverse_receipt = ?1 WHERE ref = ?2 AND status IN ('paid','delivered') AND loyverse_receipt IS NULL`)
      .bind(marker, ref),
    db
      .prepare(
        `INSERT INTO audit_log (at, actor, action, order_ref, detail)
         SELECT ?, ?, 'order_recorded_in_loyverse', ?, 'rung up at the till; website hold released'
          WHERE changes() = 1`,
      )
      .bind(nowIso, email, ref),
  ]);
  if (results[0].meta.changes !== 1) {
    return json({ error: "This order is already recorded, or is not paid yet." }, 409);
  }
  return orderDetail(db, ref, nowIso);
}

async function readSettings(db: OrdersDb): Promise<Response> {
  const [bank, pickupLocations, meta] = await Promise.all([
    loadBankDetails(db),
    loadPickupLocations(db),
    db.prepare(`SELECT updated_at, updated_by FROM settings WHERE key = 'bank_details'`).first<{ updated_at: string; updated_by: string }>(),
  ]);
  return json({
    bank: bank
      ? {
          bank: bank.bank,
          accountName: bank.accountName,
          // The full number is never sent back. To change it, it is typed again.
          accountNumberMasked: maskAccountNumber(bank.accountNumber),
          branch: bank.branch,
          swift: bank.swift,
          updatedAt: meta?.updated_at ?? null,
          updatedBy: meta?.updated_by ?? null,
        }
      : null,
    pickupLocations,
  });
}

async function saveSetting(db: OrdersDb, key: string, value: string | null, email: string, nowIso: string, note: string) {
  await db.batch([
    value === null
      ? db.prepare(`DELETE FROM settings WHERE key = ?`).bind(key)
      : db
          .prepare(
            `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3, updated_by = ?4`,
          )
          .bind(key, value, nowIso, email),
    // What changed and who changed it. Never the values.
    db.prepare(`INSERT INTO audit_log (at, actor, action, order_ref, detail) VALUES (?, ?, ?, NULL, ?)`).bind(nowIso, email, "settings_changed", note),
  ]);
}

async function auditLog(db: OrdersDb): Promise<Response> {
  const rows = await db
    .prepare(`SELECT at, actor, action, order_ref AS orderRef, detail FROM audit_log ORDER BY id DESC LIMIT 200`)
    .all();
  return json({ entries: rows.results });
}

/**
 * Everything under /api/admin/. `path` is the part after that prefix.
 */
export async function handleAdmin(
  request: Request,
  env: AdminEnv,
  path: string,
  now: Date = new Date(),
  keyFetcher?: KeyFetcher,
): Promise<Response> {
  // --- The lock. Nothing below runs without a verified admin.
  const admin = await verifyAccess(request, env, now, keyFetcher);
  if (!admin) return refused();

  const db = env.ORDERS_DB;
  if (!db) return json({ error: "The orders database is not available right now." }, 503);

  const url = new URL(request.url);
  const nowIso = now.toISOString();
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const method = request.method;

  // --- Reads. A GET never changes anything.
  if (method === "GET") {
    if (path === "me") return json({ email: admin.email });
    if (path === "summary") return summary(db, env, now);
    if (path === "orders") return listOrders(db, url, nowIso);
    if (path === "settings") return readSettings(db);
    if (path === "audit") return auditLog(db);
    if (parts[0] === "orders" && REF.test(parts[1] ?? "")) {
      if (parts.length === 2) return orderDetail(db, parts[1], nowIso);
      if (parts.length === 3 && parts[2] === "proof") return serveProof(db, env.PROOFS, parts[1]);
    }
    return notFound();
  }
  if (method !== "POST") return new Response("Method not allowed", { status: 405 });

  // --- Changes. Must come from this site's own pages, as JSON, with the admin header.
  const origin = request.headers.get("origin");
  let sameSite = false;
  try {
    sameSite = Boolean(origin) && new URL(origin!).host === url.host;
  } catch {
    sameSite = false;
  }
  if (!sameSite || request.headers.get("x-afp-admin") !== "1") {
    return json({ error: "That request can't be accepted." }, 403);
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return json({ error: "We couldn't read that request." }, 415);
  }
  const text = await request.text();
  if (text.length > ADMIN_LIMITS.maxBodyBytes) return json({ error: "That request is too large." }, 413);
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text || "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "We couldn't read that request." }, 400);
  }

  // Rate limit changes per admin.
  const who = await sha256Hex(`afp-admin|${admin.email}`);
  const recent = await db
    .prepare(`SELECT COUNT(*) AS n FROM rate_events WHERE client_hash = ? AND kind = 'admin' AND at > ?`)
    .bind(who, new Date(now.getTime() - 60_000).toISOString())
    .first<{ n: number }>();
  if (Number(recent?.n ?? 0) >= ADMIN_LIMITS.writesPerMinute) {
    return json({ error: "That's a lot of changes at once. Please wait a minute." }, 429, { "retry-after": "60" });
  }
  await db.prepare(`INSERT INTO rate_events (client_hash, kind, order_ref, at) VALUES (?, 'admin', NULL, ?)`).bind(who, nowIso).run();

  if (parts[0] === "orders" && REF.test(parts[1] ?? "") && parts.length === 3) {
    const action = parts[2];
    if (action === "recorded") return markRecorded(db, parts[1], admin.email, nowIso);
    if (Object.prototype.hasOwnProperty.call(ADMIN_MOVES, action)) {
      return moveOrder(env, db, parts[1], action as AdminMove, body, admin.email, nowIso);
    }
    return notFound();
  }

  if (path === "settings/bank") {
    const parsed = parseBankInput(body);
    if (!parsed.ok) return json({ error: parsed.error, field: parsed.field }, 400);
    await saveSetting(db, "bank_details", JSON.stringify(parsed.value), admin.email, nowIso, "bank details updated");
    return readSettings(db);
  }
  if (path === "settings/bank/clear") {
    await saveSetting(db, "bank_details", null, admin.email, nowIso, "bank details removed; bank transfer hidden at checkout");
    return readSettings(db);
  }
  if (path === "settings/pickup") {
    const parsed = parsePickupInput(body);
    if (!parsed.ok) return json({ error: parsed.error, field: parsed.field }, 400);
    await saveSetting(db, "pickup_locations", JSON.stringify(parsed.value), admin.email, nowIso, `pickup locations updated (${parsed.value.length})`);
    return readSettings(db);
  }
  return notFound();
}
