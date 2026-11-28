// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import type { CatalogProduct, CatalogSnapshot } from "@/lib/catalog-core";
import { PROOF_LIMITS, holdKey, parseBankDetails, sniffProof } from "@/lib/orders-core";
import { createOrder, getOrder, loadHolds, type OrdersDb } from "../../worker/orders";
import { cancelOrder, uploadProof, type ProofBucket } from "../../worker/order-actions";
import worker from "../../worker/index";
import { makeBucket, makeDb } from "../test/orders-db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON in tests
type Json = Record<string, any>;

const product: CatalogProduct = {
  sku: "LV-romper",
  slug: "babydoll-romper-black",
  name: "Babydoll Romper BLACK",
  description: "",
  gender: "women",
  category: "Rompers",
  colors: [],
  priceCents: 13000,
  compareAtCents: null,
  sizes: ["S", "M"],
  stock: { S: 2, M: 1 },
  image: "",
  imageAlt: "",
  badge: null,
  active: true,
};
const SNAPSHOT: CatalogSnapshot = {
  generatedAt: "2026-11-28T00:00:00.000Z",
  products: [product],
  categories: ["Rompers"],
  config: {
    announcementBar: "",
    featuredSkus: [],
    heroOrder: [],
    paymentsCardEnabled: false,
    paymentsTransferEnabled: true,
    transferInstructions: "",
  },
};
const NOW = new Date("2026-11-28T15:00:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const ORIGIN = "https://alofitnesspro.com";

// --- Sample files, by their real first bytes --------------------------------
const pad = (head: number[], size = 64) => {
  const out = new Uint8Array(size);
  out.set(head);
  return out;
};
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = pad([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const PDF = new TextEncoder().encode("%PDF-1.7\n%test proof\n");
const EXE = pad([0x4d, 0x5a, 0x90, 0x00]); // a Windows program
const HTML = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');

let db: OrdersDb;
let raw: DatabaseSync;
let bucket: ProofBucket;
let files: Map<string, { bytes: Uint8Array; contentType?: string }>;
const env = () => ({ ORDERS_DB: db, PROOFS: bucket });

beforeEach(() => {
  ({ db, raw } = makeDb());
  ({ bucket, files } = makeBucket());
});

const reserve = async (size = "S", now = NOW, ip = "203.0.113.5") => {
  const res = await createOrder(
    new Request(`${ORIGIN}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify({
        items: [{ sku: "LV-romper", size, quantity: 1 }],
        fulfillment: "pickup",
        pickupLocation: "AFP HQ",
        customer: { name: "Test Customer", phone: "2465550100" },
      }),
    }),
    env(),
    SNAPSHOT,
    now,
  );
  const data = (await res.json()) as Json;
  return { ref: data.order.ref as string, token: data.token as string, data };
};

const upload = async (
  ref: string,
  token: string | null,
  bytes: Uint8Array,
  opts: { name?: string; type?: string; method?: string; now?: Date; ip?: string; origin?: string } = {},
) => {
  const form = new FormData();
  form.set("method", opts.method ?? "cibc_qr");
  form.set("file", new File([bytes], opts.name ?? "proof.jpg", { type: opts.type ?? "image/jpeg" }));
  const headers: Record<string, string> = { "cf-connecting-ip": opts.ip ?? "203.0.113.5" };
  if (token) headers["x-order-token"] = token;
  if (opts.origin) headers.origin = opts.origin;
  const res = await uploadProof(
    new Request(`${ORIGIN}/api/orders/${ref}/proof`, { method: "POST", headers, body: form }),
    env(),
    ref,
    opts.now ?? NOW,
  );
  return { res, data: (await res.json()) as Json };
};

const cancel = async (ref: string, token: string, now = NOW, headers: Record<string, string> = {}) => {
  const res = await cancelOrder(
    new Request(`${ORIGIN}/api/orders/${ref}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-order-token": token, ...headers },
      body: "{}",
    }),
    env(),
    ref,
    now,
  );
  return { res, data: (await res.json()) as Json };
};

const lookup = async (ref: string, token: string, now = NOW) => {
  const res = await getOrder(
    new Request(`${ORIGIN}/api/orders/${ref}`, { headers: { "x-order-token": token } }),
    env(),
    ref,
    now,
  );
  return { res, data: (await res.json()) as Json };
};

const order = () => raw.prepare("SELECT * FROM orders").get() as Json;
const auditActions = () =>
  raw.prepare("SELECT action, detail FROM audit_log ORDER BY id").all() as { action: string; detail: string }[];
const setBank = (value: unknown) =>
  raw
    .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at, updated_by) VALUES ('bank_details', ?, 'now', 'test')")
    .run(JSON.stringify(value));
const BANK = { bank: "Test Bank", accountName: "AFP Test", accountNumber: "000111222", branch: "Test Branch", swift: "TESTBB00" };

describe("sniffProof: the file type comes from its first bytes", () => {
  it("recognises the four accepted types", () => {
    expect(sniffProof(JPEG)).toEqual({ contentType: "image/jpeg", ext: "jpg" });
    expect(sniffProof(PNG)).toEqual({ contentType: "image/png", ext: "png" });
    expect(sniffProof(WEBP)).toEqual({ contentType: "image/webp", ext: "webp" });
    expect(sniffProof(PDF)).toEqual({ contentType: "application/pdf", ext: "pdf" });
  });
  it("refuses everything else", () => {
    for (const bad of [EXE, HTML, SVG, new Uint8Array(), pad([0x47, 0x49, 0x46, 0x38]), pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])]) {
      expect(sniffProof(bad)).toBeNull();
    }
  });
});

describe("uploading proof of payment", () => {
  it("accepts each allowed type, stores it privately and waits for an admin", async () => {
    for (const [bytes, contentType, ext] of [
      [JPEG, "image/jpeg", "jpg"],
      [PNG, "image/png", "png"],
      [WEBP, "image/webp", "webp"],
      [PDF, "application/pdf", "pdf"],
    ] as const) {
      ({ db, raw } = makeDb());
      ({ bucket, files } = makeBucket());
      const { ref, token } = await reserve();
      const { res, data } = await upload(ref, token, bytes, { name: "My Bank Receipt (Test Customer).heic" });
      expect(res.status).toBe(200);
      // Evidence, not confirmation: never "paid".
      expect(data.order.status).toBe("proof_uploaded");
      expect(data.order.paymentMethod).toBe("cibc_qr");
      expect(data.order.proofUploadsLeft).toBe(2);

      const [key, stored] = [...files.entries()][0];
      expect(files.size).toBe(1);
      // Random name, right extension, nothing of the customer's in it.
      expect(key).toMatch(new RegExp(`^proofs/[0-9a-f]{48}\\.${ext}$`));
      expect(stored.contentType).toBe(contentType);
      expect(order().proof_key).toBe(key);
      // The response never tells the browser where the file is.
      expect(JSON.stringify(data)).not.toContain(key);
      expect(JSON.stringify(data)).not.toContain("proofs/");
    }
  });

  it("keeps holding the stock after proof, past the 60 minutes", async () => {
    const { ref, token } = await reserve();
    await upload(ref, token, JPEG, { now: later(30) });
    expect((await loadHolds(db, later(600))).get(holdKey("LV-romper", "S"))).toBe(1);
    expect((await lookup(ref, token, later(600))).data.order.status).toBe("proof_uploaded");
  });

  it("refuses a renamed program, a web page called .jpg, an SVG and an empty file", async () => {
    const { ref, token } = await reserve();
    const cases: [Uint8Array, string, number, string][] = [
      [EXE, "receipt.jpg", 415, "bad_type"],
      [HTML, "receipt.jpg", 415, "bad_type"],
      [SVG, "receipt.png", 415, "bad_type"],
      [new Uint8Array(), "receipt.jpg", 400, "empty"],
    ];
    for (const [bytes, name, status, reason] of cases) {
      const { res, data } = await upload(ref, token, bytes, { name, type: "image/jpeg" });
      expect(res.status).toBe(status);
      expect(data.reason).toBe(reason);
    }
    expect(files.size).toBe(0);
    expect(order().status).toBe("reserved");
    expect(auditActions().filter((a) => a.action === "proof_refused").map((a) => a.detail)).toEqual([
      "bad_type",
      "bad_type",
      "bad_type",
      "empty",
    ]);
  });

  it("accepts exactly 8 MB and refuses one byte more", async () => {
    const exact = new Uint8Array(PROOF_LIMITS.maxBytes);
    exact.set([0xff, 0xd8, 0xff]);
    const over = new Uint8Array(PROOF_LIMITS.maxBytes + 1);
    over.set([0xff, 0xd8, 0xff]);

    const { ref, token } = await reserve();
    const tooBig = await upload(ref, token, over);
    expect(tooBig.res.status).toBe(413);
    expect(files.size).toBe(0);
    const ok = await upload(ref, token, exact);
    expect(ok.res.status).toBe(200);
  });

  it("stops reading a body that is far too large, whatever its headers say", async () => {
    const { ref, token } = await reserve();
    let sent = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        if (sent > 200) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const res = await uploadProof(
      new Request(`${ORIGIN}/api/orders/${ref}/proof`, {
        method: "POST",
        headers: { "x-order-token": token, "content-type": "multipart/form-data; boundary=x" },
        body: stream,
        duplex: "half",
      } as RequestInit),
      env(),
      ref,
      NOW,
    );
    expect(res.status).toBe(413);
    expect(sent).toBeLessThan(20); // gave up shortly after 8 MB, not after 200 MB
  });

  it("needs the order's own token", async () => {
    const a = await reserve("S", NOW, "203.0.113.5");
    const b = await reserve("M", NOW, "198.51.100.7");
    for (const token of [null, "f".repeat(64), "guess", b.token]) {
      const { res, data } = await upload(a.ref, token, JPEG);
      expect(res.status).toBe(404);
      expect(data).toEqual({ error: "We couldn't find that order." });
    }
    expect(files.size).toBe(0);
  });

  it("refuses an upload after the 60 minutes, and does not revive the order", async () => {
    const { ref, token } = await reserve();
    const { res, data } = await upload(ref, token, JPEG, { now: later(61) });
    expect(res.status).toBe(410);
    expect(data.error).toContain("WhatsApp");
    expect(files.size).toBe(0);
    expect((await lookup(ref, token, later(61))).data.order.status).toBe("expired");
    expect((await loadHolds(db, later(61))).size).toBe(0);
  });

  it("refuses an upload on a cancelled, rejected, paid or delivered order", async () => {
    const { ref, token } = await reserve();
    for (const status of ["cancelled", "rejected", "paid", "delivered"]) {
      raw.exec(`UPDATE orders SET status = '${status}'`);
      expect((await upload(ref, token, JPEG)).res.status).toBe(409);
    }
    raw.exec(`UPDATE orders SET status = 'expired'`);
    expect((await upload(ref, token, JPEG)).res.status).toBe(410);
    expect(files.size).toBe(0);
  });

  it("lets the customer replace a proof twice, keeping only the latest file", async () => {
    const { ref, token } = await reserve();
    const first = await upload(ref, token, JPEG);
    const firstKey = [...files.keys()][0];
    const second = await upload(ref, token, PDF, { method: "cibc_qr", now: later(90) });
    expect(second.res.status).toBe(200);
    expect(second.data.order.proofUploadsLeft).toBe(1);
    expect(files.size).toBe(1);
    expect(files.has(firstKey)).toBe(false);
    const third = await upload(ref, token, PNG);
    expect(third.data.order.proofUploadsLeft).toBe(0);
    const fourth = await upload(ref, token, PNG);
    expect(fourth.res.status).toBe(409);
    expect(fourth.data.reason).toBe("replacement_limit");
    expect(files.size).toBe(1);
    expect(first.data.order.proofUploadsLeft).toBe(2);
    expect(auditActions().map((a) => a.action)).toEqual([
      "order_reserved",
      "proof_uploaded",
      "proof_replaced",
      "proof_replaced",
      "proof_refused",
    ]);
  });

  it("slows a visitor who keeps trying", async () => {
    const { ref, token } = await reserve();
    for (let i = 0; i < PROOF_LIMITS.maxAttemptsPerWindow; i += 1) {
      expect((await upload(ref, token, EXE)).res.status).toBe(415);
    }
    const blocked = await upload(ref, token, JPEG);
    expect(blocked.res.status).toBe(429);
    expect(blocked.res.headers.get("retry-after")).toBe("600");
    expect(files.size).toBe(0);
  });

  it("refuses requests from another site and ones that are not a form upload", async () => {
    const { ref, token } = await reserve();
    expect((await upload(ref, token, JPEG, { origin: "https://evil.example" })).res.status).toBe(403);
    const jsonBody = await uploadProof(
      new Request(`${ORIGIN}/api/orders/${ref}/proof`, {
        method: "POST",
        headers: { "x-order-token": token, "content-type": "application/json" },
        body: "{}",
      }),
      env(),
      ref,
      NOW,
    );
    expect(jsonBody.status).toBe(415);
    expect((await upload(ref, token, JPEG, { method: "cash" })).res.status).toBe(400);
  });

  it("says uploads are unavailable when the bucket is missing, rather than failing", async () => {
    const { ref, token } = await reserve();
    const res = await uploadProof(
      new Request(`${ORIGIN}/api/orders/${ref}/proof`, { method: "POST", headers: { "x-order-token": token } }),
      { ORDERS_DB: db },
      ref,
      NOW,
    );
    expect(res.status).toBe(503);
  });

  it("removes the stored file if the order changed while it was uploading", async () => {
    const { ref, token } = await reserve();
    const racing: ProofBucket = {
      put: async (key, value, options) => {
        await bucket.put(key, value, options);
        raw.exec("UPDATE orders SET status = 'cancelled'"); // cancelled mid-upload
      },
      delete: (key) => bucket.delete(key),
    };
    const form = new FormData();
    form.set("method", "cibc_qr");
    form.set("file", new File([JPEG], "p.jpg"));
    const res = await uploadProof(
      new Request(`${ORIGIN}/api/orders/${ref}/proof`, { method: "POST", headers: { "x-order-token": token }, body: form }),
      { ORDERS_DB: db, PROOFS: racing },
      ref,
      NOW,
    );
    expect(res.status).toBe(409);
    expect(files.size).toBe(0);
    expect(order().status).toBe("cancelled");
    expect(order().proof_key).toBeNull();
  });
});

describe("bank details", () => {
  it("are hidden until all the needed fields have been entered", () => {
    expect(parseBankDetails(null)).toBeNull();
    expect(parseBankDetails("not json")).toBeNull();
    expect(parseBankDetails(JSON.stringify({ bank: "Test Bank", accountName: "AFP" }))).toBeNull();
    expect(parseBankDetails(JSON.stringify(BANK))).toEqual(BANK);
  });

  it("go only to a customer holding the order's token, while payment is due", async () => {
    setBank(BANK);
    const { ref, token, data } = await reserve();
    expect(data.payment.bank).toEqual(BANK);
    expect((await lookup(ref, token)).data.payment.bank).toEqual(BANK);

    const stranger = await lookup(ref, "f".repeat(64));
    expect(stranger.res.status).toBe(404);
    expect(JSON.stringify(stranger.data)).not.toContain("000111222");

    await upload(ref, token, JPEG, { method: "bank_transfer" });
    const after = await lookup(ref, token);
    expect(after.data.order.paymentMethod).toBe("bank_transfer");
    expect(after.data.payment).toBeUndefined();
    expect(JSON.stringify(after.data)).not.toContain("000111222");
  });

  it("are never in the public catalog", async () => {
    setBank(BANK);
    const kv = { get: async () => JSON.stringify(SNAPSHOT) };
    const res = await worker.fetch(
      new Request(`${ORIGIN}/api/catalog`),
      { ORDERS_DB: db, AFP_CATALOG: kv, ASSETS: { fetch: async () => new Response("") } } as never,
      {} as never,
    );
    const text = await res.text();
    expect(text).toContain("Babydoll Romper BLACK");
    expect(text).not.toContain("000111222");
    expect(text).not.toContain("TESTBB00");
  });

  it("bank transfer cannot be claimed before bank details exist", async () => {
    const { ref, token, data } = await reserve();
    expect(data.payment.bank).toBeNull();
    const { res, data: body } = await upload(ref, token, JPEG, { method: "bank_transfer" });
    expect(res.status).toBe(400);
    expect(body.reason).toBe("bank_unavailable");
  });
});

describe("cancelling an order", () => {
  it("gives the items back and is logged", async () => {
    const { ref, token } = await reserve();
    expect((await loadHolds(db, NOW)).get(holdKey("LV-romper", "S"))).toBe(1);
    const { res, data } = await cancel(ref, token);
    expect(res.status).toBe(200);
    expect(data.order.status).toBe("cancelled");
    expect((await loadHolds(db, NOW)).size).toBe(0);
    expect(auditActions().at(-1)).toMatchObject({ action: "order_cancelled" });
    // Cancelling twice changes nothing.
    expect((await cancel(ref, token)).res.status).toBe(409);
  });

  it("needs the token, the same site and JSON", async () => {
    const { ref, token } = await reserve();
    expect((await cancel(ref, "f".repeat(64))).res.status).toBe(404);
    expect((await cancel(ref, token, NOW, { origin: "https://evil.example" })).res.status).toBe(403);
    expect((await cancel(ref, token, NOW, { "content-type": "text/plain" })).res.status).toBe(415);
    expect(order().status).toBe("reserved");
  });

  it("is refused once proof has been sent", async () => {
    const { ref, token } = await reserve();
    await upload(ref, token, JPEG);
    const { res, data } = await cancel(ref, token);
    expect(res.status).toBe(409);
    expect(data.error).toContain("WhatsApp");
    expect(order().status).toBe("proof_uploaded");
  });
});

describe("routes", () => {
  const call = (path: string, init: RequestInit = {}) =>
    worker.fetch(
      new Request(`${ORIGIN}${path}`, init),
      { ...env(), ASSETS: { fetch: async () => new Response("asset") } } as never,
      {} as never,
    );

  it("serve the order, proof and cancel endpoints and nothing that returns a file", async () => {
    const { ref, token } = await reserve();
    const headers = { "x-order-token": token };
    expect((await call(`/api/orders/${ref}`, { headers })).status).toBe(200);
    expect((await call(`/api/orders/${ref}/proof`, { headers })).status).toBe(405); // no GET: proofs are never served
    expect((await call(`/api/orders/${ref}/cancel`, { headers })).status).toBe(405);
    expect((await call(`/api/orders/${ref}/anything`, { headers })).status).toBe(404);
    expect((await call(`/api/orders/${ref}/proof/extra`, { method: "POST", headers })).status).toBe(404);
    expect((await call(`/api/orders/${ref}`, { method: "DELETE", headers })).status).toBe(405);
  });

  it("the order response carries the server's clock for the countdown", async () => {
    const { ref, token, data } = await reserve();
    expect(data.serverTime).toBe(NOW.toISOString());
    expect((await lookup(ref, token, later(5))).data.serverTime).toBe(later(5).toISOString());
  });
});
