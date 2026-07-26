// Admin-only: mutate a single product row in the Google Sheet's `Products` tab.
// Body: { id, action?: "update" | "create" | "delete", fields?: { [header]: value } }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SHEETS_API, getAccessToken } from "../_shared/google-sheets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = SHEETS_API;

/** Authed Sheets call that returns the raw Response (never throws on HTTP errors). */
async function gwFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

function colLetter(idx: number): string {
  // 0-based -> A, B, ..., Z, AA, AB, ...
  let n = idx;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SHEET_ID = Deno.env.get("PRODUCTS_SHEET_ID");

  if (!SHEET_ID) {
    return new Response(JSON.stringify({ error: "Sheets connector not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: signed-in admin
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: userData } = await admin.auth.getUser(authHeader.slice(7));
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roleRow } = await admin
    .from("user_roles").select("role")
    .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    id?: string;
    action?: "update" | "create" | "delete";
    fields?: Record<string, string | number | boolean | null>;
  };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const id = body.id?.trim();
  const action = body.action ?? "update";
  const fields = body.fields ?? {};
  if (!id) {
    return new Response(JSON.stringify({ error: "id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (action === "update" && !Object.keys(fields).length) {
    return new Response(JSON.stringify({ error: "fields required for update" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Read sheet to locate row + columns
  const readUrl = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values/Products!A1:Z1000`;
  const readRes = await gwFetch(readUrl);
  if (!readRes.ok) {
    const t = await readRes.text();
    return new Response(JSON.stringify({ error: `Read sheet failed: [${readRes.status}] ${t}` }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const readJson = await readRes.json();
  const values: string[][] = readJson.values ?? [];
  if (!values.length) {
    return new Response(JSON.stringify({ error: "Empty Products sheet" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const headers = values[0].map((h) => (h ?? "").toString().trim());
  const idCol = headers.indexOf("id");
  if (idCol < 0) {
    return new Response(JSON.stringify({ error: "No 'id' column in Products tab" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const rowIdx = values.findIndex((row, i) => i > 0 && (row[idCol] ?? "").trim() === id);

  // ============ CREATE ============
  if (action === "create") {
    if (rowIdx >= 0) {
      return new Response(JSON.stringify({ error: `Product ${id} already exists in sheet` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const newRow = headers.map((h) => {
      if (h === "id") return id;
      const v = fields[h];
      return v == null ? "" : String(v);
    });
    const appendUrl = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values/Products!A1:append?valueInputOption=USER_ENTERED`;
    const appendRes = await gwFetch(appendUrl, { method: "POST",
      body: JSON.stringify({ values: [newRow] }),
    });
    if (!appendRes.ok) {
      const t = await appendRes.text();
      return new Response(JSON.stringify({ error: `Append failed: [${appendRes.status}] ${t}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, action: "create" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (rowIdx < 0) {
    return new Response(JSON.stringify({ error: `Product ${id} not found in sheet` }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sheetRow = rowIdx + 1; // 1-based for A1 notation

  // ============ DELETE ============
  if (action === "delete") {
    const metaUrl = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}?fields=sheets.properties`;
    const metaRes = await gwFetch(metaUrl);
    if (!metaRes.ok) {
      const t = await metaRes.text();
      return new Response(JSON.stringify({ error: `Meta read failed: [${metaRes.status}] ${t}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const meta = await metaRes.json();
    const productsTab = (meta.sheets ?? []).find((s: any) => s.properties?.title === "Products");
    const gid = productsTab?.properties?.sheetId;
    if (gid == null) {
      return new Response(JSON.stringify({ error: "Products tab not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const delUrl = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}:batchUpdate`;
    const delRes = await gwFetch(delUrl, { method: "POST",
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: gid,
              dimension: "ROWS",
              startIndex: rowIdx,
              endIndex: rowIdx + 1,
            },
          },
        }],
      }),
    });
    if (!delRes.ok) {
      const t = await delRes.text();
      return new Response(JSON.stringify({ error: `Delete failed: [${delRes.status}] ${t}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, action: "delete", row: sheetRow }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ============ UPDATE ============
  // 2. Build per-field cell writes
  const updates: { range: string; values: string[][] }[] = [];
  const skipped: string[] = [];
  for (const [field, raw] of Object.entries(fields)) {
    const colIdx = headers.indexOf(field);
    if (colIdx < 0) { skipped.push(field); continue; }
    const cell = `${colLetter(colIdx)}${sheetRow}`;
    updates.push({
      range: `Products!${cell}`,
      values: [[raw == null ? "" : String(raw)]],
    });
  }
  if (!updates.length) {
    return new Response(JSON.stringify({ ok: false, error: "No matching columns", skipped }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. batchUpdate write
  const writeUrl = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values:batchUpdate`;
  const writeRes = await gwFetch(writeUrl, { method: "POST",
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: updates }),
  });
  if (!writeRes.ok) {
    const t = await writeRes.text();
    return new Response(JSON.stringify({ error: `Write sheet failed: [${writeRes.status}] ${t}` }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, row: sheetRow, updated: updates.length, skipped }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});