// Admin-only: updates fields for a single product row in the Google Sheet's
// `Products` tab, located by its `id` column. Fields = { [headerName]: value }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

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
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  const SHEET_ID = Deno.env.get("PRODUCTS_SHEET_ID");

  if (!LOVABLE_API_KEY || !GOOGLE_SHEETS_API_KEY || !SHEET_ID) {
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

  let body: { id?: string; fields?: Record<string, string | number | boolean | null> };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const id = body.id?.trim();
  const fields = body.fields ?? {};
  if (!id || !Object.keys(fields).length) {
    return new Response(JSON.stringify({ error: "id and at least one field required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Read sheet to locate row + columns
  const readUrl = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values/Products!A1:Z1000`;
  const readRes = await fetch(readUrl, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
    },
  });
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
  if (rowIdx < 0) {
    return new Response(JSON.stringify({ error: `Product ${id} not found in sheet` }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sheetRow = rowIdx + 1; // 1-based for A1 notation

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
  const writeRes = await fetch(writeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      "Content-Type": "application/json",
    },
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