// Pulls the catalog from the connected Google Sheet and upserts into the DB.
// Auth: requires header `X-Sync-Token` matching SYNC_SHARED_SECRET, OR a signed-in admin user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sheetsFetch } from "../_shared/google-sheets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SheetRow {
  [key: string]: string;
}

function parseRows(values: string[][]): SheetRow[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => h.trim());
  return values.slice(1).map((row) => {
    const obj: SheetRow = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? "").toString().trim();
    });
    return obj;
  });
}

function parseColors(raw: string): { name: string; hex: string }[] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [name, hex] = pair.split(":").map((p) => p.trim());
      return { name: name || "Default", hex: hex || "#000000" };
    });
}

function parseSizes(raw: string): string[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBool(raw: string): boolean {
  const v = (raw || "").toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y";
}

function dollarsToCents(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

async function fetchSheet(spreadsheetId: string, range: string) {
  const res = await sheetsFetch(
    `/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
  );
  const data = await res.json();
  return (data.values ?? []) as string[][];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SHEET_ID = Deno.env.get("PRODUCTS_SHEET_ID");
  const SYNC_SECRET = Deno.env.get("SYNC_SHARED_SECRET");

  if (!SHEET_ID)
    return new Response(JSON.stringify({ error: "PRODUCTS_SHEET_ID not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Auth: shared secret OR signed-in admin
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const token = req.headers.get("x-sync-token");
  let triggeredBy = "webhook";
  let authed = false;
  if (SYNC_SECRET && token && token === SYNC_SECRET) {
    authed = true;
  } else {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const jwt = authHeader.slice(7);
      const { data: userData } = await admin.auth.getUser(jwt);
      if (userData?.user) {
        const { data: roles } = await admin
          .from("user_roles").select("role")
          .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
        if (roles) {
          authed = true;
          triggeredBy = `admin:${userData.user.email ?? userData.user.id}`;
        }
      }
    }
  }
  if (!authed)
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Open sync log
  const { data: logRow } = await admin
    .from("sync_log")
    .insert({ status: "running", triggered_by: triggeredBy })
    .select("id").single();
  const logId = logRow?.id;

  const errors: { row?: number; id?: string; message: string }[] = [];
  let rowsProcessed = 0;

  try {
    // Run sequentially: gateway occasionally rejects parallel requests with 503.
    const productValues = await fetchSheet(SHEET_ID, "Products!A1:Z1000");
    const stockValues = await fetchSheet(SHEET_ID, "Stock!A1:Z5000");

    const productRows = parseRows(productValues);
    const stockRows = parseRows(stockValues);

    const productsToUpsert: any[] = [];
    const seenIds = new Set<string>();

    productRows.forEach((r, idx) => {
      const id = r["id"];
      if (!id) {
        errors.push({ row: idx + 2, message: "missing id" });
        return;
      }
      if (seenIds.has(id)) {
        errors.push({ row: idx + 2, id, message: "duplicate id" });
        return;
      }
      seenIds.add(id);
      const gender = (r["gender"] || "").toLowerCase();
      if (!["men", "women", "unisex"].includes(gender)) {
        errors.push({ row: idx + 2, id, message: `invalid gender "${r["gender"]}"` });
        return;
      }
      productsToUpsert.push({
        id,
        slug: r["slug"] || id,
        name: r["name"] || id,
        gender,
        category: (r["category"] || "uncategorized").toLowerCase(),
        price_cents: dollarsToCents(r["price_usd"]),
        compare_at_cents: r["compare_at_usd"] ? dollarsToCents(r["compare_at_usd"]) : null,
        colors: parseColors(r["colors"]),
        sizes: parseSizes(r["sizes"]),
        image_url: r["image_url"] || null,
        image_alt: r["image_alt"] || r["name"] || null,
        badge: r["badge"] || null,
        published: r["published"] ? parseBool(r["published"]) : true,
        sort_order: idx,
      });
    });

    if (productsToUpsert.length) {
      const { error: upErr } = await admin
        .from("products").upsert(productsToUpsert, { onConflict: "id" });
      if (upErr) throw new Error(`product upsert failed: ${upErr.message}`);
    }

    // Mark missing products as unpublished (soft delete)
    if (seenIds.size > 0) {
      const { error: hideErr } = await admin
        .from("products").update({ published: false })
        .not("id", "in", `(${Array.from(seenIds).map((i) => `"${i}"`).join(",")})`);
      if (hideErr) errors.push({ message: `hide-missing failed: ${hideErr.message}` });
    }

    // Replace stock for touched products
    const touchedIds = Array.from(seenIds);
    if (touchedIds.length) {
      const { error: delErr } = await admin
        .from("product_stock").delete().in("product_id", touchedIds);
      if (delErr) throw new Error(`stock delete failed: ${delErr.message}`);
    }

    const stockToInsert: any[] = [];
    stockRows.forEach((r, idx) => {
      const pid = r["product_id"];
      const size = r["size"];
      const color = r["color"];
      if (!pid || !size || !color) {
        errors.push({ row: idx + 2, message: "stock row missing product_id/size/color" });
        return;
      }
      if (!seenIds.has(pid)) {
        errors.push({ row: idx + 2, id: pid, message: "stock for unknown product_id" });
        return;
      }
      const qty = parseInt(r["quantity"] || "0", 10);
      stockToInsert.push({
        product_id: pid, size, color, quantity: isFinite(qty) ? qty : 0,
      });
    });

    if (stockToInsert.length) {
      const { error: stErr } = await admin.from("product_stock").insert(stockToInsert);
      if (stErr) throw new Error(`stock insert failed: ${stErr.message}`);
    }

    rowsProcessed = productsToUpsert.length + stockToInsert.length;

    if (logId) {
      await admin.from("sync_log").update({
        status: errors.length ? "completed_with_errors" : "completed",
        finished_at: new Date().toISOString(),
        rows_processed: rowsProcessed,
        errors,
      }).eq("id", logId);
    }

    return new Response(JSON.stringify({
      ok: true, rows_processed: rowsProcessed, errors, products: productsToUpsert.length, stock: stockToInsert.length,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    if (logId) {
      await admin.from("sync_log").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        rows_processed: rowsProcessed,
        errors: [...errors, { message }],
      }).eq("id", logId);
    }
    return new Response(JSON.stringify({ ok: false, error: message, errors }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});