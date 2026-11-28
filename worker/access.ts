/**
 * Who is signed in to the owner's portal.
 *
 * Cloudflare Access sits in front of /admin and /api/admin/* and, once a
 * person has signed in with an emailed code, adds a signed token to each
 * request (the Cf-Access-Jwt-Assertion header). That token is the ONLY thing
 * trusted here. This file checks it itself, every time:
 *
 *   - the signature, against the keys the AFP Access team publishes
 *   - that it was issued by that team (iss) for this application (aud)
 *   - that it is inside its lifetime (exp, nbf)
 *   - that the email in it is one of the two allowed addresses
 *
 * Any failure, of any kind, gives null, and callers answer every null the
 * same way. If the Access settings or keys are unavailable it also gives
 * null: the portal fails closed.
 *
 * Things deliberately NOT trusted: any email header, the cookie on its own,
 * a token that names its own key URL, and any algorithm other than RS256.
 */
import { ADMIN_EMAILS } from "../src/lib/orders-core";

export interface AccessEnv {
  /** e.g. "https://afp.cloudflareaccess.com" (plain var in wrangler.jsonc). */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's audience (AUD) tag. */
  ACCESS_AUD?: string;
}

export interface AdminIdentity {
  email: string;
}

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
  n?: string;
  e?: string;
}

export type KeyFetcher = (certsUrl: string) => Promise<Jwk[]>;

const KEY_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;
let cache: { url: string; at: number; keys: Jwk[] } | null = null;

/** Forget cached keys (tests, and after a key the cache does not know). */
export function clearAccessKeyCache(): void {
  cache = null;
}

const fetchKeys: KeyFetcher = async (certsUrl) => {
  const res = await fetch(certsUrl, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  return Array.isArray(body.keys) ? body.keys : [];
};

async function keysFor(certsUrl: string, nowMs: number, fetcher: KeyFetcher, refresh: boolean): Promise<Jwk[]> {
  if (!refresh && cache && cache.url === certsUrl && nowMs - cache.at < KEY_TTL_MS) return cache.keys;
  const keys = await fetcher(certsUrl);
  cache = { url: certsUrl, at: nowMs, keys };
  return keys;
}

function b64urlToBytes(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(b64urlToBytes(part))) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The team's address, normalised to "https://<name>.cloudflareaccess.com". Null if unusable. */
function teamOrigin(value: string | undefined): string | null {
  const raw = (value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * The signed-in admin for this request, or null. Never throws.
 */
export async function verifyAccess(
  request: Request,
  env: AccessEnv,
  now: Date = new Date(),
  fetcher: KeyFetcher = fetchKeys,
): Promise<AdminIdentity | null> {
  try {
    const team = teamOrigin(env.ACCESS_TEAM_DOMAIN);
    const audience = (env.ACCESS_AUD ?? "").trim();
    if (!team || !audience) return null; // not configured: fail closed

    const token = (request.headers.get("cf-access-jwt-assertion") ?? "").trim();
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return null;

    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (!header || !claims) return null;
    if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) return null;

    // Keys come from the configured team only, never from anything in the token.
    const certsUrl = `${team}/cdn-cgi/access/certs`;
    const nowMs = now.getTime();
    let jwk = (await keysFor(certsUrl, nowMs, fetcher, false)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await keysFor(certsUrl, nowMs, fetcher, true)).find((k) => k.kid === header.kid); // rotated
    if (!jwk || jwk.kty !== "RSA" || !jwk.n || !jwk.e) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), signed);
    if (!valid) return null;

    // Only now are the claims believed.
    if (claims.iss !== team) return null;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(audience)) return null;
    const nowSeconds = Math.floor(nowMs / 1000);
    if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) return null;
    if (typeof claims.nbf === "number" && claims.nbf > nowSeconds + CLOCK_SKEW_SECONDS) return null;
    if (typeof claims.iat === "number" && claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) return null;

    const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
    if (!(ADMIN_EMAILS as readonly string[]).includes(email)) return null;
    return { email };
  } catch {
    return null;
  }
}
