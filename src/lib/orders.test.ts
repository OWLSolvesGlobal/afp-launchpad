// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import type { CatalogProduct, CatalogSnapshot } from "@/lib/catalog-core";
import {
  ORDER_LIMITS,
  PAY_WINDOW_MINUTES,
  applyHolds,
  holdKey,
  newOrderRef,
  parseOrderInput,
  priceOrder,
} from "@/lib/orders-core";
import {
  createOrder,
  expireOrders,
  getOrder,
  loadHolds,
  type OrdersDb,
} from "../../worker/orders";
import { makeDb } from "../test/orders-db";
import { withHolds } from "../../worker/index";

const product = (overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  sku: "LV-romper",
  slug: "babydoll-romper-black",
  name: "Babydoll Romper BLACK",
  description: "",
  gender: "women",
  category: "Rompers",
  colors: [],
  priceCents: 13000,
  compareAtCents: null,
  sizes: ["S", "M", "L"],
  stock: { S: 2, M: 1, L: 0 },
  image: "",
  imageAlt: "",
  badge: null,
  active: true,
  ...overrides,
});

const snapshotOf = (...products: CatalogProduct[]): CatalogSnapshot => ({
  generatedAt: "2026-11-28T00:00:00.000Z",
  products,
  categories: ["Rompers"],
  config: {
    announcementBar: "",
    featuredSkus: [],
    heroOrder: [],
    paymentsCardEnabled: false,
    paymentsTransferEnabled: true,
    transferInstructions: "",
  },
});

const SNAPSHOT = snapshotOf(product(), product({ sku: "LV-loungie", name: "Red Loungie", priceCents: 14000, stock: { S: 5, M: 5, L: 5 } }));
const NOW = new Date("2026-11-28T15:00:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

const body = (overrides: Record<string, unknown> = {}) => ({
  items: [{ sku: "LV-romper", size: "S", quantity: 1 }],
  fulfillment: "delivery",
  customer: { name: "Test Customer", phone: "+1 246 555 0100", email: "", address: "12 Test Road, St Michael" },
  ...overrides,
});

const post = (payload: unknown, headers: Record<string, string> = {}, ip = "203.0.113.5") =>
  new Request("https://alofitnesspro.com/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON in tests
type Json = Record<string, any>;

const reserve = async (db: OrdersDb, payload: unknown = body(), now = NOW, ip = "203.0.113.5", snapshot = SNAPSHOT) => {
  const res = await createOrder(post(payload, {}, ip), { ORDERS_DB: db }, snapshot, now);
  return { res, data: (await res.json()) as Json };
};

const lookup = async (db: OrdersDb, ref: string, token: string, now = NOW) => {
  const res = await getOrder(
    new Request(`https://alofitnesspro.com/api/orders/${ref}`, { headers: { "x-order-token": token } }),
    { ORDERS_DB: db },
    ref,
    now,
  );
  return { res, data: (await res.json()) as Json };
};

describe("parseOrderInput", () => {
  it("accepts a complete order and ignores any price the browser sends", () => {
    const parsed = parseOrderInput(
      body({ items: [{ sku: "LV-romper", size: "S", quantity: 1, priceCents: 1 }], totalCents: 1 }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(JSON.stringify(parsed.value)).not.toContain("priceCents");
  });

  it("merges repeated lines and caps the quantity of one size", () => {
    const two = { sku: "LV-romper", size: "S", quantity: 2 };
    const merged = parseOrderInput(body({ items: [two, two] }));
    expect(merged.ok && merged.value.items).toEqual([{ sku: "LV-romper", size: "S", quantity: 4 }]);
    const tooMany = parseOrderInput(body({ items: Array(6).fill(two) }));
    expect(tooMany.ok).toBe(false);
  });

  it("rejects bad input with a plain reason", () => {
    const bad: unknown[] = [
      null,
      body({ items: [] }),
      body({ items: [{ sku: "LV-romper", size: "S", quantity: 0 }] }),
      body({ items: [{ sku: "LV-romper", size: "S", quantity: 1.5 }] }),
      body({ items: [{ sku: "LV-romper", size: "S", quantity: "2" }] }),
      body({ fulfillment: "teleport" }),
      body({ customer: { name: "A", phone: "+1 246 555 0100", address: "12 Test Road" } }),
      body({ customer: { name: "Test", phone: "call me", address: "12 Test Road" } }),
      body({ customer: { name: "Test", phone: "+1 246 555 0100", email: "nope", address: "12 Test Road" } }),
      body({ customer: { name: "Test", phone: "+1 246 555 0100", address: "" } }),
    ];
    for (const b of bad) expect(parseOrderInput(b).ok).toBe(false);
  });

  it("does not need an address for pickup, and drops one if sent", () => {
    const parsed = parseOrderInput(
      body({ fulfillment: "pickup", pickupLocation: "st-michael", customer: { name: "Test", phone: "2465550100", address: "x" } }),
    );
    expect(parsed.ok && parsed.value.customer.address).toBe("");
    expect(parsed.ok && parsed.value.pickupLocation).toBe("st-michael");
  });
});

describe("priceOrder", () => {
  const parsed = (items: unknown[], fulfillment = "delivery") => {
    const p = parseOrderInput(body({ items, fulfillment }));
    if (!p.ok) throw new Error(p.error);
    return p.value;
  };

  it("prices from the catalog and adds delivery", () => {
    const priced = priceOrder(parsed([{ sku: "LV-romper", size: "S", quantity: 1 }]), SNAPSHOT);
    expect(priced.ok && priced.value).toMatchObject({ subtotalCents: 13000, shippingCents: 1500, totalCents: 14500 });
  });

  it("gives free delivery at $300 or more", () => {
    const priced = priceOrder(
      parsed([
        { sku: "LV-romper", size: "S", quantity: 2 },
        { sku: "LV-loungie", size: "M", quantity: 1 },
      ]),
      SNAPSHOT,
    );
    expect(priced.ok && priced.value).toMatchObject({ subtotalCents: 40000, shippingCents: 0, totalCents: 40000 });
  });

  it("charges nothing for pickup", () => {
    const priced = priceOrder(parsed([{ sku: "LV-romper", size: "S", quantity: 1 }], "pickup"), SNAPSHOT);
    expect(priced.ok && priced.value.totalCents).toBe(13000);
  });

  it("refuses hidden, unpriced or unknown items and sizes that do not exist", () => {
    const line = [{ sku: "LV-romper", size: "S", quantity: 1 }];
    expect(priceOrder(parsed(line), snapshotOf(product({ active: false }))).ok).toBe(false);
    expect(priceOrder(parsed(line), snapshotOf(product({ priceCents: 0 }))).ok).toBe(false);
    expect(priceOrder(parsed(line), snapshotOf()).ok).toBe(false);
    expect(priceOrder(parsed([{ sku: "LV-romper", size: "XXL", quantity: 1 }]), SNAPSHOT).ok).toBe(false);
  });
});

describe("order references", () => {
  it("carry the Barbados date, not the UTC date", () => {
    // 02:30 UTC on the 29th is still the 28th in Barbados.
    expect(newOrderRef(new Date("2026-11-29T02:30:00.000Z"), () => 0.007)).toBe("AFP-20261128-007");
  });
});

describe("reserving an order", () => {
  let db: OrdersDb;
  let raw: DatabaseSync;
  beforeEach(() => ({ db, raw } = makeDb()));

  it("saves the order, returns a private token and holds the stock", async () => {
    const { res, data } = await reserve(db);
    expect(res.status).toBe(201);
    expect(data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(data.order).toMatchObject({ status: "reserved", totalCents: 14500, subtotalCents: 13000, shippingCents: 1500 });
    expect(data.order.ref).toMatch(/^AFP-20261128-\d{3}$/);
    expect(new Date(data.order.expiresAt).getTime() - NOW.getTime()).toBe(PAY_WINDOW_MINUTES * 60_000);

    // Only a hash of the token is stored; the visitor's address is not stored.
    const row = raw.prepare("SELECT * FROM orders").get() as Record<string, string>;
    expect(row.token_hash).not.toBe(data.token);
    expect(JSON.stringify(row)).not.toContain("203.0.113.5");

    const holds = await loadHolds(db, NOW);
    expect(holds.get(holdKey("LV-romper", "S"))).toBe(1);
    const shown = applyHolds(SNAPSHOT, holds).products[0].stock;
    expect(shown).toEqual({ S: 1, M: 1, L: 0 });
    // The stored snapshot itself is not altered.
    expect(SNAPSHOT.products[0].stock.S).toBe(2);
  });

  it("uses the catalog price even when the request claims another", async () => {
    const { data } = await reserve(
      db,
      body({ items: [{ sku: "LV-romper", size: "S", quantity: 1, priceCents: 100 }], totalCents: 100, shippingCents: 0 }),
    );
    expect(data.order.totalCents).toBe(14500);
    expect(data.order.items[0].priceCents).toBe(13000);
  });

  it("refuses more than the stock on hand and leaves nothing behind", async () => {
    const { res, data } = await reserve(db, body({ items: [{ sku: "LV-romper", size: "S", quantity: 3 }] }));
    expect(res.status).toBe(409);
    expect(data.unavailable[0]).toMatchObject({ size: "S", requested: 3, available: 2 });
    expect((raw.prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n).toBe(0);
    expect((raw.prepare("SELECT COUNT(*) AS n FROM order_items").get() as { n: number }).n).toBe(0);
  });

  it("lets only one of two customers reserve the last piece", async () => {
    const last = body({ items: [{ sku: "LV-romper", size: "M", quantity: 1 }] });
    const [a, b] = await Promise.all([reserve(db, last, NOW, "203.0.113.5"), reserve(db, last, NOW, "203.0.113.9")]);
    expect([a.res.status, b.res.status].sort()).toEqual([201, 409]);
    expect((await loadHolds(db, NOW)).get(holdKey("LV-romper", "M"))).toBe(1);
  });

  it("releases the whole order when only part of it can be held", async () => {
    const { res } = await reserve(
      db,
      body({ items: [{ sku: "LV-loungie", size: "S", quantity: 1 }, { sku: "LV-romper", size: "L", quantity: 1 }] }),
    );
    expect(res.status).toBe(409);
    expect((await loadHolds(db, NOW)).size).toBe(0);
  });

  it("follows Loyverse when an item sells out at the till or changes price while in a cart", async () => {
    const soldOut = snapshotOf(product({ stock: { S: 0, M: 0, L: 0 } }));
    expect((await reserve(db, body(), NOW, "203.0.113.5", soldOut)).res.status).toBe(409);
    const repriced = snapshotOf(product({ priceCents: 15000 }));
    expect((await reserve(db, body(), NOW, "203.0.113.5", repriced)).data.order.totalCents).toBe(16500);
  });

  it("refuses requests from another site, the wrong format, or an oversized body", async () => {
    const env = { ORDERS_DB: db };
    const cross = await createOrder(post(body(), { origin: "https://evil.example" }), env, SNAPSHOT, NOW);
    expect(cross.status).toBe(403);
    const same = await createOrder(post(body(), { origin: "https://alofitnesspro.com" }), env, SNAPSHOT, NOW);
    expect(same.status).toBe(201);
    const form = await createOrder(post(body(), { "content-type": "text/plain" }), env, SNAPSHOT, NOW);
    expect(form.status).toBe(415);
    const huge = await createOrder(post("x".repeat(ORDER_LIMITS.maxBodyBytes + 1)), env, SNAPSHOT, NOW);
    expect(huge.status).toBe(413);
    const junk = await createOrder(post("{not json"), env, SNAPSHOT, NOW);
    expect(junk.status).toBe(400);
  });

  it("says ordering is unavailable when the database or catalog is missing", async () => {
    expect((await createOrder(post(body()), {}, SNAPSHOT, NOW)).status).toBe(503);
    expect((await createOrder(post(body()), { ORDERS_DB: db }, null, NOW)).status).toBe(503);
  });
});

describe("limits per visitor", () => {
  let db: OrdersDb;
  let raw: DatabaseSync;
  beforeEach(() => ({ db, raw } = makeDb()));
  const loungie = body({ items: [{ sku: "LV-loungie", size: "S", quantity: 1 }] });

  it("stops a visitor holding more than three unpaid orders", async () => {
    for (let i = 0; i < ORDER_LIMITS.maxOpenReservations; i += 1) {
      expect((await reserve(db, loungie)).res.status).toBe(201);
    }
    const blocked = await reserve(db, loungie);
    expect(blocked.res.status).toBe(429);
    // Another visitor is not affected.
    expect((await reserve(db, loungie, NOW, "198.51.100.7")).res.status).toBe(201);
  });

  it("slows down rapid order attempts and recovers after the window", async () => {
    const big = snapshotOf(product({ sku: "LV-loungie", stock: { S: 50, M: 0, L: 0 } }));
    for (let i = 0; i < ORDER_LIMITS.maxOrdersPerWindow; i += 1) {
      expect((await reserve(db, loungie, NOW, "203.0.113.5", big)).res.status).toBe(201);
      raw.exec("UPDATE orders SET status = 'cancelled'");
    }
    const blocked = await reserve(db, loungie, NOW, "203.0.113.5", big);
    expect(blocked.res.status).toBe(429);
    expect(blocked.res.headers.get("retry-after")).toBe("600");
    const after = await reserve(db, loungie, later(ORDER_LIMITS.windowMinutes + 1), "203.0.113.5", big);
    expect(after.res.status).toBe(201);
  });
});

describe("looking up an order", () => {
  let db: OrdersDb;
  beforeEach(() => ({ db } = makeDb()));

  it("needs the reference and the private token", async () => {
    const { data } = await reserve(db);
    const ok = await lookup(db, data.order.ref, data.token);
    expect(ok.res.status).toBe(200);
    expect(ok.data.order).toMatchObject({ ref: data.order.ref, status: "reserved", totalCents: 14500 });
    expect(ok.res.headers.get("cache-control")).toBe("no-store");

    const wrongToken = await lookup(db, data.order.ref, "0".repeat(64));
    const noSuchRef = await lookup(db, "AFP-20261128-999", data.token);
    const junkToken = await lookup(db, data.order.ref, "guess");
    for (const r of [wrongToken, noSuchRef, junkToken]) {
      expect(r.res.status).toBe(404);
      expect(r.data).toEqual({ error: "We couldn't find that order." });
    }
  });

  it("shows the customer only their order, never internal fields", async () => {
    const { data } = await reserve(db);
    const text = JSON.stringify((await lookup(db, data.order.ref, data.token)).data);
    for (const hidden of ["token_hash", "client_hash", "customer", "phone", "Test Road"]) {
      expect(text).not.toContain(hidden);
    }
  });
});

describe("holds and expiry", () => {
  let db: OrdersDb;
  let raw: DatabaseSync;
  beforeEach(() => ({ db, raw } = makeDb()));
  const held = async (now = NOW) => (await loadHolds(db, now)).get(holdKey("LV-romper", "S")) ?? 0;

  it("releases the stock when no proof arrives within 60 minutes", async () => {
    const { data } = await reserve(db);
    expect(await held(later(59))).toBe(1);
    // The hold lapses by the clock even before the cron runs...
    expect(await held(later(61))).toBe(0);
    // ...and the cron then closes the order and records it.
    expect(await expireOrders({ ORDERS_DB: db }, later(61))).toBe(1);
    expect((await lookup(db, data.order.ref, data.token, later(61))).data.order.status).toBe("expired");
    const log = raw.prepare("SELECT action FROM audit_log ORDER BY id").all().map((r) => (r as { action: string }).action);
    expect(log).toEqual(["order_reserved", "order_expired"]);
    // Someone else can now reserve both pieces.
    const next = await reserve(db, body({ items: [{ sku: "LV-romper", size: "S", quantity: 2 }] }), later(62), "198.51.100.7");
    expect(next.res.status).toBe(201);
  });

  it("reports an order as expired the moment its window passes", async () => {
    const { data } = await reserve(db);
    expect((await lookup(db, data.order.ref, data.token, later(61))).data.order.status).toBe("expired");
  });

  it("keeps holding while proof is being checked, and until a paid order is in Loyverse", async () => {
    await reserve(db);
    raw.exec("UPDATE orders SET status = 'proof_uploaded'");
    expect(await held(later(600))).toBe(1);
    expect(await expireOrders({ ORDERS_DB: db }, later(600))).toBe(0);
    raw.exec("UPDATE orders SET status = 'paid'");
    expect(await held(later(600))).toBe(1);
    raw.exec("UPDATE orders SET loyverse_receipt = 'R-1'");
    expect(await held(later(600))).toBe(0);
  });

  it("releases the stock when an order is rejected or cancelled", async () => {
    await reserve(db);
    for (const status of ["rejected", "cancelled", "expired"]) {
      raw.exec(`UPDATE orders SET status = '${status}'`);
      expect(await held()).toBe(0);
    }
  });
});

describe("catalog with holds", () => {
  it("serves the plain catalog if the orders database cannot be read", async () => {
    const stored = JSON.stringify(SNAPSHOT);
    const broken = { prepare: () => { throw new Error("db down"); }, batch: async () => [] } as unknown as OrdersDb;
    expect(await withHolds(stored, { ORDERS_DB: broken } as never)).toBe(stored);
    expect(await withHolds(stored, {} as never)).toBe(stored);
  });

  it("subtracts held items from what customers see", async () => {
    const { db } = makeDb();
    await reserve(db, body({ items: [{ sku: "LV-romper", size: "S", quantity: 2 }] }));
    const shown = JSON.parse(await withHolds(JSON.stringify(SNAPSHOT), { ORDERS_DB: db } as never)) as CatalogSnapshot;
    expect(shown.products[0].stock.S).toBe(0);
  });
});
