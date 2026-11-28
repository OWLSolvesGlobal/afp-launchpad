// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import type { CatalogProduct, CatalogSnapshot } from "@/lib/catalog-core";
import { ADMIN_EMAILS } from "@/lib/orders-core";
import { createOrder, expireOrders, type OrdersDb } from "../../worker/orders";
import { cancelOrder, uploadProof } from "../../worker/order-actions";
import {
  customerDraft,
  flushOutbox,
  notifyCustomer,
  ownerEmailHealth,
  queueMorningSummary,
  render,
  type EmailSender,
} from "../../worker/email";
import worker from "../../worker/index";
import { makeBucket, makeDb } from "../test/orders-db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON in tests
type Json = Record<string, any>;

const ORIGIN = "https://alofitnesspro.com";
const NOW = new Date("2026-11-28T15:00:00.000Z"); // 11 am in Barbados
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const JPEG = (() => {
  const b = new Uint8Array(64);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
})();
const product: CatalogProduct = {
  sku: "LV-romper", slug: "r", name: "Babydoll Romper BLACK", description: "", gender: "women", category: "Rompers", colors: [],
  priceCents: 13000, compareAtCents: null, sizes: ["S"], stock: { S: 9 }, image: "", imageAlt: "", badge: null, active: true,
};
const SNAPSHOT: CatalogSnapshot = {
  generatedAt: "2026-11-28T00:00:00.000Z", products: [product], categories: ["Rompers"],
  config: { announcementBar: "", featuredSkus: [], heroOrder: [], paymentsCardEnabled: false, paymentsTransferEnabled: true, transferInstructions: "" },
};

let db: OrdersDb;
let raw: DatabaseSync;
let store: ReturnType<typeof makeBucket>;
let sent: Json[];
let failing = false;
const sender: EmailSender = {
  send: async (message) => {
    if (failing) throw new Error("mail service unavailable");
    sent.push(message);
  },
};
const env = (extra: Json = {}) => ({ ORDERS_DB: db, PROOFS: store.bucket, EMAIL: sender, EMAIL_FROM: "orders@alofitnesspro.com", ...extra });
const outbox = () => raw.prepare("SELECT * FROM outbox ORDER BY id").all() as Json[];

beforeEach(() => {
  ({ db, raw } = makeDb());
  store = makeBucket();
  sent = [];
  failing = false;
});

let n = 0;
async function reserve(e: Json = env(), name = "Test Customer") {
  n += 1;
  const res = await createOrder(
    new Request(`${ORIGIN}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": `203.0.113.${n % 250}` },
      body: JSON.stringify({
        items: [{ sku: "LV-romper", size: "S", quantity: 1 }],
        fulfillment: "delivery",
        customer: { name, phone: "2465550100", email: "customer@example.com", address: "12 Test Road, St Michael" },
      }),
    }),
    e,
    SNAPSHOT,
    NOW,
  );
  const data = (await res.json()) as Json;
  return { ref: data.order.ref as string, token: data.token as string };
}
async function sendProof(ref: string, token: string, e: Json = env(), now = NOW) {
  const form = new FormData();
  form.set("method", "cibc_qr");
  form.set("file", new File([JPEG], "p.jpg"));
  return uploadProof(new Request(`${ORIGIN}/api/orders/${ref}/proof`, { method: "POST", headers: { "x-order-token": token }, body: form }), e, ref, now);
}

describe("owners are told when a proof arrives", () => {
  it("queues one email to each owner and sends it, with what to look for and a portal link", async () => {
    const { ref, token } = await reserve();
    expect(outbox()).toHaveLength(0); // reserving alone tells the owners nothing
    await sendProof(ref, token);
    expect(await flushOutbox(env(), NOW)).toBe(2);

    expect(sent.map((m) => m.to).sort()).toEqual([...ADMIN_EMAILS].sort());
    const mail = sent[0];
    expect(mail.subject).toBe("New proof to check: Test Customer, BDS $145.00");
    expect(mail.from).toEqual({ email: "orders@alofitnesspro.com", name: "Alo Fitness Pro" });
    expect(mail.text).toContain("Amount to find: BDS $145.00");
    expect(mail.text).toContain(`Reference to find: ${ref}`);
    expect(mail.text).toContain(`${ORIGIN}/admin/orders/${ref}`);
    expect(mail.html).toContain(`href="${ORIGIN}/admin/orders/${ref}"`);
    // Never the proof, its storage key, the customer's private link or their token.
    for (const secret of ["proofs/", token, "/order/"]) {
      expect(mail.text + mail.html).not.toContain(secret);
    }
    // Sent once: a second run sends nothing more.
    expect(await flushOutbox(env(), NOW)).toBe(0);
    expect(outbox().every((r) => r.status === "sent" && r.body_text === "" && r.body_html === "")).toBe(true);
  });

  it("tells them again when the customer replaces the proof", async () => {
    const { ref, token } = await reserve();
    await sendProof(ref, token);
    await sendProof(ref, token, env(), later(5));
    await flushOutbox(env(), later(5));
    expect(sent.map((m) => m.subject.split(":")[0])).toEqual(["New proof to check", "New proof to check", "Replaced proof to check", "Replaced proof to check"]);
  });

  it("is sent straight after the upload through the real Worker entry", async () => {
    const { ref, token } = await reserve();
    const form = new FormData();
    form.set("method", "cibc_qr");
    form.set("file", new File([JPEG], "p.jpg"));
    const waits: Promise<unknown>[] = [];
    const res = await worker.fetch(
      new Request(`${ORIGIN}/api/orders/${ref}/proof`, { method: "POST", headers: { "x-order-token": token }, body: form }),
      { ...env(), ASSETS: { fetch: async () => new Response("") } } as never,
      { waitUntil: (p: Promise<unknown>) => void waits.push(p) } as never,
    );
    expect(res.status).toBe(200);
    await Promise.all(waits);
    expect(sent).toHaveLength(2);
  });

  it("shows customer-typed text as text, and keeps the subject to one line", async () => {
    const { ref, token } = await reserve(env(), "Eve <script>alert(1)</script>");
    await sendProof(ref, token);
    await flushOutbox(env(), NOW);
    expect(sent[0].html).toContain("Eve &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(sent[0].html).not.toContain("<script>");
    expect(render({ subject: "Line one\r\nBcc: someone@example.com", lines: [] }).subject).toBe("Line one Bcc: someone@example.com");
  });
});

describe("an email problem never gets in the way of an order", () => {
  it("the proof is saved and the order moves on even when the mail service is down", async () => {
    failing = true;
    const logs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { ref, token } = await reserve();
      const res = await sendProof(ref, token);
      expect(res.status).toBe(200);
      expect(await flushOutbox(env(), NOW)).toBe(0);
      expect(outbox().map((r) => [r.status, r.attempts])).toEqual([["pending", 1], ["pending", 1]]);
      // The log says why, never who or what.
      const logged = logs.mock.calls.flat().join(" ");
      expect(logged).toContain("mail service unavailable");
      for (const hidden of ["alofitnesspro@outlook.com", "Test Customer", "BDS $145.00"]) expect(logged).not.toContain(hidden);

      // It recovers: the next run delivers.
      failing = false;
      expect(await flushOutbox(env(), later(5))).toBe(2);
    } finally {
      logs.mockRestore();
    }
  });

  it("gives up after five tries and clears the content", async () => {
    failing = true;
    const logs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { ref, token } = await reserve();
      await sendProof(ref, token);
      for (let i = 0; i < 7; i += 1) await flushOutbox(env(), later(i * 5));
      expect(outbox().map((r) => [r.status, r.attempts, r.body_text])).toEqual([["failed", 5, ""], ["failed", 5, ""]]);
    } finally {
      logs.mockRestore();
    }
  });

  it("waits quietly when email is not set up, and still works when the database is missing", async () => {
    const { ref, token } = await reserve({ ORDERS_DB: db, PROOFS: store.bucket });
    await sendProof(ref, token, { ORDERS_DB: db, PROOFS: store.bucket });
    expect(await flushOutbox({ ORDERS_DB: db }, NOW)).toBe(0);
    expect(outbox().map((r) => [r.status, r.attempts])).toEqual([["pending", 0], ["pending", 0]]);
    // Once it is set up, what was waiting goes out.
    expect(await flushOutbox(env(), later(10))).toBe(2);
    expect(await flushOutbox({}, NOW)).toBe(0);
  });

  it("drops what could not be sent for three days", async () => {
    const { ref, token } = await reserve({ ORDERS_DB: db, PROOFS: store.bucket });
    await sendProof(ref, token, { ORDERS_DB: db, PROOFS: store.bucket });
    expect(await flushOutbox(env(), later(73 * 60))).toBe(0);
    expect(outbox().every((r) => r.status === "failed" && r.body_text === "")).toBe(true);
    expect(sent).toHaveLength(0);
  });
});

describe("the morning summary", () => {
  const at = (iso: string) => new Date(iso);
  it("goes out once, between 8 and 9 am in Barbados, only when something is waiting", async () => {
    expect(await queueMorningSummary(env(), at("2026-11-29T12:10:00.000Z"))).toBe(false); // nothing waiting
    const { ref, token } = await reserve();
    await sendProof(ref, token);
    await flushOutbox(env(), NOW);
    sent = [];

    expect(await queueMorningSummary(env(), at("2026-11-29T11:55:00.000Z"))).toBe(false); // 7:55 am
    expect(await queueMorningSummary(env(), at("2026-11-29T13:00:00.000Z"))).toBe(false); // 9:00 am
    expect(await queueMorningSummary(env(), at("2026-11-29T12:05:00.000Z"))).toBe(true); // 8:05 am
    await queueMorningSummary(env(), at("2026-11-29T12:10:00.000Z")); // the cron runs again
    await queueMorningSummary(env(), at("2026-11-29T12:55:00.000Z"));
    await flushOutbox(env(), at("2026-11-29T12:56:00.000Z"));

    expect(sent.map((m) => m.to).sort()).toEqual([...ADMIN_EMAILS].sort());
    expect(sent[0].subject).toBe("AFP this morning: 1 proof to check");
    expect(sent[0].text).toContain("1 proof of payment to check");
    expect(sent[0].text).toContain(`${ORIGIN}/admin`);
    expect(sent[0].text).not.toContain("Test Customer"); // counts only

    // The next morning it goes again, because the proof is still waiting.
    sent = [];
    await queueMorningSummary(env(), at("2026-11-30T12:05:00.000Z"));
    await flushOutbox(env(), at("2026-11-30T12:06:00.000Z"));
    expect(sent).toHaveLength(2);
  });

  it("counts paid orders to deliver and to ring up", async () => {
    const { ref, token } = await reserve();
    await sendProof(ref, token);
    raw.exec("UPDATE orders SET status = 'paid'");
    await queueMorningSummary(env(), new Date("2026-11-29T12:05:00.000Z"));
    const row = outbox().find((r) => r.kind === "morning_summary")!;
    expect(row.subject).toBe("AFP this morning: 1 to deliver, 1 to ring up");
  });
});

describe("the portal's quiet line about email", () => {
  it("says off when not set up, trouble when an alert failed or is stuck, and nothing otherwise", async () => {
    expect(await ownerEmailHealth({ ORDERS_DB: db }, NOW)).toBe("off");
    expect(await ownerEmailHealth(env(), NOW)).toBe("ok");
    const { ref, token } = await reserve();
    await sendProof(ref, token);
    expect(await ownerEmailHealth(env(), later(5))).toBe("ok"); // only just queued
    expect(await ownerEmailHealth(env(), later(45))).toBe("trouble"); // still not sent after 30 minutes
    await flushOutbox(env(), later(46));
    expect(await ownerEmailHealth(env(), later(47))).toBe("ok");
  });
});

describe("customer emails", () => {
  const on = () => env({ CUSTOMER_EMAILS: "on" });

  it("are not queued at all while switched off", async () => {
    const { ref, token } = await reserve();
    await sendProof(ref, token);
    await expireOrders(env(), later(120));
    expect(outbox().filter((r) => r.audience === "customer")).toHaveLength(0);
    await notifyCustomer(env({ CUSTOMER_EMAILS: "off" }), "paid", { ref, customerName: "T", customerEmail: "c@example.com", totalCents: 1, fulfillment: "pickup" }, NOW);
    expect(outbox().filter((r) => r.audience === "customer")).toHaveLength(0);
  });

  it("when on: the first email carries the private order link, which is cleared once sent", async () => {
    const { ref, token } = await reserve(on());
    const queued = outbox().find((r) => r.kind === "reserved")!;
    expect(queued.recipient).toBe("customer@example.com");
    expect(queued.body_text).toContain(`${ORIGIN}/order/${ref}#${token}`);
    await flushOutbox(on(), NOW);
    expect(sent[0].to).toBe("customer@example.com");
    expect(sent[0].subject).toBe(`Your items are held for 60 minutes (${ref})`);
    expect(sent[0].replyTo).toBe(ADMIN_EMAILS[0]);
    expect(JSON.stringify(outbox())).not.toContain(token);
  });

  it("when on: proof received, and running out of time, each email the customer", async () => {
    const a = await reserve(on());
    await sendProof(a.ref, a.token, on());
    const b = await reserve(on());
    await expireOrders(on(), later(61));
    await expireOrders(on(), later(66)); // the cron runs again: no second email
    const kinds = outbox().filter((r) => r.audience === "customer").map((r) => `${r.order_ref === a.ref ? "a" : "b"}:${r.kind}`);
    expect(kinds.sort()).toEqual(["a:proof_received", "a:reserved", "b:expired", "b:reserved"]);
  });

  it("a customer cancelling their own order sends them nothing further", async () => {
    const { ref, token } = await reserve(on());
    await cancelOrder(new Request(`${ORIGIN}/api/orders/${ref}/cancel`, { method: "POST", headers: { "content-type": "application/json", "x-order-token": token }, body: "{}" }), on(), ref, NOW);
    expect(outbox().map((r) => r.kind)).toEqual(["reserved"]);
  });

  it("each status has its own plain message, with the owner's reason on a rejection and no link", () => {
    const o = { ref: "AFP-20261128-123", customerName: "Tia Testcase", customerEmail: "t@example.com", totalCents: 14500, fulfillment: "delivery" as const, reason: "Amount did not match." };
    const all = (["proof_received", "paid", "rejected", "delivered", "expired", "cancelled"] as const).map((k) => render(customerDraft(k, o)));
    expect(all.map((m) => m.subject)).toEqual([
      "We've received your proof of payment (AFP-20261128-123)",
      "Payment confirmed (AFP-20261128-123)",
      "We couldn't confirm your payment (AFP-20261128-123)",
      "Your order is complete (AFP-20261128-123)",
      "Your order ran out of time (AFP-20261128-123)",
      "Your order was cancelled (AFP-20261128-123)",
    ]);
    expect(all[1].text).toContain("BDS $145.00");
    expect(all[2].text).toContain("Note from AFP: Amount did not match.");
    for (const m of all) {
      expect(m.text).toContain("Hi Tia,");
      expect(m.text + m.html).not.toContain("/order/");
      expect(m.html).not.toMatch(/<img|<script/);
    }
  });
});
