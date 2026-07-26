// Direct Google Sheets access via a service account — no third-party gateway.
//
// Replaces the previous dependency on connector-gateway.lovable.dev, so the
// catalog sync keeps working regardless of which builder tool AFP uses.
//
// Required Supabase secrets:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  e.g. afp-sheets@my-project.iam.gserviceaccount.com
//   GOOGLE_SERVICE_ACCOUNT_KEY    the full PEM private key from the service-account JSON
//
// One-time setup: share the products Google Sheet with GOOGLE_SERVICE_ACCOUNT_EMAIL
// as an Editor. Nothing else is needed — no OAuth consent screen, no token refresh UI.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export const SHEETS_API = "https://sheets.googleapis.com/v4";

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  // Secrets are often pasted with literal "\n" instead of real newlines.
  const normalized = pem.replace(/\\n/g, "\n").trim();
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

// Access tokens last an hour; cache across warm invocations to avoid a
// signing round-trip on every single sheet edit.
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;

  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!email || !key) {
    throw new Error(
      "Google service account not configured: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY",
    );
  }

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${b64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed [${res.status}]: ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
  };
  return cachedToken.value;
}

/** fetch() against the Sheets API with auth and retry on transient failures. */
export async function sheetsFetch(
  path: string,
  init: RequestInit = {},
  attempts = 4,
): Promise<Response> {
  let lastErr = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const token = await getAccessToken();
    const res = await fetch(`${SHEETS_API}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) return res;

    lastErr = `[${res.status}] ${await res.text()}`;
    if (![502, 503, 504, 408, 429].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  throw new Error(`Sheets request failed for ${path}: ${lastErr}`);
}
