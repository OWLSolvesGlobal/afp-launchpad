// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import type { CatalogProduct, CatalogSnapshot } from "@/lib/catalog-core";
import {
  ADMIN_EMAILS,
  DEFAULT_PICKUP_LOCATIONS,
  holdKey,
  maskAccountNumber,
  parseBankInput,
  parseOrderInput,
  parsePickupInput,
} from "@/lib/orders-core";
import { clearAccessKeyCache, verifyAccess, type KeyFetcher } from "../../worker/access";
import { handleAdmin } from "../../worker/admin";
import { checkoutConfig, createOrder, getOrder, loadHolds, type OrdersDb } from "../../worker/orders";
import { uploadProof } from "../../worker/order-actions";
import worker from "../../worker/index";
import { makeBucket, makeDb } from "../test/orders-db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON in tests
type Json = Record<string, any>;

const ORIGIN = "https://alofitnesspro.com";
const TEAM = "https://afp-test.cloudflareaccess.com";
const AUD = "a".repeat(64);
const NOW = new Date("2026-11-28T15:00:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const OWNER = ADMIN_EMAILS[0];
const BANK = { bank: "Test Bank", accountName: "AFP Test", accountNumber: "000111222333", branch: "Test Branch", swift: "testbb00" };

// --- A stand-in for Cloudflare Access: real RSA keys, real signatures -------
const b64url = (data: ArrayBuffer | string) =>
  Buffer.from(typeof data === "string" ? data : new Uint8Array(data)).toString("base64url");

let teamKey: CryptoKeyPair;
let strangerKey: CryptoKeyPair;
let jwks: Json[] = [];
let keyFetches: string[] = [];
const keyFetcher: KeyFetcher = async (url) => {
  keyFetches.push(url);
  return jwks;
};

async function makeKey() {
  return crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
}

async function sign(
  claims: Json = {},
  opts: { key?: CryptoKeyPair; kid?: string; alg?: string; header?: Json } = {},
): Promise<string> {
  const header = b64url(JSON.stringify({ alg: opts.alg ?? "RS256", kid: opts.kid ?? "key-1", typ: "JWT", ...opts.header }));
  const seconds = Math.floor(NOW.getTime() / 1000);
  const payload = b64url(
    JSON.stringify({ iss: TEAM, aud: [AUD], email: OWNER, iat: seconds - 10, nbf: seconds - 10, exp: seconds + 3600, sub: "u1", ...claims }),
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", (opts.key ?? teamKey).privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

beforeAll(async () => {
  teamKey = await makeKey();
  strangerKey = await makeKey();
  const pub = (await crypto.subtle.exportKey("jwk", teamKey.publicKey)) as Json;
  jwks = [{ kid: "key-1", kty: "RSA", alg: "RS256", n: pub.n, e: pub.e }];
});

// --- Fixtures -------------------------------------------------------------------
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
  sizes: ["S"],
  stock: { S: 9 },
  image: "",
  imageAlt: "",
  badge: null,
  active: true,
};
const SNAPSHOT: CatalogSnapshot = {
  generatedAt: "2026-11-28T00:00:00.000Z",
  products: [product],
  categories: ["Rompers"],
  config: { announcementBar: "", featuredSkus: [], heroOrder: [], paymentsCardEnabled: false, paymentsTransferEnabled: true, transferInstructions: "" },
};
const JPEG = (() => {
  const b = new Uint8Array(64);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
})();
const PDF = new TextEncoder().encode("%PDF-1.7\ntest\n");

let db: OrdersDb;
let raw: DatabaseSync;
let store: ReturnType<typeof makeBucket>;
let ipCounter = 0;
// The catalog the portal reads to check stock before bringing an order back.
let catalog: CatalogSnapshot | null = SNAPSHOT;
let extraEnv: Json = {};
const env = () => ({
  ORDERS_DB: db,
  PROOFS: store.bucket,
  ACCESS_TEAM_DOMAIN: TEAM,
  ACCESS_AUD: AUD,
  AFP_CATALOG: { get: async () => (catalog ? JSON.stringify(catalog) : null) },
  ...extraEnv,
});

beforeEach(() => {
  ({ db, raw } = makeDb());
  store = makeBucket();
  clearAccessKeyCache();
  keyFetches = [];
  catalog = SNAPSHOT;
  extraEnv = {};
});

async function placeOrder(opts: { proof?: Uint8Array | false; name?: string; optIn?: boolean; now?: Date } = {}) {
  ipCounter += 1;
  const ip = `203.0.113.${ipCounter % 250}`;
  const res = await createOrder(
    new Request(`${ORIGIN}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify({
        items: [{ sku: "LV-romper", size: "S", quantity: 1 }],
        fulfillment: "delivery",
        customer: { name: opts.name ?? "Test Customer", phone: "2465550100", email: "customer@example.com", address: "12 Test Road, St Michael" },
        marketingOptIn: opts.optIn,
      }),
    }),
    env(),
    SNAPSHOT,
    opts.now ?? NOW,
  );
  const data = (await res.json()) as Json;
  const ref = data.order.ref as string;
  const token = data.token as string;
  if (opts.proof !== false) {
    const form = new FormData();
    form.set("method", "cibc_qr");
    form.set("file", new File([opts.proof ?? JPEG], "p.jpg"));
    await uploadProof(
      new Request(`${ORIGIN}/api/orders/${ref}/proof`, { method: "POST", headers: { "x-order-token": token, "cf-connecting-ip": ip }, body: form }),
      env(),
      ref,
      opts.now ?? NOW,
    );
  }
  return { ref, token };
}

async function admin(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null; headers?: Record<string, string>; now?: Date; raw?: boolean } = {},
) {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = {};
  // A fresh sign-in for whenever this request is made.
  const at = Math.floor((opts.now ?? NOW).getTime() / 1000);
  const token = opts.token === undefined ? await sign({ iat: at - 10, nbf: at - 10, exp: at + 3600 }) : opts.token;
  if (token) headers["cf-access-jwt-assertion"] = token;
  if (method === "POST") {
    headers.origin = ORIGIN;
    headers["content-type"] = "application/json";
    headers["x-afp-admin"] = "1";
  }
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    if (v === "") delete headers[k];
    else headers[k] = v;
  }
  const res = await handleAdmin(
    new Request(`${ORIGIN}/api/admin/${path}`, { method, headers, body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined }),
    env(),
    path.split("?")[0],
    opts.now ?? NOW,
    keyFetcher,
  );
  return { res, data: opts.raw ? ({} as Json) : ((await res.json()) as Json) };
}

const customerView = async (ref: string, token: string, now = NOW) =>
  (await (await getOrder(new Request(`${ORIGIN}/api/orders/${ref}`, { headers: { "x-order-token": token } }), env(), ref, now)).json()) as Json;
const auditRows = () => raw.prepare("SELECT actor, action, order_ref, detail FROM audit_log ORDER BY id").all() as Json[];
const orderRow = (ref: string) => raw.prepare("SELECT * FROM orders WHERE ref = ?").get(ref) as Json;

// ---------------------------------------------------------------------------------
describe("the lock: verifying the Cloudflare Access token", () => {
  const check = async (token: string | null, envOverride: Json = {}) => {
    const headers: Record<string, string> = token ? { "cf-access-jwt-assertion": token } : {};
    return verifyAccess(new Request(`${ORIGIN}/api/admin/me`, { headers }), { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ...envOverride }, NOW, keyFetcher);
  };

  it("accepts a properly signed token for each allowed address", async () => {
    for (const email of ADMIN_EMAILS) expect(await check(await sign({ email }))).toEqual({ email });
    expect(await check(await sign({ email: "AloFitnessPro@Outlook.com" }))).toEqual({ email: OWNER });
    expect(keyFetches[0]).toBe(`${TEAM}/cdn-cgi/access/certs`);
  });

  it("refuses every kind of bad token", async () => {
    const seconds = Math.floor(NOW.getTime() / 1000);
    const good = await sign();
    const [h, p, s] = good.split(".");
    const forgedPayload = b64url(JSON.stringify({ iss: TEAM, aud: [AUD], email: OWNER, exp: seconds + 3600 }));
    const bad: Record<string, string | null> = {
      "no token": null,
      "empty token": "",
      "not a token": "hello",
      "tampered payload": `${h}.${forgedPayload}.${s}`,
      "tampered signature": `${h}.${p}.${s.slice(0, -4)}AAAA`,
      "signed by someone else's key": await sign({}, { key: strangerKey }),
      "unknown key id": await sign({}, { kid: "key-99" }),
      "unsigned (alg none)": `${b64url(JSON.stringify({ alg: "none", kid: "key-1" }))}.${p}.`,
      "wrong algorithm claimed": await sign({}, { alg: "HS256" }),
      expired: await sign({ exp: seconds - 1 }),
      "no expiry": await sign({ exp: undefined }),
      "not valid yet": await sign({ nbf: seconds + 600 }),
      "wrong audience": await sign({ aud: ["b".repeat(64)] }),
      "wrong issuer": await sign({ iss: "https://evil.cloudflareaccess.com" }),
      "email not on the list": await sign({ email: "someone@example.com" }),
      "no email": await sign({ email: undefined }),
      "lookalike email": await sign({ email: `${OWNER}.evil.example` }),
    };
    for (const [name, token] of Object.entries(bad)) {
      expect(await check(token), name).toBeNull();
    }
  });

  it("never fetches keys from an address the token supplies", async () => {
    await check(await sign({ iss: "https://evil.example" }, { header: { jku: "https://evil.example/keys", x5u: "https://evil.example/cert" } }));
    expect(keyFetches.every((u) => u === `${TEAM}/cdn-cgi/access/certs`)).toBe(true);
  });

  it("fails closed when Access is not configured or its keys cannot be fetched", async () => {
    const token = await sign();
    expect(await check(token, { ACCESS_TEAM_DOMAIN: "" })).toBeNull();
    expect(await check(token, { ACCESS_AUD: "" })).toBeNull();
    expect(await check(token, { ACCESS_TEAM_DOMAIN: "http://afp-test.cloudflareaccess.com" })).toBeNull();
    clearAccessKeyCache();
    const failing: KeyFetcher = async () => {
      throw new Error("network down");
    };
    expect(await verifyAccess(new Request(ORIGIN, { headers: { "cf-access-jwt-assertion": token } }), { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }, NOW, failing)).toBeNull();
  });

  it("does not trust a plain email header, with or without a token", async () => {
    const forged = { "cf-access-authenticated-user-email": OWNER, "x-forwarded-email": OWNER, cookie: "CF_Authorization=anything" };
    expect(await verifyAccess(new Request(ORIGIN, { headers: forged }), { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }, NOW, keyFetcher)).toBeNull();
    const stranger = await sign({ email: "someone@example.com" });
    expect(
      await verifyAccess(new Request(ORIGIN, { headers: { ...forged, "cf-access-jwt-assertion": stranger } }), { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }, NOW, keyFetcher),
    ).toBeNull();
  });

  it("picks up a rotated key without waiting for the cache to age", async () => {
    await check(await sign()); // caches key-1
    const next = await makeKey();
    const pub = (await crypto.subtle.exportKey("jwk", next.publicKey)) as Json;
    const original = jwks;
    jwks = [...jwks, { kid: "key-2", kty: "RSA", n: pub.n, e: pub.e }];
    try {
      expect(await check(await sign({}, { key: next, kid: "key-2" }))).toEqual({ email: OWNER });
    } finally {
      jwks = original;
    }
  });
});

describe("every admin route is behind the lock", () => {
  it("gives the same refusal on every route for every kind of failure", async () => {
    const { ref } = await placeOrder();
    const seconds = Math.floor(NOW.getTime() / 1000);
    const tokens: (string | null)[] = [
      null,
      "garbage",
      await sign({ exp: seconds - 1 }),
      await sign({ aud: ["b".repeat(64)] }),
      await sign({ email: "someone@example.com" }),
      await sign({}, { key: strangerKey }),
    ];
    const gets = ["me", "summary", "orders", "orders?view=needs", `orders/${ref}`, `orders/${ref}/proof`, "settings", "audit", "nonsense"];
    const posts = [`orders/${ref}/paid`, `orders/${ref}/reject`, `orders/${ref}/delivered`, `orders/${ref}/cancel`, `orders/${ref}/recorded`, "settings/bank", "settings/bank/clear", "settings/pickup"];
    for (const token of tokens) {
      for (const path of gets) {
        const { res, data } = await admin(path, { token });
        expect(res.status, `GET ${path}`).toBe(403);
        expect(data).toEqual({ error: "Please sign in to the AFP portal." });
      }
      for (const path of posts) {
        const { res, data } = await admin(path, { token, body: { confirmed: true, reason: "x".repeat(10), ...BANK } });
        expect(res.status, `POST ${path}`).toBe(403);
        expect(data).toEqual({ error: "Please sign in to the AFP portal." });
      }
    }
    // Nothing changed, nothing was logged as an admin, no bank details were saved.
    expect(orderRow(ref).status).toBe("proof_uploaded");
    expect(raw.prepare("SELECT COUNT(*) AS n FROM settings").get()).toEqual({ n: 0 });
    expect(auditRows().every((r) => r.actor === "customer")).toBe(true);
  });

  it("is refused through the real Worker entry too, and when Access is not configured", async () => {
    const { ref } = await placeOrder();
    const call = (path: string, headers: Record<string, string> = {}, extraEnv: Json = {}) =>
      worker.fetch(
        new Request(`${ORIGIN}${path}`, { headers }),
        { ORDERS_DB: db, PROOFS: store.bucket, ASSETS: { fetch: async () => new Response("asset") }, ...extraEnv } as never,
        {} as never,
      );
    // Deployed without Access settings: locked, even with a correctly signed token.
    expect((await call("/api/admin/me", { "cf-access-jwt-assertion": await sign() })).status).toBe(403);
    expect((await call(`/api/admin/orders/${ref}/proof`)).status).toBe(403);
    expect((await call("/api/admin/orders", { "cf-access-authenticated-user-email": OWNER })).status).toBe(403);
  });

  it("tells a signed-in admin who they are", async () => {
    const { res, data } = await admin("me");
    expect(res.status).toBe(200);
    expect(data).toEqual({ email: OWNER });
  });
});

describe("changes must come from the portal's own pages", () => {
  it("refuses cross-site, header-less and non-JSON writes, and GET never changes anything", async () => {
    const { ref } = await placeOrder();
    const body = { confirmed: true };
    const cases: [Record<string, string>, number][] = [
      [{ origin: "https://evil.example" }, 403],
      [{ origin: "" }, 403], // no Origin at all
      [{ origin: "null" }, 403],
      [{ "x-afp-admin": "" }, 403],
      [{ "content-type": "text/plain" }, 415],
      [{ "content-type": "application/x-www-form-urlencoded" }, 415],
    ];
    for (const [headers, status] of cases) {
      expect((await admin(`orders/${ref}/paid`, { body, headers })).res.status).toBe(status);
    }
    expect((await admin(`orders/${ref}/paid`, { method: "GET" })).res.status).toBe(404);
    const put = await handleAdmin(
      new Request(`${ORIGIN}/api/admin/orders/${ref}/paid`, { method: "PUT", headers: { "cf-access-jwt-assertion": await sign() } }),
      env(),
      `orders/${ref}/paid`,
      NOW,
      keyFetcher,
    );
    expect(put.status).toBe(405);
    expect(orderRow(ref).status).toBe("proof_uploaded");
  });

  it("slows a burst of changes", async () => {
    const { ref } = await placeOrder();
    let last = 200;
    for (let i = 0; i < 31; i += 1) last = (await admin(`orders/${ref}/delivered`, { body: {} })).res.status;
    expect(last).toBe(429);
  });
});

describe("moving an order", () => {
  it("mark paid needs the bank-check confirmation, works once, and logs once", async () => {
    const { ref, token } = await placeOrder();
    expect((await admin(`orders/${ref}/paid`, { body: {} })).res.status).toBe(400);
    expect((await admin(`orders/${ref}/paid`, { body: { confirmed: "yes" } })).res.status).toBe(400);
    expect(orderRow(ref).status).toBe("proof_uploaded");

    const [a, b] = await Promise.all([
      admin(`orders/${ref}/paid`, { body: { confirmed: true } }),
      admin(`orders/${ref}/paid`, { body: { confirmed: true }, token: await sign({ email: ADMIN_EMAILS[1] }) }),
    ]);
    expect([a.res.status, b.res.status].sort()).toEqual([200, 409]);
    expect((await admin(`orders/${ref}/paid`, { body: { confirmed: true } })).res.status).toBe(409);

    expect(orderRow(ref)).toMatchObject({ status: "paid", paid_at: NOW.toISOString() });
    const paidLogs = auditRows().filter((r) => r.action === "order_paid");
    expect(paidLogs).toHaveLength(1);
    expect(paidLogs[0]).toMatchObject({ order_ref: ref, detail: "proof_uploaded -> paid" });
    expect(ADMIN_EMAILS).toContain(paidLogs[0].actor);
    // The customer now sees it as paid, and the stock stays held until it is in Loyverse.
    expect((await customerView(ref, token)).order.status).toBe("paid");
    expect((await loadHolds(db, NOW)).get(holdKey("LV-romper", "S"))).toBe(1);
  });

  it("rejecting needs a reason, shows it to the customer and releases the stock", async () => {
    const { ref, token } = await placeOrder();
    expect((await admin(`orders/${ref}/reject`, { body: {} })).res.status).toBe(400);
    expect((await admin(`orders/${ref}/reject`, { body: { reason: "  " } })).res.status).toBe(400);
    expect((await loadHolds(db, NOW)).get(holdKey("LV-romper", "S"))).toBe(1);

    const { res } = await admin(`orders/${ref}/reject`, { body: { reason: "The amount received did not match the order total." } });
    expect(res.status).toBe(200);
    const seen = await customerView(ref, token);
    expect(seen.order).toMatchObject({ status: "rejected", rejectedReason: "The amount received did not match the order total." });
    expect((await loadHolds(db, NOW)).size).toBe(0);
    expect(auditRows().at(-1)).toMatchObject({ actor: OWNER, action: "order_rejected", order_ref: ref });
  });

  it("allows only the listed moves from each status", async () => {
    const allowed: Record<string, string[]> = {
      reserved: ["cancel"],
      proof_uploaded: ["paid", "reject", "cancel"],
      paid: ["delivered"],
      delivered: [],
      expired: [],
      rejected: [],
      cancelled: [],
    };
    for (const [status, ok] of Object.entries(allowed)) {
      for (const move of ["paid", "reject", "delivered", "cancel"]) {
        ({ db, raw } = makeDb());
        const { ref } = await placeOrder({ proof: false });
        raw.prepare("UPDATE orders SET status = ?").run(status);
        const { res } = await admin(`orders/${ref}/${move}`, { body: { confirmed: true, reason: "test reason" } });
        expect(res.status, `${status} -> ${move}`).toBe(ok.includes(move) ? 200 : 409);
        expect(orderRow(ref).status !== status, `${status} -> ${move}`).toBe(ok.includes(move));
        expect(auditRows().filter((r) => r.actor === OWNER)).toHaveLength(ok.includes(move) ? 1 : 0);
      }
    }
  });

  it("cannot cancel a reservation that has already run out of time", async () => {
    const { ref } = await placeOrder({ proof: false });
    expect((await admin(`orders/${ref}/cancel`, { body: {}, now: later(61) })).res.status).toBe(409);
    expect((await admin(`orders/${ref}/cancel`, { body: {}, now: later(30) })).res.status).toBe(200);
    expect(orderRow(ref).closed_reason).toBe("cancelled by AFP");
  });

  it("goes paid to delivered, and unknown orders or actions are not found", async () => {
    const { ref } = await placeOrder();
    await admin(`orders/${ref}/paid`, { body: { confirmed: true } });
    const { res, data } = await admin(`orders/${ref}/delivered`, { body: {} });
    expect(res.status).toBe(200);
    expect(data.order.status).toBe("delivered");
    expect((await admin("orders/AFP-20261128-999/paid", { body: { confirmed: true } })).res.status).toBe(404);
    expect((await admin(`orders/${ref}/refund`, { body: {} })).res.status).toBe(404);
    expect((await admin(`orders/${ref}/__proto__`, { body: {} })).res.status).toBe(404);
  });

  it("'rung up at the till' releases the website's hold, once", async () => {
    const { ref } = await placeOrder();
    expect((await admin(`orders/${ref}/recorded`, { body: {} })).res.status).toBe(409); // not paid yet
    await admin(`orders/${ref}/paid`, { body: { confirmed: true } });
    expect((await admin(`orders/${ref}`)).data.order.needsLoyverse).toBe(true);
    expect((await admin(`orders/${ref}/recorded`, { body: {} })).res.status).toBe(200);
    expect((await admin(`orders/${ref}/recorded`, { body: {} })).res.status).toBe(409);
    expect((await admin(`orders/${ref}`)).data.order.needsLoyverse).toBe(false);
    expect((await loadHolds(db, NOW)).size).toBe(0);
    expect(auditRows().filter((r) => r.action === "order_recorded_in_loyverse")).toHaveLength(1);
  });
});

describe("the audit log", () => {
  it("cannot be changed or deleted, by the API or in the database", async () => {
    const { ref } = await placeOrder();
    await admin(`orders/${ref}/paid`, { body: { confirmed: true } });
    const before = auditRows();
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const res = await handleAdmin(
        new Request(`${ORIGIN}/api/admin/audit`, {
          method,
          headers: { "cf-access-jwt-assertion": await sign(), origin: ORIGIN, "content-type": "application/json", "x-afp-admin": "1" },
          body: "{}",
        }),
        env(),
        "audit",
        NOW,
        keyFetcher,
      );
      expect([404, 405]).toContain(res.status);
    }
    expect(() => raw.exec("UPDATE audit_log SET actor = 'nobody'")).toThrow(/append-only/);
    expect(() => raw.exec("DELETE FROM audit_log")).toThrow(/append-only/);
    expect(auditRows()).toEqual(before);
    const { data } = await admin("audit");
    expect(data.entries[0]).toMatchObject({ actor: OWNER, action: "order_paid", orderRef: ref });
  });
});

describe("viewing a proof", () => {
  it("is served only to an admin, with headers that stop it running", async () => {
    const { ref, token } = await placeOrder();
    const res = (await admin(`orders/${ref}/proof`, { raw: true })).res;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-disposition")).toBe(`inline; filename="proof-${ref}.jpg"`);
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);

    // The customer's own token is not an admin pass.
    const asCustomer = await handleAdmin(
      new Request(`${ORIGIN}/api/admin/orders/${ref}/proof`, { headers: { "x-order-token": token } }),
      env(),
      `orders/${ref}/proof`,
      NOW,
      keyFetcher,
    );
    expect(asCustomer.status).toBe(403);
  });

  it("sends a PDF as a download, and anything unexpected as an opaque file", async () => {
    const pdf = await placeOrder({ proof: PDF });
    const res = (await admin(`orders/${pdf.ref}/proof`, { raw: true })).res;
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="proof-${pdf.ref}.pdf"`);

    const odd = await placeOrder();
    const key = orderRow(odd.ref).proof_key as string;
    await store.bucket.put(key, new TextEncoder().encode("<script>alert(1)</script>"), { httpMetadata: { contentType: "text/html" } });
    const oddRes = (await admin(`orders/${odd.ref}/proof`, { raw: true })).res;
    expect(oddRes.headers.get("content-type")).toBe("application/octet-stream");
    expect(oddRes.headers.get("content-disposition")).toContain("attachment");
  });

  it("is not found when an order has no proof", async () => {
    const { ref } = await placeOrder({ proof: false });
    expect((await admin(`orders/${ref}/proof`)).res.status).toBe(404);
  });
});

describe("lists, search and totals", () => {
  it("puts what needs her first and never leaks internal fields", async () => {
    const waiting = await placeOrder({ name: "Alice Waiting" });
    const reservedOnly = await placeOrder({ name: "Bob Reserved", proof: false });
    const paid = await placeOrder({ name: "Carla Paid", now: later(1) });
    await admin(`orders/${paid.ref}/paid`, { body: { confirmed: true }, now: later(2) });

    const needs = (await admin("orders?view=needs", { now: later(3) })).data.orders as Json[];
    expect(needs.map((o) => o.customerName)).toEqual(["Alice Waiting", "Carla Paid"]);
    const all = (await admin("orders", { now: later(3) })).data;
    expect(all.orders).toHaveLength(3);
    const text = JSON.stringify(all);
    for (const hidden of ["token_hash", "client_hash", "proof_key", "proofs/"]) expect(text).not.toContain(hidden);

    expect((await admin("orders?view=reserved", { now: later(3) })).data.orders.map((o: Json) => o.ref)).toEqual([reservedOnly.ref]);
    // After its hour, an unpaid reservation shows as run out of time, even before the cron tidies it.
    const lateList = (await admin("orders?view=expired", { now: later(90) })).data.orders as Json[];
    expect(lateList.map((o) => [o.ref, o.status])).toEqual([[reservedOnly.ref, "expired"]]);
    expect((await admin("orders?view=bogus")).res.status).toBe(400);
    expect(waiting.ref).toBeTruthy();
  });

  it("searches by reference, name, phone or email, treating wildcards as plain text", async () => {
    const a = await placeOrder({ name: "Alice Waiting" });
    await placeOrder({ name: "Bob 100% Sure" });
    const find = async (q: string) => ((await admin(`orders?q=${encodeURIComponent(q)}`)).data.orders as Json[]).map((o) => o.customerName);
    expect(await find(a.ref)).toEqual(["Alice Waiting"]);
    expect(await find("alice")).toEqual(["Alice Waiting"]);
    expect((await find("2465550100")).length).toBe(2);
    expect((await find("customer@example.com")).length).toBe(2);
    expect(await find("100%")).toEqual(["Bob 100% Sure"]);
    expect(await find("%")).toEqual(["Bob 100% Sure"]);
    expect(await find("' OR 1=1 --")).toEqual([]);
  });

  it("counts money only from paid orders, by the Barbados day", async () => {
    await placeOrder(); // proof waiting: not money yet
    await placeOrder({ proof: false }); // held, unpaid
    const paid = await placeOrder();
    await admin(`orders/${paid.ref}/paid`, { body: { confirmed: true } });
    const yesterday = await placeOrder();
    await admin(`orders/${yesterday.ref}/paid`, { body: { confirmed: true } });
    // 03:30 UTC on the 28th is still the 27th in Barbados.
    raw.prepare("UPDATE orders SET paid_at = '2026-11-28T03:30:00.000Z' WHERE ref = ?").run(yesterday.ref);

    const { data } = await admin("summary");
    expect(data).toMatchObject({ proofsWaiting: 1, toDeliver: 2, heldUnpaid: 1, needsLoyverse: 2, paidTodayCount: 1, paidTodayCents: 14500 });
  });

  it("shows the full order to an admin, including the customer's marketing choice", async () => {
    const yes = await placeOrder({ optIn: true });
    const no = await placeOrder();
    const detail = (await admin(`orders/${yes.ref}`)).data.order;
    expect(detail).toMatchObject({
      customerName: "Test Customer",
      customerPhone: "2465550100",
      customerEmail: "customer@example.com",
      deliveryAddress: "12 Test Road, St Michael",
      marketingOptIn: true,
      hasProof: true,
      totalCents: 14500,
    });
    expect(detail.items).toHaveLength(1);
    expect(detail.history.map((h: Json) => h.action)).toEqual(["order_reserved", "proof_uploaded"]);
    expect((await admin(`orders/${no.ref}`)).data.order.marketingOptIn).toBe(false);
    expect(orderRow(yes.ref).marketing_opt_in_at).toBe(NOW.toISOString());
    expect(orderRow(no.ref).marketing_opt_in_at).toBeNull();
  });
});

describe("marketing consent", () => {
  const base = { items: [{ sku: "x", size: "S", quantity: 1 }], fulfillment: "pickup", customer: { name: "Test", phone: "2465550100", email: "t@example.com" } };
  it("is a yes only when explicitly ticked", () => {
    for (const [value, expected] of [[true, true], [undefined, false], [false, false], ["true", false], [1, false], ["on", false]] as const) {
      const parsed = parseOrderInput({ ...base, marketingOptIn: value });
      expect(parsed.ok && parsed.value.marketingOptIn).toBe(expected);
    }
  });
});

describe("settings", () => {
  it("validates bank details and masks the account number", () => {
    expect(parseBankInput(BANK)).toEqual({ ok: true, value: { ...BANK, swift: "TESTBB00" } });
    expect(parseBankInput({ ...BANK, swift: "" }).ok).toBe(true);
    for (const bad of [{ ...BANK, bank: "" }, { ...BANK, accountName: "" }, { ...BANK, accountNumber: "abc" }, { ...BANK, accountNumber: "12" }, { ...BANK, swift: "TOO-SHORT" }, null]) {
      expect(parseBankInput(bad).ok).toBe(false);
    }
    expect(maskAccountNumber("000111222333")).toBe("•••• 2333");
    expect(maskAccountNumber("0001 1122 2333")).toBe("•••• 2333");
    expect(maskAccountNumber("123")).toBe("••••");
  });

  it("saves bank details without ever returning or logging the account number", async () => {
    const logs: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(" "))),
    );
    try {
      expect((await admin("settings")).data.bank).toBeNull();
      const { res, data } = await admin("settings/bank", { body: BANK });
      expect(res.status).toBe(200);
      expect(data.bank).toMatchObject({ bank: "Test Bank", accountName: "AFP Test", accountNumberMasked: "•••• 2333", swift: "TESTBB00", updatedBy: OWNER });
      const again = JSON.stringify((await admin("settings")).data);
      const everything = [JSON.stringify(data), again, JSON.stringify(auditRows()), JSON.stringify((await admin("audit")).data), logs.join("\n")].join("\n");
      expect(everything).not.toContain("000111222333");
      expect(auditRows().at(-1)).toMatchObject({ actor: OWNER, action: "settings_changed", detail: "bank details updated", order_ref: null });
      expect((await admin("settings/bank", { body: { ...BANK, accountNumber: "nope" } })).res.status).toBe(400);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it("bank details reach a paying customer with their token, and no one else", async () => {
    await admin("settings/bank", { body: BANK });
    const { ref, token } = await placeOrder({ proof: false });
    expect((await customerView(ref, token)).payment.bank.accountNumber).toBe("000111222333");
    const stranger = await getOrder(new Request(`${ORIGIN}/api/orders/${ref}`, { headers: { "x-order-token": "f".repeat(64) } }), env(), ref, NOW);
    expect(await stranger.text()).not.toContain("000111222333");
    expect(await (await checkoutConfig(env())).text()).not.toContain("000111222333");

    // Removing them hides bank transfer again.
    expect((await admin("settings/bank/clear", { body: {} })).data.bank).toBeNull();
    expect((await customerView(ref, token)).payment.bank).toBeNull();
  });

  it("pickup locations: defaults first, then the owner's list, used by checkout", async () => {
    expect(parsePickupInput({ locations: [] }).ok).toBe(false);
    expect(parsePickupInput({ locations: [{ name: "A" }] }).ok).toBe(false);
    expect(parsePickupInput({ locations: [{ name: "Same" }, { name: "same" }] }).ok).toBe(false);
    expect(parsePickupInput({ locations: Array(7).fill(0).map((_, i) => ({ name: `Place ${i}` })) }).ok).toBe(false);

    const config = async () => (await (await checkoutConfig(env())).json()) as Json;
    expect((await config()).pickupLocations).toEqual(DEFAULT_PICKUP_LOCATIONS);

    const mine = [{ name: "Sheraton Mall", address: "Christ Church", hours: "Sat 10am to 2pm" }];
    expect((await admin("settings/pickup", { body: { locations: mine } })).data.pickupLocations).toEqual(mine);
    expect((await config()).pickupLocations).toEqual(mine);

    const order = (pickupLocation: string) =>
      createOrder(
        new Request(`${ORIGIN}/api/orders`, {
          method: "POST",
          headers: { "content-type": "application/json", "cf-connecting-ip": "198.51.100.9" },
          body: JSON.stringify({ items: [{ sku: "LV-romper", size: "S", quantity: 1 }], fulfillment: "pickup", pickupLocation, customer: { name: "Test", phone: "2465550100", email: "t@example.com" } }),
        }),
        env(),
        SNAPSHOT,
        NOW,
      );
    expect((await order("AFP HQ — St Michael")).status).toBe(400); // no longer offered
    expect((await order("<img src=x onerror=alert(1)>")).status).toBe(400);
    expect((await order("Sheraton Mall")).status).toBe(201);
  });
});

// ---------------------------------------------------------------------------------
describe("putting a mistake right", () => {
  const withStock = (n: number): CatalogSnapshot => ({ ...SNAPSHOT, products: [{ ...product, stock: { S: n } }] });
  const held = async (now = NOW) => (await loadHolds(db, now)).get(holdKey("LV-romper", "S")) ?? 0;

  it("Mark paid can be undone for ten minutes, back to exactly where it was", async () => {
    const { ref, token } = await placeOrder();
    const paid = await admin(`orders/${ref}/paid`, { body: { confirmed: true } });
    expect(paid.data.order.undoUntil).toBe(later(10).toISOString());

    const undo = await admin(`orders/${ref}/undo`, { body: {}, now: later(9) });
    expect(undo.res.status).toBe(200);
    expect(undo.data.order.status).toBe("proof_uploaded");
    expect(undo.data.order.undoUntil).toBeNull();
    expect(orderRow(ref).paid_at).toBeNull();
    expect((await customerView(ref, token, later(9))).order.status).toBe("proof_uploaded");
    expect(await held(later(9))).toBe(1); // never stopped being held
    expect(auditRows().at(-1)).toMatchObject({ actor: OWNER, action: "order_undone", detail: "paid -> proof_uploaded (undo)" });

    // Undo is not a toggle: there is nothing left to undo.
    expect((await admin(`orders/${ref}/undo`, { body: {}, now: later(9) })).res.status).toBe(409);
    // And she can mark it paid again, properly.
    expect((await admin(`orders/${ref}/paid`, { body: { confirmed: true }, now: later(9) })).data.order.status).toBe("paid");
  });

  it("the chance to undo ends after ten minutes, when delivered, or once rung up in Loyverse", async () => {
    const a = await placeOrder();
    await admin(`orders/${a.ref}/paid`, { body: { confirmed: true } });
    const late = await admin(`orders/${a.ref}/undo`, { body: {}, now: later(11) });
    expect(late.res.status).toBe(409);
    expect(late.data.error).toBe("The time to undo this has passed.");
    expect((await admin(`orders/${a.ref}`, { now: later(11) })).data.order.undoUntil).toBeNull();

    const b = await placeOrder();
    await admin(`orders/${b.ref}/paid`, { body: { confirmed: true } });
    await admin(`orders/${b.ref}/delivered`, { body: {}, now: later(1) });
    expect((await admin(`orders/${b.ref}/undo`, { body: {}, now: later(2) })).res.status).toBe(409);
    expect(orderRow(b.ref).status).toBe("delivered");

    const c = await placeOrder();
    await admin(`orders/${c.ref}/paid`, { body: { confirmed: true } });
    await admin(`orders/${c.ref}/recorded`, { body: {}, now: later(1) });
    expect((await admin(`orders/${c.ref}`, { now: later(2) })).data.order.undoUntil).toBeNull();
    expect((await admin(`orders/${c.ref}/undo`, { body: {}, now: later(2) })).res.status).toBe(409);
    expect(orderRow(c.ref).status).toBe("paid");
  });

  it("Reject and Cancel can be undone, and the items are held again", async () => {
    const a = await placeOrder();
    await admin(`orders/${a.ref}/reject`, { body: { reason: "Wrong order, sorry" } });
    expect(await held()).toBe(0);
    const undo = await admin(`orders/${a.ref}/undo`, { body: {}, now: later(3) });
    expect(undo.data.order.status).toBe("proof_uploaded");
    expect(undo.data.order.closedReason).toBe("");
    expect(await held(later(3))).toBe(1);

    // A cancelled reservation goes back to waiting for payment, with its original deadline.
    const b = await placeOrder({ proof: false });
    await admin(`orders/${b.ref}/cancel`, { body: {} });
    const back = await admin(`orders/${b.ref}/undo`, { body: {}, now: later(5) });
    expect(back.data.order.status).toBe("reserved");
    expect(back.data.order.expiresAt).toBe(later(60).toISOString());
  });

  it("an undo can never sell the last piece twice", async () => {
    catalog = withStock(1);
    const first = await placeOrder();
    await admin(`orders/${first.ref}/reject`, { body: { reason: "No payment found" } });
    // The piece is free again and someone else takes it.
    const res = await createOrder(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "198.51.100.9" },
        body: JSON.stringify({ items: [{ sku: "LV-romper", size: "S", quantity: 1 }], fulfillment: "delivery", customer: { name: "Second Buyer", phone: "2465550111", email: "b@example.com", address: "1 Other Road" } }),
      }),
      env(),
      catalog,
      later(2),
    );
    expect(res.status).toBe(201);

    const undo = await admin(`orders/${first.ref}/undo`, { body: {}, now: later(3) });
    expect(undo.res.status).toBe(409);
    expect(undo.data.error).toMatch(/sold or held for someone else/);
    expect(orderRow(first.ref).status).toBe("rejected");
    expect(await held(later(3))).toBe(1);
    expect(auditRows().filter((r) => r.action === "order_undone")).toHaveLength(0);
  });

  it("nothing is brought back when the stock cannot be checked", async () => {
    const { ref } = await placeOrder();
    await admin(`orders/${ref}/reject`, { body: { reason: "No payment found" } });
    catalog = null;
    const undo = await admin(`orders/${ref}/undo`, { body: {}, now: later(1) });
    expect(undo.res.status).toBe(503);
    expect(orderRow(ref).status).toBe("rejected");
  });

  it("two taps on Undo, or two admins, undo once and log once", async () => {
    const { ref } = await placeOrder();
    await admin(`orders/${ref}/paid`, { body: { confirmed: true } });
    const both = await Promise.all([
      admin(`orders/${ref}/undo`, { body: {}, now: later(1) }),
      admin(`orders/${ref}/undo`, { body: {}, now: later(1), token: await sign({ email: ADMIN_EMAILS[1] }) }),
    ]);
    expect(both.map((r) => r.res.status).sort()).toEqual([200, 409]);
    expect(auditRows().filter((r) => r.action === "order_undone")).toHaveLength(1);
  });

  it("undo and reopen need a signed-in admin and a same-site request, like every change", async () => {
    const { ref, token } = await placeOrder();
    await admin(`orders/${ref}/paid`, { body: { confirmed: true } });
    expect((await admin(`orders/${ref}/undo`, { body: {}, token: null })).res.status).toBe(403);
    expect((await admin(`orders/${ref}/undo`, { body: {}, headers: { origin: "https://evil.example" } })).res.status).toBe(403);
    expect((await admin(`orders/${ref}/undo`, { method: "GET" })).res.status).toBe(404);
    // A customer's order token is not an admin pass.
    expect((await admin(`orders/${ref}/undo`, { body: {}, token: null, headers: { "x-order-token": token } })).res.status).toBe(403);
    expect(orderRow(ref).status).toBe("paid");
  });

  it("an order that ran out of time can be reopened, so the customer can still send proof", async () => {
    const { ref, token } = await placeOrder({ proof: false });
    expect((await admin(`orders/${ref}`, { now: later(61) })).data.order.canReopen).toBe(true);
    expect((await admin(`orders/${ref}/reopen`, { body: {} })).res.status).toBe(409); // still live: nothing to reopen

    const reopened = await admin(`orders/${ref}/reopen`, { body: {}, now: later(90) });
    expect(reopened.res.status).toBe(200);
    expect(reopened.data.order.status).toBe("reserved");
    expect(reopened.data.order.expiresAt).toBe(later(90 + 24 * 60).toISOString());
    expect(await held(later(91))).toBe(1);
    expect(auditRows().at(-1)).toMatchObject({ actor: OWNER, action: "order_reopened" });

    // The customer's own link works again and takes their proof. It is still not "paid".
    expect((await customerView(ref, token, later(95))).order.status).toBe("reserved");
    const form = new FormData();
    form.set("method", "cibc_qr");
    form.set("file", new File([JPEG], "p.jpg"));
    const up = await uploadProof(new Request(`${ORIGIN}/api/orders/${ref}/proof`, { method: "POST", headers: { "x-order-token": token }, body: form }), env(), ref, later(100));
    expect(up.status).toBe(200);
    expect(orderRow(ref).status).toBe("proof_uploaded");
  });

  it("reopening works after the cron has closed the order, and never oversells", async () => {
    const { expireOrders } = await import("../../worker/orders");
    catalog = withStock(1);
    const { ref } = await placeOrder({ proof: false });
    await expireOrders(env(), later(61));
    expect(orderRow(ref).status).toBe("expired");

    const other = await placeOrder({ proof: false, now: later(62) });
    const refused = await admin(`orders/${ref}/reopen`, { body: {}, now: later(63) });
    expect(refused.res.status).toBe(409);
    expect(refused.data.error).toMatch(/sold or held for someone else/);
    expect(orderRow(ref).status).toBe("expired");

    // Once the other order lets go, it can be reopened.
    await admin(`orders/${other.ref}/cancel`, { body: {}, now: later(64) });
    expect((await admin(`orders/${ref}/reopen`, { body: {}, now: later(80) })).data.order.status).toBe("reserved");
    // Paid, rejected and cancelled orders cannot be "reopened".
    expect((await admin(`orders/${other.ref}/reopen`, { body: {}, now: later(80) })).res.status).toBe(409);
  });

  it("the same proof file sent for two orders is pointed out on both", async () => {
    const a = await placeOrder({ name: "First Person" });
    const b = await placeOrder({ name: "Second Person" });
    const different = new Uint8Array(JPEG);
    different[20] = 7;
    const c = await placeOrder({ name: "Third Person", proof: different });

    expect((await admin(`orders/${a.ref}`)).data.order.sameProofAs).toEqual([{ ref: b.ref, customerName: "Second Person" }]);
    expect((await admin(`orders/${b.ref}`)).data.order.sameProofAs).toEqual([{ ref: a.ref, customerName: "First Person" }]);
    expect((await admin(`orders/${c.ref}`)).data.order.sameProofAs).toEqual([]);
    // The fingerprint itself is never sent to the portal or the customer.
    const hash = orderRow(a.ref).proof_hash as string;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify((await admin(`orders/${a.ref}`)).data)).not.toContain(hash);
    expect(JSON.stringify(await customerView(a.ref, a.token))).not.toContain(hash);
  });

  it("she can note a different amount in the bank; it is logged and changes nothing else", async () => {
    const { ref } = await placeOrder();
    const short = await admin(`orders/${ref}/received`, { body: { amountCents: 10000 } });
    expect(short.data.order.receivedCents).toBe(10000);
    expect(short.data.order.status).toBe("proof_uploaded");
    expect(auditRows().at(-1)).toMatchObject({ action: "payment_noted", detail: "BDS $100.00 seen in the bank for an order of BDS $145.00: BDS $45.00 short" });
    await admin(`orders/${ref}/received`, { body: { amountCents: 15000 } });
    expect(auditRows().at(-1).detail).toMatch(/BDS \$5\.00 over$/);

    for (const bad of [-1, 10.5, "100", null, 99_999_999]) {
      expect((await admin(`orders/${ref}/received`, { body: { amountCents: bad } })).res.status).toBe(400);
    }
    // Noting an amount never marks an order paid: that still needs the bank-check tick.
    expect((await admin(`orders/${ref}/paid`, { body: {} })).res.status).toBe(400);
    // A closed order takes no note.
    await admin(`orders/${ref}/cancel`, { body: {} });
    expect((await admin(`orders/${ref}/received`, { body: { amountCents: 14500 } })).res.status).toBe(409);
  });

  it("the home screen counts paid orders left un-rung-up for more than a day", async () => {
    const { ref } = await placeOrder();
    await admin(`orders/${ref}/paid`, { body: { confirmed: true } });
    expect((await admin("summary", { now: later(23 * 60) })).data.loyverseOverdue).toBe(0);
    expect((await admin("summary", { now: later(25 * 60) })).data.loyverseOverdue).toBe(1);
    await admin(`orders/${ref}/recorded`, { body: {}, now: later(25 * 60) });
    expect((await admin("summary", { now: later(26 * 60) })).data.loyverseOverdue).toBe(0);
  });

  it("a customer email about a move waits out the undo window, and an undo withdraws it", async () => {
    const { flushOutbox } = await import("../../worker/email");
    const sent: Json[] = [];
    extraEnv = { CUSTOMER_EMAILS: "on", EMAIL: { send: async (m: Json) => void sent.push(m) }, EMAIL_FROM: "orders@alofitnesspro.com" };
    const a = await placeOrder();
    await flushOutbox(env(), NOW);
    sent.length = 0;

    await admin(`orders/${a.ref}/paid`, { body: { confirmed: true } });
    await flushOutbox(env(), later(5));
    expect(sent.filter((m) => /Payment confirmed/.test(m.subject))).toHaveLength(0); // still undoable: not sent
    await admin(`orders/${a.ref}/undo`, { body: {}, now: later(6) });
    await flushOutbox(env(), later(30));
    expect(sent.filter((m) => /Payment confirmed/.test(m.subject))).toHaveLength(0); // undone: never sent

    // Marked paid again and left alone: the customer is told once the window closes.
    await admin(`orders/${a.ref}/paid`, { body: { confirmed: true }, now: later(31) });
    await flushOutbox(env(), later(35));
    expect(sent.filter((m) => /Payment confirmed/.test(m.subject))).toHaveLength(0);
    await flushOutbox(env(), later(42));
    expect(sent.filter((m) => /Payment confirmed/.test(m.subject))).toHaveLength(1);
  });
});
