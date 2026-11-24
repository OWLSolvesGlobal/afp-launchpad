/**
 * AFP site Worker: serves /api/catalog and syncs Loyverse into KV.
 *
 *   Loyverse POS ──(cron, every 5 min)── scheduled() ──► KV "catalog:v1"
 *                                                    │
 *   GET /api/catalog ◄── fetch() ────────────────────┘  (seed JSON if empty)
 *
 * Loyverse is the source of truth for items, sizes, prices and stock.
 * Website-only details (photo, section, show/hide) come from
 * src/data/site-settings.json, bundled at build time.
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
 */
import {
  buildLoyverseSnapshot,
  type LoyverseCategory,
  type LoyverseInventoryLevel,
  type LoyverseItem,
  type SiteSettings,
} from "../src/lib/loyverse-core";
import seedCatalog from "../src/data/seed-catalog.json";
import siteSettings from "../src/data/site-settings.json";

export interface Env {
  ASSETS: Fetcher;
  /** Optional so a deployment without the namespace still serves the seed. */
  AFP_CATALOG?: KVNamespace;
  /** Loyverse access token (Worker secret). Named as created in Cloudflare. */
  AFPWebsite?: string;
  /** Alternative secret name, if the token is ever re-created. */
  LOYVERSE_API_TOKEN?: string;
}

export const KV_KEY = "catalog:v1";
/** Outcome of the most recent sync attempt, readable at /api/catalog/status. */
export const STATUS_KEY = "catalog:status";

export interface SyncStatus {
  at: string;
  outcome: "ok" | "skipped" | "aborted" | "failed";
  detail: string;
  loyverseItems?: number;
  liveProducts?: number;
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/catalog") {
      const stored = await env.AFP_CATALOG?.get(KV_KEY, "text").catch(() => null);
      return new Response(stored ?? JSON.stringify(seedCatalog), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=60",
          "x-afp-catalog-source": stored ? "kv" : "seed",
        },
      });
    }
    if (url.pathname === "/api/catalog/status") {
      const status = await env.AFP_CATALOG?.get(STATUS_KEY, "text").catch(() => null);
      return new Response(
        status ?? JSON.stringify({ outcome: "never-run", detail: "No sync attempt has been recorded yet." }),
        { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
      );
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(syncCatalog(env));
  },
} satisfies ExportedHandler<Env>;

type Fetch = typeof fetch;

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
  const token = env.AFPWebsite || env.LOYVERSE_API_TOKEN;
  if (!env.AFP_CATALOG) {
    console.log("catalog sync skipped: AFP_CATALOG KV binding missing");
    return;
  }
  if (!token) {
    console.log("catalog sync skipped: Loyverse token secret (AFPWebsite) not configured yet");
    await recordStatus(env, {
      outcome: "skipped",
      detail:
        "The Worker cannot see a secret named AFPWebsite. Add it under the Worker's Settings > Variables and Secrets, type Secret.",
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

    const { snapshot, warnings } = buildLoyverseSnapshot(
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
      notes: warnings.slice(0, 60),
    });
  } catch (err) {
    // Leave the last good snapshot in place; the next cron run retries.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`catalog sync failed: ${message}`);
    await recordStatus(env, { outcome: "failed", detail: message });
  }
}
