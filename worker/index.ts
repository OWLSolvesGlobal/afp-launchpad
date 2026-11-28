/**
 * AFP site Worker: serves /api/catalog and syncs Loyverse into KV.
 *
 *   Loyverse POS ──(cron, every 5 min)── scheduled() ──► KV "catalog:v1"
 *                                                    │
 *   GET /api/catalog ◄── fetch() ────────────────────┘  (seed JSON if empty)
 *
 * Loyverse is the source of truth for items, sizes, prices, stock and each
 * item's photo. Other website-only details (section, show/hide) come from
 * src/data/site-settings.json, bundled at build time. Photos are served
 * from this site at /api/image/<item id>.
 *
 * Everything that is not /api/catalog falls through to static assets, so SPA
 * routing (`assets.not_found_handling`) behaves exactly as before.
 *
 * Degrades gracefully at every step:
 *  - No KV binding / empty KV   → /api/catalog serves the bundled seed.
 *  - Token not configured       → sync logs why and exits; nothing breaks.
 *  - Loyverse fetch/parse fails → sync logs and exits; the last good
 *    snapshot in KV keeps serving.
 *  - Loyverse returns no items, or nothing sellable comes out of them
 *                               → sync refuses to overwrite the snapshot.
 *
 * The sync only ever READS from Loyverse (GET requests). It never writes.
 *
 * GET /api/catalog/status reports how the latest sync attempt went, so a
 * failed sync can be diagnosed without opening the Cloudflare dashboard.
 *
 * Orders (reserve, look up, expire) live in ./orders.ts; this file only
 * routes to them and subtracts their holds from the catalog's stock.
 */
import {
  buildLoyverseSnapshot,
  type LoyverseCategory,
  type LoyverseInventoryLevel,
  type LoyverseItem,
  type SiteSettings,
} from "../src/lib/loyverse-core";
import { applyHolds } from "../src/lib/orders-core";
import type { CatalogSnapshot } from "../src/lib/catalog-core";
import { checkoutConfig, createOrder, expireOrders, getOrder, loadHolds, type OrdersDb } from "./orders";
import { handleAdmin, type ProofReader } from "./admin";
import { flushOutbox, queueMorningSummary, type EmailSender } from "./email";
import { cancelOrder, uploadProof, type ProofBucket } from "./order-actions";
import seedCatalog from "../src/data/seed-catalog.json";
import siteSettings from "../src/data/site-settings.json";

export interface Env {
  ASSETS: Fetcher;
  /** Optional so a deployment without the namespace still serves the seed. */
  AFP_CATALOG?: KVNamespace;
  /** Orders database (D1). Optional so the shop still browses without it. */
  ORDERS_DB?: OrdersDb;
  /** Private bucket for payment proofs (R2). Never publicly readable. */
  PROOFS?: ProofBucket & ProofReader;
  /** Cloudflare Access team address and application audience tag (plain vars). */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** Cloudflare Email Sending. Absent until set up: emails wait in the outbox. */
  EMAIL?: EmailSender;
  EMAIL_FROM?: string;
  /** "on" to email customers too (needs the Workers Paid plan). */
  CUSTOMER_EMAILS?: string;
  /**
   * Loyverse access token. It lives in the account's Secrets Store under the
   * name AFPWebsite and reaches the Worker through the `secrets_store_secrets`
   * binding in wrangler.jsonc, which exposes an object with an async get().
   * A plain Worker secret of the same name (a string) is accepted too.
   */
  AFPWebsite?: string | SecretBinding;
  /** Alternative plain Worker secret, if the token is ever re-created. */
  LOYVERSE_API_TOKEN?: string;
}

interface SecretBinding {
  get(): Promise<string>;
}

/** Read the token from whichever form it was provided in. Empty -> null. */
export async function resolveToken(env: Env): Promise<string | null> {
  const source = env.AFPWebsite;
  let value: string | undefined;
  if (typeof source === "string") value = source;
  else if (source && typeof source.get === "function") value = await source.get();
  value = (value ?? "").trim() || (env.LOYVERSE_API_TOKEN ?? "").trim();
  return value || null;
}

export const KV_KEY = "catalog:v1";
/** Outcome of the most recent sync attempt, readable at /api/catalog/status. */
export const STATUS_KEY = "catalog:status";
/** Loyverse item id -> photo address at Loyverse. Private to the Worker. */
export const IMAGES_KEY = "catalog:images";

export interface SyncStatus {
  at: string;
  outcome: "ok" | "skipped" | "aborted" | "failed";
  detail: string;
  loyverseItems?: number;
  liveProducts?: number;
  /** How many Loyverse items carry a photo. */
  photos?: number;
  /** Field names Loyverse sent for an item (names only), to diagnose a zero photo count. */
  itemFields?: string[];
  notes?: string[];
}

/** Record how the sync went. Never holds the token or any response body. */
async function recordStatus(env: Env, status: Omit<SyncStatus, "at">): Promise<void> {
  try {
    await env.AFP_CATALOG?.put(STATUS_KEY, JSON.stringify({ at: new Date().toISOString(), ...status }));
  } catch {
    // Status is a diagnostic aid; failing to write it must not break the sync.
  }
}

const LOYVERSE_API = "https://api.loyverse.com/v1.0";
const PAGE_LIMIT = 250;
/** Hard stop so a paging bug can never loop: 40 pages = 10,000 records. */
const MAX_PAGES = 40;

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const response = await route(request, env);
    // An order just changed: send any emails that queued, without making the
    // customer or the owner wait for the mail service.
    const path = new URL(request.url).pathname;
    if (request.method === "POST" && (path.startsWith("/api/orders") || path.startsWith("/api/admin/"))) {
      const sending = flushOutbox(env);
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(sending);
      else await sending;
    }
    return response;
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(syncCatalog(env));
    ctx.waitUntil(
      (async () => {
        // Release stock held by orders nobody paid for within the pay window.
        await expireOrders(env).catch((err) => console.error(`order expiry failed: ${err}`));
        // Owners' morning summary (only between 8 and 9 am Barbados, only if something waits).
        await queueMorningSummary(env, new Date());
        // Send, or retry, whatever is waiting in the outbox.
        await flushOutbox(env);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  {
    const url = new URL(request.url);
    if (url.pathname === "/api/catalog") {
      const stored = await env.AFP_CATALOG?.get(KV_KEY, "text").catch(() => null);
      return new Response(await withHolds(stored, env), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=60",
          "x-afp-catalog-source": stored ? "kv" : "seed",
        },
      });
    }
    if (url.pathname.startsWith("/api/admin/")) {
      // The owner's portal. handleAdmin verifies the Access token before anything else.
      return handleAdmin(request, env, url.pathname.slice("/api/admin/".length));
    }
    if (url.pathname === "/api/checkout-config") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return checkoutConfig(env);
    }
    if (url.pathname === "/api/orders") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const stored = await env.AFP_CATALOG?.get(KV_KEY, "text").catch(() => null);
      let snapshot: CatalogSnapshot | null = null;
      try {
        snapshot = stored ? (JSON.parse(stored) as CatalogSnapshot) : null;
      } catch {
        snapshot = null;
      }
      return createOrder(request, env, snapshot);
    }
    if (url.pathname.startsWith("/api/orders/")) {
      const [ref, action, ...rest] = url.pathname.slice("/api/orders/".length).split("/").map(decodeURIComponent);
      const notAllowed = () => new Response("Method not allowed", { status: 405 });
      if (rest.length > 0) return new Response("Not found", { status: 404 });
      if (action === undefined) return request.method === "GET" ? getOrder(request, env, ref) : notAllowed();
      if (action === "proof") return request.method === "POST" ? uploadProof(request, env, ref) : notAllowed();
      if (action === "cancel") return request.method === "POST" ? cancelOrder(request, env, ref) : notAllowed();
      return new Response("Not found", { status: 404 });
    }
    if (url.pathname.startsWith("/api/image/")) {
      return serveItemImage(request, env, url);
    }
    if (url.pathname === "/api/catalog/status") {
      const status = await env.AFP_CATALOG?.get(STATUS_KEY, "text").catch(() => null);
      return new Response(
        status ?? JSON.stringify({ outcome: "never-run", detail: "No sync attempt has been recorded yet." }),
        { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
      );
    }
    return env.ASSETS.fetch(request);
  }
}

type Fetch = typeof fetch;

/**
 * The catalog as customers should see it: Loyverse stock minus items held by
 * open orders. If the orders database cannot be read, the plain catalog is
 * served; reserving an order still checks stock properly, so the worst case
 * is a size that looks available and then says "just sold out".
 */
export async function withHolds(stored: string | null | undefined, env: Env): Promise<string> {
  if (!stored) return JSON.stringify(seedCatalog);
  if (!env.ORDERS_DB) return stored;
  try {
    const holds = await loadHolds(env.ORDERS_DB, new Date());
    if (holds.size === 0) return stored;
    return JSON.stringify(applyHolds(JSON.parse(stored) as CatalogSnapshot, holds));
  } catch (err) {
    console.error(`catalog holds unavailable: ${err instanceof Error ? err.message : String(err)}`);
    return stored;
  }
}

/**
 * Serve a Loyverse item photo from this site's own address.
 *
 * The browser asks for /api/image/<item id>; the Worker looks up where that
 * photo lives at Loyverse (a list written by the sync, never taken from the
 * request) and passes it through. So the site never depends on the browser
 * reaching Loyverse, and nobody can make this route fetch an address of
 * their choosing.
 */
export async function serveItemImage(
  request: Request,
  env: Env,
  url: URL,
  fetchImpl: Fetch = fetch,
): Promise<Response> {
  const notFound = () =>
    new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  if (request.method !== "GET" && request.method !== "HEAD") return notFound();

  let itemId = "";
  try {
    itemId = decodeURIComponent(url.pathname.slice("/api/image/".length));
  } catch {
    return notFound();
  }
  if (!itemId || itemId.includes("/")) return notFound();

  const sources = (await env.AFP_CATALOG?.get(IMAGES_KEY, "json").catch(() => null)) as
    | Record<string, string>
    | null;
  const source = sources?.[itemId];
  if (!source || !source.startsWith("https://")) return notFound();

  const upstream = await fetchImpl(source, { headers: { accept: "image/*" } }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";
  if (!upstream || !upstream.ok || !type.toLowerCase().startsWith("image/")) return notFound();

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    headers: {
      "content-type": type,
      // The address carries a fingerprint of the photo (?v=…), so a changed
      // photo gets a new address and this copy can be kept for a long time.
      "cache-control": "public, max-age=604800",
      "x-content-type-options": "nosniff",
    },
  });
}

/** Read every page of one Loyverse list endpoint. */
export async function fetchAllPages<T>(
  path: string,
  key: string,
  token: string,
  fetchImpl: Fetch = fetch,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (cursor) params.set("cursor", cursor);
    const res = await fetchImpl(`${LOYVERSE_API}/${path}?${params}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) {
      // Status only: never log the response body next to a credentialed call.
      throw new Error(`Loyverse ${path} [${res.status}]`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const rows = data[key];
    if (Array.isArray(rows)) out.push(...(rows as T[]));
    cursor = typeof data.cursor === "string" && data.cursor ? data.cursor : undefined;
    if (!cursor) break;
  }
  return out;
}

export async function syncCatalog(env: Env, fetchImpl: Fetch = fetch): Promise<void> {
  if (!env.AFP_CATALOG) {
    console.log("catalog sync skipped: AFP_CATALOG KV binding missing");
    return;
  }
  let token: string | null = null;
  try {
    token = await resolveToken(env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`catalog sync failed: could not read the AFPWebsite secret: ${message}`);
    await recordStatus(env, {
      outcome: "failed",
      detail: `Could not read the AFPWebsite secret from the Secrets Store: ${message}`,
    });
    return;
  }
  if (!token) {
    console.log("catalog sync skipped: Loyverse token secret (AFPWebsite) not configured yet");
    await recordStatus(env, {
      outcome: "skipped",
      detail:
        "The Worker cannot see the AFPWebsite secret. Check the secrets_store_secrets binding in wrangler.jsonc and that the secret's scope includes Workers.",
    });
    return;
  }

  try {
    const [items, categories, inventory] = await Promise.all([
      fetchAllPages<LoyverseItem>("items", "items", token, fetchImpl),
      fetchAllPages<LoyverseCategory>("categories", "categories", token, fetchImpl),
      fetchAllPages<LoyverseInventoryLevel>("inventory", "inventory_levels", token, fetchImpl),
    ]);

    if (items.length === 0) {
      // An empty answer is far more likely a fault than a real empty shop.
      // Keep the last good snapshot rather than wiping the live catalog.
      console.error("catalog sync aborted: Loyverse returned no items; keeping last snapshot");
      await recordStatus(env, { outcome: "aborted", detail: "Loyverse returned no items.", loyverseItems: 0 });
      return;
    }

    const { snapshot, warnings, imageSources } = buildLoyverseSnapshot(
      items,
      categories,
      inventory,
      siteSettings as unknown as SiteSettings,
      new Date().toISOString(),
    );

    const live = snapshot.products.filter((p) => p.active && p.priceCents > 0).length;
    if (live === 0) {
      // Loyverse answered, but nothing came out sellable. That means the data
      // did not read the way this code expects (or every price was removed),
      // not that the shop is empty. Never publish an empty shop.
      console.error(
        `catalog sync aborted: ${items.length} Loyverse items but 0 sellable products; keeping last snapshot`,
      );
      await recordStatus(env, {
        outcome: "aborted",
        detail: "Loyverse items were read but none came out sellable.",
        loyverseItems: items.length,
        liveProducts: 0,
        notes: warnings.slice(0, 20),
      });
      return;
    }

    // Photo list first, so a snapshot never points at a photo the Worker
    // cannot yet look up.
    await env.AFP_CATALOG.put(IMAGES_KEY, JSON.stringify(imageSources));
    await env.AFP_CATALOG.put(KV_KEY, JSON.stringify(snapshot));
    console.log(
      `catalog sync ok: ${items.length} Loyverse items, ${live} live on site, ` +
        `${snapshot.categories.length} categories at ${snapshot.generatedAt}`,
    );
    await recordStatus(env, {
      outcome: "ok",
      detail: "Catalog copied from Loyverse.",
      loyverseItems: items.length,
      liveProducts: live,
      photos: Object.keys(imageSources).length,
      ...(Object.keys(imageSources).length === 0
        ? { itemFields: Object.keys(items[0] ?? {}).sort() }
        : {}),
      notes: warnings.slice(0, 60),
    });
  } catch (err) {
    // Leave the last good snapshot in place; the next cron run retries.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`catalog sync failed: ${message}`);
    await recordStatus(env, { outcome: "failed", detail: message });
  }
}
