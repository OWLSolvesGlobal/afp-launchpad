/**
 * AFP site Worker: serves /api/catalog and syncs the Google Sheet into KV.
 *
 *   Google Sheet ──(cron, every 5 min)── scheduled() ──► KV "catalog:v1"
 *                                                    │
 *   GET /api/catalog ◄── fetch() ────────────────────┘  (seed JSON if empty)
 *
 * Everything that is not /api/catalog falls through to static assets, so SPA
 * routing (`assets.not_found_handling`) behaves exactly as before.
 *
 * Degrades gracefully at every step:
 *  - No KV binding / empty KV  → /api/catalog serves the bundled seed.
 *  - Secrets not yet configured → sync logs why and exits; nothing breaks.
 *  - Sheet fetch or parse fails → sync logs and exits; the last good
 *    snapshot in KV keeps serving.
 */
import { buildSnapshot } from "../src/lib/catalog-core";
import seedCatalog from "../src/data/seed-catalog.json";

export interface Env {
  ASSETS: Fetcher;
  /** Optional so a deployment without the namespace still serves the seed. */
  AFP_CATALOG?: KVNamespace;
  /** Full service-account JSON from Google Cloud (Worker secret). */
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  /** The spreadsheet id from the Sheet's URL (Worker secret). */
  CATALOG_SHEET_ID?: string;
}

export const KV_KEY = "catalog:v1";

const CATALOG_RANGE = "Catalog!A1:R";
const CONFIG_RANGE = "Config!A1:B";

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
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(syncCatalog(env));
  },
} satisfies ExportedHandler<Env>;

export async function syncCatalog(env: Env): Promise<void> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.CATALOG_SHEET_ID) {
    console.log(
      "catalog sync skipped: GOOGLE_SERVICE_ACCOUNT_JSON / CATALOG_SHEET_ID not configured yet",
    );
    return;
  }
  if (!env.AFP_CATALOG) {
    console.log("catalog sync skipped: AFP_CATALOG KV binding missing");
    return;
  }

  try {
    const token = await getAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const ranges = `ranges=${encodeURIComponent(CATALOG_RANGE)}&ranges=${encodeURIComponent(CONFIG_RANGE)}`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.CATALOG_SHEET_ID}/values:batchGet?${ranges}&majorDimension=ROWS`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      throw new Error(`Sheets API [${res.status}]: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      valueRanges?: { range: string; values?: (string | number)[][] }[];
    };
    const catalogRows = data.valueRanges?.[0]?.values ?? [];
    const configRows = data.valueRanges?.[1]?.values ?? [];
    if (catalogRows.length < 2) {
      // Header-only or empty tab. Keep the last good snapshot rather than
      // wiping the live catalog because someone cleared the Sheet.
      console.error("catalog sync aborted: Catalog tab has no data rows; keeping last snapshot");
      return;
    }

    const snapshot = buildSnapshot(catalogRows, configRows, new Date().toISOString());
    await env.AFP_CATALOG.put(KV_KEY, JSON.stringify(snapshot));
    console.log(
      `catalog sync ok: ${snapshot.products.length} products, ` +
        `${snapshot.categories.length} categories at ${snapshot.generatedAt}`,
    );
  } catch (err) {
    // Leave the last good snapshot in place; the next cron run retries.
    console.error(`catalog sync failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Google service-account auth (JWT bearer grant, Web Crypto).
// Same approach previously used in supabase/functions/_shared/google-sheets.ts,
// adapted for Workers: env secret instead of Deno.env, read-only scope.
// ---------------------------------------------------------------------------

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  // Keys pasted into secrets often carry literal "\n" instead of newlines.
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  let account: { client_email?: string; private_key?: string };
  try {
    account = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!account.client_email || !account.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed [${res.status}]: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token exchange returned no access_token");
  return data.access_token;
}
