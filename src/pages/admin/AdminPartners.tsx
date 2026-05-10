import { useEffect, useState } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AdminGate } from "@/components/admin/AdminGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Code = {
  code: string;
  influencer_user_id: string;
  credit_value_cents: number;
  active: boolean;
  note: string | null;
  created_at: string;
};

type LedgerRow = {
  user_id: string;
  amount_cents: number;
  reason: string;
  source_code: string | null;
  created_at: string;
};

const VALUES = [1000, 2000, 3000];

export default function AdminPartners() {
  return (
    <AdminGate>
      <PartnersInner />
    </AdminGate>
  );
}

function PartnersInner() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // create form
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [value, setValue] = useState<number>(2000);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase.from("partner_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("credit_ledger").select("user_id, amount_cents, reason, source_code, created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    setCodes((c ?? []) as Code[]);
    setLedger((l ?? []) as LedgerRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedCode || !trimmedEmail) return toast.error("Code and influencer email required");
    setBusy(true);

    // Look up influencer user via edge function (admin context not needed; use admin RPC pattern via auth users would require a function).
    // Simple approach: query user_roles join — but we don't have an emails view. Use a small inline edge call would be cleanest.
    // For simplicity here, we ask the admin to paste the user UUID. If they pass an email, we try a profiles lookup, else fail clearly.
    const lookup = await supabase.functions.invoke("lookup-user-by-email", { body: { email: trimmedEmail } });
    if (lookup.error || !lookup.data?.user_id) {
      setBusy(false);
      return toast.error("Influencer must sign up first with that email.");
    }

    const { error } = await supabase.from("partner_codes").insert({
      code: trimmedCode,
      influencer_user_id: lookup.data.user_id,
      credit_value_cents: value,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Code ${trimmedCode} created`);
    setCode(""); setEmail(""); setNote("");
    load();
  };

  const toggleActive = async (c: Code) => {
    const { error } = await supabase.from("partner_codes").update({ active: !c.active }).eq("code", c.code);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (c: Code) => {
    if (!confirm(`Delete code ${c.code}? Existing credit already issued is kept.`)) return;
    const { error } = await supabase.from("partner_codes").delete().eq("code", c.code);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  // Per-influencer totals
  const totalsByCode = new Map<string, { earned: number; uses: number }>();
  for (const row of ledger) {
    if (row.reason !== "earn_referral" || !row.source_code) continue;
    const t = totalsByCode.get(row.source_code) ?? { earned: 0, uses: 0 };
    t.earned += row.amount_cents;
    t.uses += 1;
    totalsByCode.set(row.source_code, t);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container pt-28 pb-16 space-y-12">
        <div>
          <div className="eyebrow text-graphite mb-2">Admin</div>
          <h1 className="display-md">Partnerships.</h1>
          <p className="text-graphite mt-2 max-w-2xl">
            Create influencer codes worth $10, $20, or $30. When used at checkout, both customer and influencer earn that amount as store credit. If the customer also redeems credit on that order, only the influencer earns.
          </p>
        </div>

        <section className="border border-border p-6 md:p-8 bg-card">
          <h2 className="eyebrow text-graphite mb-4">New Code</h2>
          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <Label htmlFor="pc">Code</Label>
              <Input id="pc" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AP20" />
            </div>
            <div className="md:col-span-4">
              <Label htmlFor="pe">Influencer email</Label>
              <Input id="pe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="they@signedup.com" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="pv">Value</Label>
              <select
                id="pv"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {VALUES.map((v) => <option key={v} value={v}>${v / 100}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="pn">Note (optional)</Label>
              <Input id="pn" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="md:col-span-12">
              <Button type="submit" variant="afp-primary" size="afp" disabled={busy}>
                {busy ? "Creating…" : "Create code"}
              </Button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="eyebrow text-graphite mb-4">Active codes</h2>
          {loading ? (
            <div className="text-graphite">Loading…</div>
          ) : codes.length === 0 ? (
            <div className="text-graphite">No codes yet.</div>
          ) : (
            <div className="border border-border divide-y divide-border bg-card">
              {codes.map((c) => {
                const t = totalsByCode.get(c.code);
                return (
                  <div key={c.code} className="p-4 md:p-5 flex flex-wrap items-center gap-4">
                    <div className="font-stencil text-xl tracking-wide">{c.code}</div>
                    <div className="text-sm">${c.credit_value_cents / 100} per use</div>
                    <div className="text-xs text-graphite truncate max-w-[280px]">
                      {c.note ?? "—"}
                    </div>
                    <div className="text-xs text-graphite ml-auto">
                      {t ? `${t.uses} uses · $${(t.earned / 100).toFixed(2)} owed to influencer` : "Unused"}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className={`text-[11px] uppercase tracking-wider px-3 py-1 border ${c.active ? "border-foreground" : "border-border text-graphite"}`}
                    >
                      {c.active ? "Active" : "Paused"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="p-2 text-graphite hover:text-foreground"
                      aria-label="Delete code"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="eyebrow text-graphite mb-4">Recent credit activity</h2>
          {ledger.length === 0 ? (
            <div className="text-graphite">No activity yet.</div>
          ) : (
            <div className="border border-border divide-y divide-border bg-card text-sm">
              {ledger.slice(0, 30).map((r, i) => (
                <div key={i} className="p-3 flex items-center gap-4">
                  <div className="text-xs text-graphite w-40 truncate">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="text-xs uppercase tracking-wider w-32 text-graphite">{r.reason.replace("_", " ")}</div>
                  <div className="text-xs">{r.source_code ?? "—"}</div>
                  <div className={`ml-auto tabular-nums font-medium ${r.amount_cents < 0 ? "text-graphite" : ""}`}>
                    {r.amount_cents < 0 ? "-" : "+"}${Math.abs(r.amount_cents) / 100}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}