/**
 * Email notifications.  (Phase 4.)
 *
 * Owners are told when a proof of payment arrives, and get a morning summary
 * of anything still waiting. Customers are told when their order's status
 * changes, when customer emails are switched on (CUSTOMER_EMAILS = "on";
 * sending to customers needs Cloudflare's Workers Paid plan).
 *
 * How it stays reliable:
 *  - Every email is first written to the `outbox` table, then sent from it.
 *    A send that fails is retried by the 5-minute cron, up to MAX_ATTEMPTS.
 *  - Each event has a dedupe key, so queueing it twice sends one email.
 *  - Queueing and sending never throw into the caller: an email problem must
 *    never stop an order being reserved, a proof being saved or an order
 *    being marked paid.
 *
 * What an email may contain:
 *  - Owner emails: customer name, amount, order reference, a link to the
 *    portal (which still needs sign-in). Never the proof itself.
 *  - Customer emails: their own order. Only the first one (items reserved)
 *    carries their private order link, because only then is the token known;
 *    it is cleared from the outbox as soon as the email is sent.
 *  - Never bank details. Everything a customer typed is escaped.
 *  - No marketing. These are order emails only.
 */
import { formatBbd } from "../src/lib/catalog-core";
import { ADMIN_EMAILS, barbadosDate, type OrderStatus } from "../src/lib/orders-core";
import type { OrdersDb } from "./orders";

/** The slice of Cloudflare's Email Sending binding this file uses. */
export interface EmailSender {
  send(message: {
    from: { email: string; name: string };
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
  }): Promise<unknown>;
}

export interface EmailEnv {
  ORDERS_DB?: OrdersDb;
  /** Absent until Email Sending is set up: emails then wait in the outbox. */
  EMAIL?: EmailSender;
  /** e.g. "orders@alofitnesspro.com". Must be on a domain set up for sending. */
  EMAIL_FROM?: string;
  /** "on" to email customers. Anything else: owner emails only. */
  CUSTOMER_EMAILS?: string;
}

export const SITE_ORIGIN = "https://alofitnesspro.com";
const FROM_NAME = "Alo Fitness Pro";
const REPLY_TO = ADMIN_EMAILS[0];
const MAX_ATTEMPTS = 5;
const BATCH = 20;
/** An email nobody could send for this long is given up on. */
const GIVE_UP_HOURS = 72;

export const customerEmailsOn = (env: EmailEnv): boolean => (env.CUSTOMER_EMAILS ?? "").trim().toLowerCase() === "on";

const esc = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A header cannot contain a line break; a subject is one line. */
const oneLine = (text: string): string => text.replace(/[\r\n]+/g, " ").trim().slice(0, 140);

interface Draft {
  subject: string;
  /** Plain paragraphs. Escaped for the HTML version here, never by callers. */
  lines: string[];
  button?: { label: string; url: string };
  footer?: string;
}

/** One plain, calm layout for every email. No images, no tracking. */
export function render(draft: Draft): { subject: string; text: string; html: string } {
  const text = [
    ...draft.lines,
    ...(draft.button ? [`${draft.button.label}: ${draft.button.url}`] : []),
    ...(draft.footer ? ["", draft.footer] : []),
    "",
    "Alo Fitness Pro",
  ].join("\n\n");
  const paragraphs = draft.lines
    .map((l) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1a1a1a;">${esc(l)}</p>`)
    .join("");
  const button = draft.button
    ? `<p style="margin:8px 0 24px;"><a href="${esc(draft.button.url)}" style="display:inline-block;background:#111111;color:#f5f3ee;text-decoration:none;padding:14px 24px;font-size:14px;letter-spacing:1px;text-transform:uppercase;">${esc(draft.button.label)}</a></p>`
    : "";
  const footer = draft.footer
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#4a4a4a;">${esc(draft.footer)}</p>`
    : "";
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="max-width:520px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">` +
    `<p style="margin:0 0 24px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#4a4a4a;">Alo Fitness Pro</p>` +
    paragraphs +
    button +
    footer +
    `</div></body></html>`;
  return { subject: oneLine(draft.subject), text, html };
}

export interface OrderForEmail {
  ref: string;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  fulfillment: "delivery" | "pickup";
  paymentMethod?: string | null;
  reason?: string;
}

const firstName = (name: string): string => name.trim().split(/\s+/)[0] || "there";
const METHOD: Record<string, string> = { cibc_qr: "CIBC 1st Pay", bank_transfer: "bank transfer" };

/** What each customer email says. `link` exists only for the first one. */
export function customerDraft(kind: CustomerKind, o: OrderForEmail, link?: string): Draft {
  const hi = `Hi ${firstName(o.customerName)},`;
  const total = formatBbd(o.totalCents);
  const help = "Questions? Just reply to this email.";
  switch (kind) {
    case "reserved":
      return {
        subject: `Your items are held for 60 minutes (${o.ref})`,
        lines: [
          hi,
          `We're holding your items for 60 minutes. To complete your order, pay ${total} from your banking app with the reference ${o.ref}, then upload a screenshot of the payment.`,
          "Use the button below to return to your order at any time, on any device.",
        ],
        button: link ? { label: "Open my order", url: link } : undefined,
        footer: `Keep this link to yourself: anyone with it can see this order. ${help}`,
      };
    case "proof_received":
      return {
        subject: `We've received your proof of payment (${o.ref})`,
        lines: [hi, `Thank you. We have your proof for order ${o.ref} and are checking it against our bank record. Your items stay held while we do.`, "We'll email you as soon as it's confirmed."],
        footer: help,
      };
    case "paid":
      return {
        subject: `Payment confirmed (${o.ref})`,
        lines: [
          hi,
          `We've confirmed your payment of ${total} for order ${o.ref}. Thank you.`,
          o.fulfillment === "pickup" ? "We'll message you to arrange pickup." : "We'll message you to arrange delivery.",
        ],
        footer: help,
      };
    case "rejected":
      return {
        subject: `We couldn't confirm your payment (${o.ref})`,
        lines: [
          hi,
          `We checked and could not match a payment to order ${o.ref}, so the items have gone back on sale.`,
          ...(o.reason ? [`Note from AFP: ${o.reason}`] : []),
          "If you believe this is a mistake, reply to this email with your bank's confirmation and we'll look again.",
        ],
      };
    case "delivered":
      return {
        subject: `Your order is complete (${o.ref})`,
        lines: [hi, o.fulfillment === "pickup" ? `Order ${o.ref} has been collected. Thank you for shopping with us.` : `Order ${o.ref} has been delivered. Thank you for shopping with us.`],
        footer: help,
      };
    case "expired":
      return {
        subject: `Your order ran out of time (${o.ref})`,
        lines: [hi, `The 60 minutes for order ${o.ref} passed without proof of payment, so the items have gone back on sale. Nothing was charged by our site.`, "If you have already paid, reply to this email with your bank's confirmation and we'll sort it out."],
      };
    case "cancelled":
      return {
        subject: `Your order was cancelled (${o.ref})`,
        lines: [hi, `Order ${o.ref} has been cancelled and the items are back on sale.`, "If you have already paid, reply to this email with your bank's confirmation and we'll sort it out."],
      };
  }
}
export type CustomerKind = "reserved" | "proof_received" | "paid" | "rejected" | "delivered" | "expired" | "cancelled";

const STATUS_KIND: Partial<Record<OrderStatus, CustomerKind>> = {
  paid: "paid",
  rejected: "rejected",
  delivered: "delivered",
  expired: "expired",
  cancelled: "cancelled",
};
export const customerKindFor = (status: OrderStatus): CustomerKind | undefined => STATUS_KIND[status];

async function queue(
  db: OrdersDb,
  row: { dedupeKey: string; audience: "owner" | "customer"; kind: string; recipient: string; orderRef: string | null; draft: Draft },
  nowIso: string,
): Promise<void> {
  const { subject, text, html } = render(row.draft);
  await db
    .prepare(
      `INSERT OR IGNORE INTO outbox (dedupe_key, audience, kind, recipient, order_ref, subject, body_text, body_html, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.dedupeKey, row.audience, row.kind, row.recipient, row.orderRef, subject, text, html, nowIso)
    .run();
}

/** Tell both owners a proof has arrived (or been replaced). Never throws. */
export async function notifyOwnersOfProof(env: EmailEnv, o: OrderForEmail, replaced: boolean, now: Date): Promise<void> {
  const db = env.ORDERS_DB;
  if (!db) return;
  try {
    const nowIso = now.toISOString();
    const draft: Draft = {
      subject: `${replaced ? "Replaced proof" : "New proof"} to check: ${o.customerName}, ${formatBbd(o.totalCents)}`,
      lines: [
        `${o.customerName} has ${replaced ? "replaced their" : "sent"} proof of payment.`,
        `Amount to find: ${formatBbd(o.totalCents)}`,
        `Reference to find: ${o.ref}`,
        `Paid by: ${METHOD[o.paymentMethod ?? ""] ?? "not stated"}`,
        "Check your bank account before marking it paid. The items stay held until you decide.",
      ],
      button: { label: "Check this order", url: `${SITE_ORIGIN}/admin/orders/${o.ref}` },
    };
    for (const recipient of ADMIN_EMAILS) {
      await queue(db, { dedupeKey: `proof:${o.ref}:${nowIso}:${recipient}`, audience: "owner", kind: replaced ? "proof_replaced" : "proof_uploaded", recipient, orderRef: o.ref, draft }, nowIso);
    }
  } catch (err) {
    console.error("email queue failed (owner proof):", err instanceof Error ? err.message : "unknown");
  }
}

/** Tell a customer about their order, if customer emails are on. Never throws. */
export async function notifyCustomer(env: EmailEnv, kind: CustomerKind, o: OrderForEmail, now: Date, link?: string): Promise<void> {
  const db = env.ORDERS_DB;
  if (!db || !customerEmailsOn(env) || !o.customerEmail) return;
  try {
    const nowIso = now.toISOString();
    // proof_received can happen up to three times per order; the rest happen once.
    const dedupeKey = kind === "proof_received" ? `customer:${o.ref}:${kind}:${nowIso}` : `customer:${o.ref}:${kind}`;
    await queue(db, { dedupeKey, audience: "customer", kind, recipient: o.customerEmail, orderRef: o.ref, draft: customerDraft(kind, o, link) }, nowIso);
  } catch (err) {
    console.error("email queue failed (customer):", err instanceof Error ? err.message : "unknown");
  }
}

/** Load what an email needs to know about an order. */
export async function orderForEmail(db: OrdersDb, ref: string): Promise<OrderForEmail | null> {
  const row = await db
    .prepare(`SELECT ref, customer_name, customer_email, total_cents, fulfillment, payment_method, closed_reason, status FROM orders WHERE ref = ?`)
    .bind(ref)
    .first<{ ref: string; customer_name: string; customer_email: string | null; total_cents: number; fulfillment: "delivery" | "pickup"; payment_method: string | null; closed_reason: string | null; status: OrderStatus }>();
  if (!row) return null;
  return {
    ref: row.ref,
    customerName: row.customer_name,
    customerEmail: row.customer_email ?? "",
    totalCents: row.total_cents,
    fulfillment: row.fulfillment,
    paymentMethod: row.payment_method,
    reason: row.status === "rejected" ? (row.closed_reason ?? undefined) : undefined,
  };
}

/**
 * The morning summary: one email to both owners, between 8 and 9 am in
 * Barbados, only when something is waiting. It is the second route: if an
 * instant alert was missed or never arrived, this still reaches her.
 */
export async function queueMorningSummary(env: EmailEnv, now: Date): Promise<boolean> {
  const db = env.ORDERS_DB;
  if (!db) return false;
  try {
    const local = barbadosDate(now);
    if (local.getUTCHours() !== 8) return false;
    const day = local.toISOString().slice(0, 10);
    const counts = await db
      .prepare(
        `SELECT SUM(CASE WHEN status = 'proof_uploaded' THEN 1 ELSE 0 END) AS proofs,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS deliver,
                SUM(CASE WHEN status IN ('paid','delivered') AND loyverse_receipt IS NULL THEN 1 ELSE 0 END) AS ring
           FROM orders`,
      )
      .first<{ proofs: number | null; deliver: number | null; ring: number | null }>();
    const proofs = Number(counts?.proofs ?? 0);
    const deliver = Number(counts?.deliver ?? 0);
    const ring = Number(counts?.ring ?? 0);
    if (proofs + deliver + ring === 0) return false;
    const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
    const draft: Draft = {
      subject: `AFP this morning: ${[proofs ? n(proofs, "proof to check", "proofs to check") : "", deliver ? `${deliver} to deliver` : "", ring ? `${ring} to ring up` : ""].filter(Boolean).join(", ")}`,
      lines: [
        "Good morning. Here is what is waiting in your portal:",
        ...(proofs ? [`${n(proofs, "proof of payment", "proofs of payment")} to check. Those items are held until you decide.`] : []),
        ...(deliver ? [`${n(deliver, "paid order", "paid orders")} to deliver or hand over.`] : []),
        ...(ring ? [`${n(ring, "paid order", "paid orders")} to ring up in Loyverse.`] : []),
      ],
      button: { label: "Open the portal", url: `${SITE_ORIGIN}/admin` },
      footer: "You get this email only on mornings when something is waiting.",
    };
    const nowIso = now.toISOString();
    for (const recipient of ADMIN_EMAILS) {
      await queue(db, { dedupeKey: `summary:${day}:${recipient}`, audience: "owner", kind: "morning_summary", recipient, orderRef: null, draft }, nowIso);
    }
    return true;
  } catch (err) {
    console.error("email queue failed (summary):", err instanceof Error ? err.message : "unknown");
    return false;
  }
}

/**
 * Send what is waiting in the outbox. Called after an order changes and by
 * the cron. Never throws. Returns how many were sent.
 */
export async function flushOutbox(env: EmailEnv, now: Date = new Date()): Promise<number> {
  const db = env.ORDERS_DB;
  if (!db) return 0;
  try {
    const nowIso = now.toISOString();
    // Give up on anything nobody has been able to send for three days.
    await db
      .prepare(`UPDATE outbox SET status = 'failed', body_text = '', body_html = '', last_error = COALESCE(last_error, 'not sent in time') WHERE status = 'pending' AND created_at < ?`)
      .bind(new Date(now.getTime() - GIVE_UP_HOURS * 3600_000).toISOString())
      .run();

    const sender = env.EMAIL;
    const from = (env.EMAIL_FROM ?? "").trim();
    if (!sender || !from) return 0; // not set up yet: emails wait

    const due = await db
      .prepare(`SELECT id, audience, recipient, subject, body_text, body_html FROM outbox WHERE status = 'pending' AND attempts < ? ORDER BY id LIMIT ?`)
      .bind(MAX_ATTEMPTS, BATCH)
      .all<{ id: number; audience: string; recipient: string; subject: string; body_text: string; body_html: string }>();

    let sent = 0;
    for (const mail of due.results) {
      // Claim it first, so two runs at once cannot both send it.
      const claimed = await db.prepare(`UPDATE outbox SET attempts = attempts + 1 WHERE id = ? AND status = 'pending' AND attempts < ?`).bind(mail.id, MAX_ATTEMPTS).run();
      if (claimed.meta.changes !== 1) continue;
      try {
        await sender.send({ from: { email: from, name: FROM_NAME }, to: mail.recipient, subject: mail.subject, text: mail.body_text, html: mail.body_html, replyTo: REPLY_TO });
        // Sent: the body (which may hold a customer's private order link) is no longer kept.
        await db.prepare(`UPDATE outbox SET status = 'sent', sent_at = ?, body_text = '', body_html = '', last_error = NULL WHERE id = ?`).bind(nowIso, mail.id).run();
        sent += 1;
      } catch (err) {
        // The reason only. Never the recipient or the content.
        const reason = (err instanceof Error ? err.message : "send failed").slice(0, 200);
        await db
          .prepare(
            `UPDATE outbox SET last_error = ?,
                    status = CASE WHEN attempts >= ? THEN 'failed' ELSE status END,
                    body_text = CASE WHEN attempts >= ? THEN '' ELSE body_text END,
                    body_html = CASE WHEN attempts >= ? THEN '' ELSE body_html END
              WHERE id = ?`,
          )
          .bind(reason, MAX_ATTEMPTS, MAX_ATTEMPTS, MAX_ATTEMPTS, mail.id)
          .run();
        console.error(`email send failed (${mail.audience}, attempt recorded):`, reason);
      }
    }
    return sent;
  } catch (err) {
    console.error("email flush failed:", err instanceof Error ? err.message : "unknown");
    return 0;
  }
}

/**
 * How owner alerts are doing, for one quiet line on the portal's home screen:
 *  "off"     email is not set up, so she must look for proofs herself
 *  "trouble" an alert in the last day could not be sent
 *  "ok"      nothing to say
 */
export async function ownerEmailHealth(env: EmailEnv, now: Date): Promise<"off" | "trouble" | "ok"> {
  if (!env.EMAIL || !(env.EMAIL_FROM ?? "").trim()) return "off";
  const db = env.ORDERS_DB;
  if (!db) return "ok";
  try {
    const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
    const stale = new Date(now.getTime() - 30 * 60_000).toISOString();
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM outbox
          WHERE audience = 'owner' AND created_at > ?1
            AND (status = 'failed' OR (status = 'pending' AND created_at < ?2))`,
      )
      .bind(since, stale)
      .first<{ n: number }>();
    return Number(row?.n ?? 0) > 0 ? "trouble" : "ok";
  } catch {
    return "ok";
  }
}
