/**
 * What a customer can do to their own order after reserving it.  (Phase 2.)
 *
 *   POST /api/orders/:ref/proof    send proof of payment (image or PDF)
 *   POST /api/orders/:ref/cancel   give the items back before paying
 *
 * Both need the order's reference AND its private token.
 *
 * Safety properties this file is responsible for:
 *  - A proof is EVIDENCE for the owner to check. Receiving one never marks an
 *    order paid; it only moves it to "proof uploaded".
 *  - The file type is decided from the file's first bytes. Its name and the
 *    type the browser claims are ignored, and the name is not kept.
 *  - The size limit is enforced while reading, so an oversized upload is
 *    dropped part-way rather than held in memory.
 *  - Files go into a private bucket under a random name. Nothing in this file
 *    (or anywhere customer-facing) serves them back.
 *  - The status change re-checks the order in the same statement, so a late
 *    upload cannot revive an expired or cancelled order.
 *  - Uploads are rate-limited per order and per visitor.
 *  - Every outcome is written to the audit log.
 */
import {
  PROOF_LIMITS,
  isPaymentMethod,
  sniffProof,
  type OrderStatus,
} from "../src/lib/orders-core";
import { notifyCustomer, notifyOwnersOfProof, orderForEmail } from "./email";
import {
  authoriseOrder,
  clientHashOf,
  json,
  loadBankDetails,
  orderNotFound,
  publicOrder,
  sameOrigin,
  type OrderRow,
  type OrdersDb,
  type OrdersEnv,
} from "./orders";

/** The slice of the R2 API this file uses. */
export interface ProofBucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export interface ActionsEnv extends OrdersEnv {
  PROOFS?: ProofBucket;
}

/** Room for the multipart wrapping around the file itself. */
const BODY_OVERHEAD_BYTES = 16 * 1024;

const audit = (db: OrdersDb, at: string, action: string, ref: string, detail: string) =>
  db
    .prepare(`INSERT INTO audit_log (at, actor, action, order_ref, detail) VALUES (?, 'customer', ?, ?, ?)`)
    .bind(at, action, ref, detail)
    .run();

/** Read a request body, giving up as soon as it passes `max` bytes. */
async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function randomKey(ext: string): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `proofs/${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}.${ext}`;
}

const isLive = (row: OrderRow, nowIso: string): OrderStatus =>
  row.status === "reserved" && row.expires_at <= nowIso ? "expired" : row.status;

/** POST /api/orders/:ref/proof  (multipart: file, method) */
export async function uploadProof(
  request: Request,
  env: ActionsEnv,
  ref: string,
  now: Date = new Date(),
): Promise<Response> {
  const db = env.ORDERS_DB;
  const bucket = env.PROOFS;
  if (!db || !bucket) {
    return json({ error: "Uploads are not available right now. Please try again in a few minutes." }, 503);
  }
  if (!sameOrigin(request)) return json({ error: "That request can't be accepted." }, 403);

  const row = await authoriseOrder(request, db, ref);
  if (!row) return orderNotFound();

  const nowIso = now.toISOString();
  const refuse = async (status: number, error: string, reason: string, extra: Record<string, string> = {}) => {
    await audit(db, nowIso, "proof_refused", ref, reason).catch(() => undefined);
    return json({ error, reason }, status, extra);
  };

  // --- Is this order still waiting for a proof?
  const status = isLive(row, nowIso);
  if (status === "expired") {
    return refuse(
      410,
      "This order's 60 minutes ran out, so the items were released. If you have already paid, message us on WhatsApp with your order reference.",
      "expired",
    );
  }
  if (status !== "reserved" && status !== "proof_uploaded") {
    return refuse(409, "This order is no longer waiting for proof of payment.", `status_${status}`);
  }
  if (Number(row.proof_uploads ?? 0) >= PROOF_LIMITS.maxUploadsPerOrder) {
    return refuse(
      409,
      "You've already replaced this proof as many times as we allow. Message us on WhatsApp if it needs changing.",
      "replacement_limit",
    );
  }

  // --- Rate limits: per order (ever) and per visitor (recently)
  const clientHash = await clientHashOf(request);
  const windowStart = new Date(now.getTime() - PROOF_LIMITS.windowMinutes * 60_000).toISOString();
  const [perOrder, perVisitor] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM rate_events WHERE order_ref = ? AND kind = 'proof'`).bind(ref).first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM rate_events WHERE client_hash = ? AND kind = 'proof' AND at > ?`)
      .bind(clientHash, windowStart)
      .first<{ n: number }>(),
  ]);
  if (
    Number(perOrder?.n ?? 0) >= PROOF_LIMITS.maxAttemptsPerOrder ||
    Number(perVisitor?.n ?? 0) >= PROOF_LIMITS.maxAttemptsPerWindow
  ) {
    return refuse(429, "Too many upload attempts. Please wait a few minutes and try again.", "rate_limited", {
      "retry-after": String(PROOF_LIMITS.windowMinutes * 60),
    });
  }
  await db
    .prepare(`INSERT INTO rate_events (client_hash, kind, order_ref, at) VALUES (?, 'proof', ?, ?)`)
    .bind(clientHash, ref, nowIso)
    .run();

  // --- Read the upload, refusing anything too large before and while reading
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return refuse(415, "We couldn't read that upload.", "not_multipart");
  }
  const tooBig = () =>
    refuse(413, "That file is larger than 8 MB. Please send a smaller photo, screenshot or PDF.", "too_large");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > PROOF_LIMITS.maxBytes + BODY_OVERHEAD_BYTES) return tooBig();
  const body = await readCapped(request, PROOF_LIMITS.maxBytes + BODY_OVERHEAD_BYTES);
  if (!body) return tooBig();

  let form: FormData;
  try {
    form = await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch {
    return refuse(400, "We couldn't read that upload.", "bad_form");
  }

  const method = form.get("method");
  if (!isPaymentMethod(method)) return refuse(400, "Choose how you paid.", "bad_method");
  if (method === "bank_transfer" && !(await loadBankDetails(db))) {
    return refuse(400, "Bank transfer isn't available yet. Please pay with the CIBC 1st Pay code.", "bank_unavailable");
  }

  const file = form.get("file");
  if (!file || typeof file === "string") return refuse(400, "Choose a file to upload.", "no_file");
  const bytes = new Uint8Array(await (file as Blob).arrayBuffer());
  if (bytes.byteLength === 0) return refuse(400, "That file is empty. Please choose another.", "empty");
  if (bytes.byteLength > PROOF_LIMITS.maxBytes) return tooBig();

  const type = sniffProof(bytes);
  if (!type) {
    return refuse(
      415,
      "That file isn't a photo, screenshot or PDF we can accept. Please send a JPG, PNG, WebP or PDF.",
      "bad_type",
    );
  }

  // --- Store, then claim the order. The claim re-checks the order's state.
  // A fingerprint of the file, so the same file sent for another order can be pointed out.
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const proofHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = randomKey(type.ext);
  await bucket.put(key, bytes, { httpMetadata: { contentType: type.contentType } });

  const claimed = await db
    .prepare(
      `UPDATE orders
          SET status = 'proof_uploaded', payment_method = ?, proof_key = ?, proof_uploaded_at = ?,
              proof_hash = ?, proof_uploads = proof_uploads + 1
        WHERE id = ?
          AND proof_uploads < ?
          AND ((status = 'reserved' AND expires_at > ?) OR status = 'proof_uploaded')`,
    )
    .bind(method, key, nowIso, proofHash, row.id, PROOF_LIMITS.maxUploadsPerOrder, nowIso)
    .run();

  if (claimed.meta.changes !== 1) {
    await bucket.delete(key).catch(() => undefined);
    return refuse(409, "This order changed while you were uploading. Please refresh and try again.", "lost_race");
  }

  // One live proof per order: the one it replaces is removed.
  if (row.proof_key && row.proof_key !== key) await bucket.delete(row.proof_key).catch(() => undefined);

  const replaced = Boolean(row.proof_key);
  await audit(
    db,
    nowIso,
    replaced ? "proof_replaced" : "proof_uploaded",
    ref,
    `${type.contentType}, ${bytes.byteLength} bytes, ${method}`,
  );

  // Tell the owners there is a proof to check, and the customer that we have it.
  const forEmail = await orderForEmail(db, ref).catch(() => null);
  if (forEmail) {
    await notifyOwnersOfProof(env, forEmail, replaced, now);
    await notifyCustomer(env, "proof_received", forEmail, now);
  }

  const fresh = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(row.id).first<OrderRow>();
  return json({ order: await publicOrder(db, fresh!, "proof_uploaded"), serverTime: nowIso });
}

/** POST /api/orders/:ref/cancel */
export async function cancelOrder(
  request: Request,
  env: ActionsEnv,
  ref: string,
  now: Date = new Date(),
): Promise<Response> {
  const db = env.ORDERS_DB;
  if (!db) return json({ error: "Orders are not available right now." }, 503);
  if (!sameOrigin(request)) return json({ error: "That request can't be accepted." }, 403);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return json({ error: "We couldn't read that request." }, 415);
  }

  const row = await authoriseOrder(request, db, ref);
  if (!row) return orderNotFound();

  const nowIso = now.toISOString();
  const done = await db
    .prepare(
      `UPDATE orders SET status = 'cancelled', closed_at = ?, closed_reason = 'cancelled by customer'
        WHERE id = ? AND status = 'reserved'`,
    )
    .bind(nowIso, row.id)
    .run();

  if (done.meta.changes !== 1) {
    const status = isLive(row, nowIso);
    return json(
      {
        error:
          status === "proof_uploaded"
            ? "We already have your proof of payment, so this order can't be cancelled here. Message us on WhatsApp."
            : "This order can no longer be cancelled.",
      },
      409,
    );
  }

  await audit(db, nowIso, "order_cancelled", ref, "cancelled by customer; stock released");
  const fresh = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(row.id).first<OrderRow>();
  return json({ order: await publicOrder(db, fresh!, "cancelled"), serverTime: nowIso });
}
