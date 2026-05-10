// Validates a partner code, computes credit redemption, and writes ledger entries.
// Customer pays full subtotal. Customer + influencer each earn the code's value as credit,
// UNLESS the customer also redeems credit on this order — in that case only the influencer earns.
// Credit redemption is capped at 50% of subtotal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = await req.json().catch(() => ({}));
    const subtotalCents = Math.max(0, Math.round(Number(body?.subtotalCents ?? 0)));
    const codeRaw = (body?.code ?? "").toString().trim().toUpperCase();
    const requestedRedeemCents = Math.max(0, Math.round(Number(body?.redeemCents ?? 0)));
    const orderRef = (body?.orderRef ?? crypto.randomUUID()).toString();

    if (subtotalCents <= 0) return json({ error: "Empty order" }, 400);

    const admin = createClient(url, service);

    // Validate code (optional)
    let code: { code: string; influencer_user_id: string; credit_value_cents: number } | null = null;
    if (codeRaw) {
      const { data } = await admin
        .from("partner_codes")
        .select("code, influencer_user_id, credit_value_cents, active")
        .eq("code", codeRaw)
        .maybeSingle();
      if (!data || !data.active) return json({ error: "Invalid or inactive code" }, 400);
      if (data.influencer_user_id === user.id) return json({ error: "You can't use your own code" }, 400);
      code = { code: data.code, influencer_user_id: data.influencer_user_id, credit_value_cents: data.credit_value_cents };
    }

    // Cap redemption: 50% of subtotal AND available balance
    const { data: balRow } = await admin.rpc("available_credit_cents", { _user_id: user.id });
    const balance = Number(balRow ?? 0);
    const maxRedeem = Math.min(balance, Math.floor(subtotalCents / 2));
    const redeemCents = Math.min(requestedRedeemCents, maxRedeem);

    const entries: Array<Record<string, unknown>> = [];

    // Spend
    if (redeemCents > 0) {
      entries.push({
        user_id: user.id,
        amount_cents: -redeemCents,
        reason: "spend",
        order_ref: orderRef,
      });
    }

    // Earn from code
    if (code) {
      // Influencer always earns
      entries.push({
        user_id: code.influencer_user_id,
        amount_cents: code.credit_value_cents,
        reason: "earn_referral",
        order_ref: orderRef,
        source_code: code.code,
      });
      // Customer earns only if NOT also redeeming credit on this order
      if (redeemCents === 0) {
        entries.push({
          user_id: user.id,
          amount_cents: code.credit_value_cents,
          reason: "earn_purchase",
          order_ref: orderRef,
          source_code: code.code,
        });
      }
    }

    if (entries.length > 0) {
      const { error } = await admin.from("credit_ledger").insert(entries);
      if (error) return json({ error: error.message }, 500);
    }

    const customerEarnedCents = code && redeemCents === 0 ? code.credit_value_cents : 0;
    const influencerEarnedCents = code ? code.credit_value_cents : 0;

    return json({
      ok: true,
      orderRef,
      subtotalCents,
      redeemedCents: redeemCents,
      payableCents: subtotalCents - redeemCents,
      customerEarnedCents,
      influencerEarnedCents,
      codeApplied: code?.code ?? null,
    });
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