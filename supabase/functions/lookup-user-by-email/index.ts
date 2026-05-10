// Admin-only: returns the auth user UUID for a given email. Used to link influencer codes to user accounts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const token = auth.replace(/^Bearer\s+/i, "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;
    const { data: roleRow } = await userClient
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") return json({ error: "Email required" }, 400);

    const admin = createClient(url, service);
    // Page through users (small projects) to find email match — Supabase admin API has no direct "by email".
    // For larger projects, paginate; here 1000 is fine.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return json({ error: error.message }, 500);
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    // Return 200 with null so the client can handle "not signed up yet" without
    // supabase-js wrapping a 404 into a generic FunctionsHttpError.
    if (!match) return json({ user_id: null });
    return json({ user_id: match.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}