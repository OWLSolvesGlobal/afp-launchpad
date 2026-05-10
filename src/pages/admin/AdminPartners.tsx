import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminNav } from "@/components/admin/AdminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Pause, Play, BadgeDollarSign, Users, Wallet, Pencil, Cake } from "lucide-react";
import { formatMoney } from "@/context/CartContext";

type Code = {
  code: string;
  influencer_user_id: string;
  credit_value_cents: number;
  active: boolean;
  note: string | null;
  created_at: string;
};

type LedgerRow = {
  id?: string;
  user_id: string;
  amount_cents: number;
  reason: "earn_purchase" | "earn_referral" | "spend" | "expire" | "adjust";
  source_code: string | null;
  order_ref: string | null;
  created_at: string;
};

type InfluencerProfile = {
  user_id: string;
  full_name: string | null;
  birthday: string | null; // ISO date YYYY-MM-DD
  instagram_handle: string | null;
  phone: string | null;
  notes: string | null;
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
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, InfluencerProfile>>({});
  const [loading, setLoading] = useState(true);

  // Create-code form
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [value, setValue] = useState<number>(2000);
  const [note, setNote] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [instagram, setInstagram] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  // Live influencer lookup state, keyed off the email field
  type LookupState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "found"; userId: string; profile: InfluencerProfile | null }
    | { status: "missing" }
    | { status: "error"; message: string };
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const [profilePrefilled, setProfilePrefilled] = useState(false);

  // Adjust-credit form
  const [adjEmail, setAdjEmail] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjBusy, setAdjBusy] = useState(false);

  // Per-influencer payout amount input (keyed by user_id)
  const [payoutDraft, setPayoutDraft] = useState<Record<string, string>>({});

  // Profile editor dialog state
  const [editing, setEditing] = useState<InfluencerProfile | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase.from("partner_codes").select("*").order("created_at", { ascending: false }),
      supabase
        .from("credit_ledger")
        .select("id, user_id, amount_cents, reason, source_code, order_ref, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const codesData = (c ?? []) as Code[];
    const ledgerData = (l ?? []) as LedgerRow[];
    setCodes(codesData);
    setLedger(ledgerData);

    // Resolve emails for everyone we care about (influencers + ledger users)
    const ids = Array.from(
      new Set([...codesData.map((x) => x.influencer_user_id), ...ledgerData.map((x) => x.user_id)])
    );
    if (ids.length > 0) {
      try {
        const { data: emailRes, error: emailErr } = await supabase.functions.invoke(
          "list-user-emails",
          { body: { user_ids: ids } },
        );
        if (emailErr) {
          console.warn("list-user-emails failed:", emailErr.message);
          setEmails({});
        } else {
          setEmails(emailRes?.emails ?? {});
        }
      } catch (e) {
        console.warn("list-user-emails threw:", (e as Error).message);
        setEmails({});
      }

      // Load any existing influencer profiles
      const influencerIds = Array.from(new Set(codesData.map((x) => x.influencer_user_id)));
      if (influencerIds.length > 0) {
        const { data: profs } = await supabase
          .from("influencer_profiles")
          .select("*")
          .in("user_id", influencerIds);
        const map: Record<string, InfluencerProfile> = {};
        for (const p of (profs ?? []) as InfluencerProfile[]) map[p.user_id] = p;
        setProfiles(map);
      } else {
        setProfiles({});
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Debounced live lookup of the influencer email so admins see "ready" / "needs signup"
  // without ever submitting and getting a confusing error.
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setLookup({ status: "idle" });
      return;
    }
    let cancelled = false;
    setLookup({ status: "checking" });
    const t = setTimeout(async () => {
      const res = await supabase.functions.invoke("lookup-user-by-email", { body: { email: trimmed } });
      if (cancelled) return;
      if (res.error) {
        setLookup({ status: "error", message: res.error.message || "Lookup failed" });
        return;
      }
      const userId = res.data?.user_id ?? null;
      if (!userId) { setLookup({ status: "missing" }); return; }
      // Pull any existing profile so the form prefills nicely.
      const { data: prof } = await supabase
        .from("influencer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      setLookup({ status: "found", userId, profile: (prof as InfluencerProfile) ?? null });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [email]);

  // Prefill the optional profile fields from an existing record once, so admins
  // don't have to retype known details. They can still override anything.
  useEffect(() => {
    if (lookup.status !== "found" || !lookup.profile || profilePrefilled) return;
    const p = lookup.profile;
    if (!fullName && p.full_name) setFullName(p.full_name);
    if (!birthday && p.birthday) setBirthday(p.birthday);
    if (!instagram && p.instagram_handle) setInstagram(p.instagram_handle);
    if (!phone && p.phone) setPhone(p.phone);
    setProfilePrefilled(true);
  }, [lookup, fullName, birthday, instagram, phone, profilePrefilled]);

  // ------- Stats -------
  const stats = useMemo(() => {
    let outstanding = 0;
    let issued = 0;
    let spent = 0;
    for (const r of ledger) {
      outstanding += r.amount_cents;
      if (r.amount_cents > 0) issued += r.amount_cents;
      else spent += -r.amount_cents;
    }
    return {
      outstanding: Math.max(0, outstanding),
      issued,
      spent,
      activeCodes: codes.filter((c) => c.active).length,
    };
  }, [ledger, codes]);

  // ------- Per-influencer rollup -------
  type InfluencerRow = {
    user_id: string;
    email: string;
    codes: Code[];
    earned: number;       // total earn_referral
    paidOut: number;      // total spend (treated as payouts unless attached to an order_ref starting with "ord_")
    redeemed: number;     // spend on real orders
    balance: number;      // current ledger balance
    uses: number;         // # of earn_referral entries
  };
  const influencerRows: InfluencerRow[] = useMemo(() => {
    const byUser = new Map<string, InfluencerRow>();
    // Seed with every influencer that has a code
    for (const c of codes) {
      if (!byUser.has(c.influencer_user_id)) {
        byUser.set(c.influencer_user_id, {
          user_id: c.influencer_user_id,
          email: emails[c.influencer_user_id] ?? "—",
          codes: [],
          earned: 0, paidOut: 0, redeemed: 0, balance: 0, uses: 0,
        });
      }
      byUser.get(c.influencer_user_id)!.codes.push(c);
    }
    // Roll ledger into the influencer row only if that user owns a code
    for (const r of ledger) {
      const row = byUser.get(r.user_id);
      if (!row) continue;
      row.balance += r.amount_cents;
      if (r.reason === "earn_referral") { row.earned += r.amount_cents; row.uses += 1; }
      else if (r.reason === "spend") {
        // payouts have order_ref starting with "payout:"
        if ((r.order_ref ?? "").startsWith("payout:")) row.paidOut += -r.amount_cents;
        else row.redeemed += -r.amount_cents;
      }
    }
    return Array.from(byUser.values()).sort((a, b) => b.balance - a.balance);
  }, [codes, ledger, emails]);

  // ------- Actions -------
  const createCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedCode || !trimmedEmail) return toast.error("Code and influencer email required");
    setBusy(true);
    // Use the live-lookup result when it matches; otherwise re-query so we never
    // submit on stale or in-flight state.
    let userId: string | null = null;
    if (lookup.status === "found") {
      userId = lookup.userId;
    } else {
      const res = await supabase.functions.invoke("lookup-user-by-email", { body: { email: trimmedEmail } });
      if (res.error) {
        setBusy(false);
        return toast.error(`Lookup failed: ${res.error.message ?? "unknown error"}`);
      }
      userId = res.data?.user_id ?? null;
    }
    if (!userId) {
      setBusy(false);
      return toast.error("Influencer must sign up with that email first.");
    }

    // Upsert profile details (only fields that were filled in)
    const profilePatch: Partial<InfluencerProfile> & { user_id: string } = { user_id: userId };
    if (fullName.trim()) profilePatch.full_name = fullName.trim();
    if (birthday) profilePatch.birthday = birthday;
    if (instagram.trim()) profilePatch.instagram_handle = instagram.trim().replace(/^@/, "");
    if (phone.trim()) profilePatch.phone = phone.trim();
    if (Object.keys(profilePatch).length > 1) {
      const { error: pErr } = await supabase
        .from("influencer_profiles")
        .upsert(profilePatch, { onConflict: "user_id" });
      if (pErr) {
        setBusy(false);
        return toast.error(`Profile save failed: ${pErr.message}`);
      }
    }

    const { error } = await supabase.from("partner_codes").insert({
      code: trimmedCode,
      influencer_user_id: userId,
      credit_value_cents: value,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Code ${trimmedCode} created`);
    setCode(""); setEmail(""); setNote("");
    setFullName(""); setBirthday(""); setInstagram(""); setPhone("");
    setLookup({ status: "idle" });
    setProfilePrefilled(false);
    load();
  };

  const toggleActive = async (c: Code) => {
    const { error } = await supabase.from("partner_codes").update({ active: !c.active }).eq("code", c.code);
    if (error) return toast.error(error.message);
    load();
  };

  const removeCode = async (c: Code) => {
    if (!confirm(`Delete code ${c.code}? Existing credit already issued is kept on the ledger.`)) return;
    const { error } = await supabase.from("partner_codes").delete().eq("code", c.code);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const recordPayout = async (row: InfluencerRow) => {
    const dollars = parseFloat(payoutDraft[row.user_id] ?? "");
    const cents = Math.round((isFinite(dollars) ? dollars : 0) * 100);
    if (cents <= 0) return toast.error("Enter a payout amount");
    if (cents > row.balance) return toast.error("Payout exceeds current balance");
    if (!confirm(`Record ${formatMoney(cents)} payout to ${row.email}?`)) return;
    const { error } = await supabase.from("credit_ledger").insert({
      user_id: row.user_id,
      amount_cents: -cents,
      reason: "spend",
      order_ref: `payout:${new Date().toISOString().slice(0, 10)}`,
    });
    if (error) return toast.error(error.message);
    setPayoutDraft((p) => ({ ...p, [row.user_id]: "" }));
    toast.success("Payout recorded");
    load();
  };

  const adjustCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = adjEmail.trim().toLowerCase();
    const dollars = parseFloat(adjAmount);
    const cents = Math.round((isFinite(dollars) ? dollars : 0) * 100);
    if (!trimmedEmail || cents === 0) return toast.error("Email and non-zero amount required");
    setAdjBusy(true);
    const res = await supabase.functions.invoke("lookup-user-by-email", { body: { email: trimmedEmail } });
    if (res.error) {
      setAdjBusy(false);
      return toast.error(`Lookup failed: ${res.error.message ?? "unknown error"}`);
    }
    const userId = res.data?.user_id as string | null;
    if (!userId) {
      setAdjBusy(false);
      return toast.error("No customer account exists for that email yet.");
    }
    const { error } = await supabase.from("credit_ledger").insert({
      user_id: userId,
      amount_cents: cents,
      reason: "adjust",
      order_ref: adjReason.trim() ? `note:${adjReason.trim().slice(0, 60)}` : null,
    });
    setAdjBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${cents > 0 ? "Granted" : "Deducted"} ${formatMoney(Math.abs(cents))}`);
    setAdjEmail(""); setAdjAmount(""); setAdjReason("");
    load();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container pt-28 pb-16 space-y-12">
        <AdminNav />
        <div>
          <div className="eyebrow text-graphite mb-2">Admin</div>
          <h1 className="display-md">Partnerships.</h1>
          <p className="text-graphite mt-2 max-w-2xl">
            Influencer codes pay full price at checkout — no upfront discount. Both customer and influencer earn the code value as store credit. If the customer also redeems credit on that order, only the influencer earns.
          </p>
        </div>

        {/* Stat tiles */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile icon={<Wallet className="w-4 h-4" />} label="Outstanding credit" value={formatMoney(stats.outstanding)} hint="Total liability on the books" />
          <StatTile icon={<BadgeDollarSign className="w-4 h-4" />} label="Issued lifetime" value={formatMoney(stats.issued)} hint="All credit ever earned + adjusted up" />
          <StatTile icon={<BadgeDollarSign className="w-4 h-4" />} label="Spent / paid out" value={formatMoney(stats.spent)} hint="Redemptions + payouts + expirations" />
          <StatTile icon={<Users className="w-4 h-4" />} label="Active codes" value={String(stats.activeCodes)} hint={`${codes.length} total`} />
        </section>

        {/* Create code */}
        <section className="border border-border p-6 md:p-8 bg-card">
          <h2 className="eyebrow text-graphite mb-4">New Code</h2>
          <p className="text-xs text-graphite mb-4 max-w-2xl">
            The influencer must already have a customer account on the storefront. Filling in name, birthday and Instagram is optional but recommended — it'll appear on the influencer roster below for easy reference.
          </p>
          <form onSubmit={createCode} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <Label htmlFor="pc">Code</Label>
              <Input
                id="pc"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                placeholder="AP20"
                autoCapitalize="characters"
              />
            </div>
            <div className="md:col-span-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="pe">Influencer email</Label>
                <span className="text-[10px] uppercase tracking-wider text-graphite">
                  {lookup.status === "checking" && "Checking…"}
                  {lookup.status === "found" && <span className="text-safety">Account found</span>}
                  {lookup.status === "missing" && <span className="text-destructive">Needs signup</span>}
                  {lookup.status === "error" && <span className="text-destructive">Lookup error</span>}
                </span>
              </div>
              <Input id="pe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="they@signedup.com" />
              {lookup.status === "missing" && (
                <div className="text-[11px] text-graphite mt-1">
                  Ask them to create an account at the storefront sign-up, then come back.
                </div>
              )}
              {lookup.status === "found" && lookup.profile && (
                <div className="text-[11px] text-graphite mt-1">
                  Existing influencer — details prefilled below.
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="pv">Value</Label>
              <select
                id="pv"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {VALUES.map((v) => <option key={v} value={v}>{formatMoney(v)}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="pn">Note (optional)</Label>
              <Input id="pn" value={note} onChange={(e) => setNote(e.target.value)} placeholder="IG · @handle" />
            </div>

            <div className="md:col-span-12 border-t border-border pt-4 mt-2">
              <div className="eyebrow text-graphite text-[10px] mb-3">Influencer details (optional)</div>
            </div>
            <div className="md:col-span-4">
              <Label htmlFor="pfn">Full name</Label>
              <Input id="pfn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="pbd">Birthday</Label>
              <Input id="pbd" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="pig">Instagram handle</Label>
              <Input id="pig" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@janedoe" />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="pph">Phone</Label>
              <Input id="pph" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 246 …" />
            </div>

            <div className="md:col-span-12">
              <Button
                type="submit"
                variant="afp-primary"
                size="afp"
                disabled={busy || lookup.status === "checking" || lookup.status === "missing"}
              >
                {busy ? "Creating…" : "Create code"}
              </Button>
            </div>
          </form>
        </section>

        {/* Influencer rollup */}
        <section>
          <h2 className="eyebrow text-graphite mb-4">Influencers</h2>
          {loading ? (
            <div className="text-graphite">Loading…</div>
          ) : influencerRows.length === 0 ? (
            <div className="text-graphite">No influencers yet — create a code above.</div>
          ) : (
            <div className="border border-border bg-card divide-y divide-border">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-graphite border-b border-border">
                <div className="col-span-4">Influencer</div>
                <div className="col-span-2">Codes</div>
                <div className="col-span-1 text-right">Uses</div>
                <div className="col-span-1 text-right">Earned</div>
                <div className="col-span-1 text-right">Paid out</div>
                <div className="col-span-1 text-right">Owed</div>
                <div className="col-span-2 text-right">Record payout</div>
              </div>
              {influencerRows.map((row) => {
                const p = profiles[row.user_id];
                const displayName = p?.full_name || row.email;
                const bday = p?.birthday ? formatBirthday(p.birthday) : null;
                return (
                <div key={row.user_id} className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-4 items-center">
                  <div className="md:col-span-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{displayName}</div>
                      <button
                        type="button"
                        onClick={() => setEditing(p ?? { user_id: row.user_id, full_name: null, birthday: null, instagram_handle: null, phone: null, notes: null })}
                        className="text-graphite hover:text-foreground shrink-0"
                        aria-label="Edit influencer details"
                        title="Edit influencer details"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                    {p?.full_name && <div className="text-[11px] text-graphite truncate">{row.email}</div>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-graphite">
                      {bday && <span className="inline-flex items-center gap-1"><Cake className="w-3 h-3" />{bday}</span>}
                      {p?.instagram_handle && <span>@{p.instagram_handle}</span>}
                      {p?.phone && <span>{p.phone}</span>}
                    </div>
                  </div>
                  <div className="md:col-span-2 flex flex-wrap gap-1">
                    {row.codes.map((c) => (
                      <span
                        key={c.code}
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                          c.active ? "border-foreground" : "border-border text-graphite line-through"
                        }`}
                        title={`${formatMoney(c.credit_value_cents)} per use`}
                      >
                        {c.code}
                      </span>
                    ))}
                  </div>
                  <div className="md:col-span-1 text-right text-sm tabular-nums">{row.uses}</div>
                  <div className="md:col-span-1 text-right text-sm tabular-nums">{formatMoney(row.earned)}</div>
                  <div className="md:col-span-1 text-right text-sm tabular-nums text-graphite">{formatMoney(row.paidOut)}</div>
                  <div className={`md:col-span-1 text-right text-sm tabular-nums font-medium ${row.balance > 0 ? "text-safety" : ""}`}>
                    {formatMoney(row.balance)}
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2 justify-end">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={payoutDraft[row.user_id] ?? ""}
                      onChange={(e) => setPayoutDraft((p) => ({ ...p, [row.user_id]: e.target.value }))}
                      className="h-9 w-24 text-right"
                      disabled={row.balance <= 0}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={row.balance <= 0}
                      onClick={() => recordPayout(row)}
                    >
                      Pay
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-graphite mt-3 uppercase tracking-wider">
            Payouts are settled externally (cash, free product, etc.) — record the amount here to clear the influencer's owed balance.
          </p>
        </section>

        {/* Codes list with pause / delete */}
        <section>
          <h2 className="eyebrow text-graphite mb-4">All codes</h2>
          {codes.length === 0 ? (
            <div className="text-graphite">No codes yet.</div>
          ) : (
            <div className="border border-border divide-y divide-border bg-card">
              {codes.map((c) => (
                <div key={c.code} className="p-4 flex flex-wrap items-center gap-4">
                  <div className="font-stencil text-xl tracking-wide w-24">{c.code}</div>
                  <div className="text-sm w-28">{formatMoney(c.credit_value_cents)} / use</div>
                  <div className="text-xs text-graphite truncate flex-1 min-w-[160px]">
                    {emails[c.influencer_user_id] ?? c.influencer_user_id.slice(0, 8) + "…"} · {c.note ?? "no note"}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleActive(c)}
                    className={`text-[11px] uppercase tracking-wider px-3 py-1 border inline-flex items-center gap-1 ${
                      c.active ? "border-foreground" : "border-border text-graphite"
                    }`}
                  >
                    {c.active ? <><Pause className="w-3 h-3" /> Active</> : <><Play className="w-3 h-3" /> Paused</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCode(c)}
                    className="p-2 text-graphite hover:text-foreground"
                    aria-label="Delete code"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Adjust customer credit */}
        <section className="border border-border p-6 md:p-8 bg-card">
          <h2 className="eyebrow text-graphite mb-2">Adjust customer credit</h2>
          <p className="text-xs text-graphite mb-4">
            For refunds, comps, or corrections. Positive amount grants credit, negative deducts. Logged on the user's ledger.
          </p>
          <form onSubmit={adjustCredit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <Label htmlFor="ae">Customer email</Label>
              <Input id="ae" type="email" value={adjEmail} onChange={(e) => setAdjEmail(e.target.value)} placeholder="customer@email.com" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="aa">Amount (BBD)</Label>
              <Input id="aa" type="number" step="0.01" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="25.00 or -10" />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="ar">Reason / note</Label>
              <Input id="ar" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="e.g. refund order #1234" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" variant="afp-primary" size="afp" className="w-full" disabled={adjBusy}>
                {adjBusy ? "Saving…" : "Apply"}
              </Button>
            </div>
          </form>
        </section>

        {/* Recent activity */}
        <section>
          <h2 className="eyebrow text-graphite mb-4">Recent activity</h2>
          {ledger.length === 0 ? (
            <div className="text-graphite">No activity yet.</div>
          ) : (
            <div className="border border-border divide-y divide-border bg-card text-sm">
              {ledger.slice(0, 50).map((r, i) => (
                <div key={r.id ?? i} className="p-3 flex flex-wrap items-center gap-3">
                  <div className="text-[11px] text-graphite w-40 shrink-0">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="text-[10px] uppercase tracking-wider w-28 shrink-0 text-graphite">
                    {r.reason.replace("_", " ")}
                  </div>
                  <div className="text-xs truncate min-w-0 flex-1">
                    {emails[r.user_id] ?? r.user_id.slice(0, 8) + "…"}
                    {r.source_code && <span className="ml-2 font-stencil">{r.source_code}</span>}
                    {r.order_ref && <span className="ml-2 text-graphite">· {r.order_ref}</span>}
                  </div>
                  <div className={`tabular-nums font-medium shrink-0 ${r.amount_cents < 0 ? "text-graphite" : "text-foreground"}`}>
                    {r.amount_cents < 0 ? "−" : "+"}{formatMoney(Math.abs(r.amount_cents))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
      <ProfileEditor
        profile={editing}
        email={editing ? (emails[editing.user_id] ?? "") : ""}
        onClose={() => setEditing(null)}
        onSaved={(p) => {
          setProfiles((prev) => ({ ...prev, [p.user_id]: p }));
          setEditing(null);
          toast.success("Influencer details saved");
        }}
      />
    </div>
  );
}

function formatBirthday(iso: string): string {
  // Render as "Mar 14" so the year (often unknown / not relevant) stays out of the way.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function ProfileEditor({
  profile, email, onClose, onSaved,
}: {
  profile: InfluencerProfile | null;
  email: string;
  onClose: () => void;
  onSaved: (p: InfluencerProfile) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [instagram, setInstagram] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setBirthday(profile?.birthday ?? "");
    setInstagram(profile?.instagram_handle ?? "");
    setPhone(profile?.phone ?? "");
    setNotes(profile?.notes ?? "");
  }, [profile]);

  if (!profile) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const patch = {
      user_id: profile.user_id,
      full_name: fullName.trim() || null,
      birthday: birthday || null,
      instagram_handle: instagram.trim() ? instagram.trim().replace(/^@/, "") : null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };
    const { data, error } = await supabase
      .from("influencer_profiles")
      .upsert(patch, { onConflict: "user_id" })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    onSaved(data as InfluencerProfile);
  };

  return (
    <Dialog open={!!profile} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Influencer details</DialogTitle>
          <DialogDescription>{email || "—"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="ef">Full name</Label>
            <Input id="ef" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eb">Birthday</Label>
              <Input id="eb" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ep">Phone</Label>
              <Input id="ep" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 246 …" />
            </div>
          </div>
          <div>
            <Label htmlFor="ei">Instagram handle</Label>
            <Input id="ei" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@janedoe" />
          </div>
          <div>
            <Label htmlFor="en">Internal notes</Label>
            <Input id="en" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="afp-primary" size="afp" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-graphite eyebrow text-[10px]">
        {icon} {label}
      </div>
      <div className="font-serif text-3xl mt-2 tabular-nums">{value}</div>
      <div className="text-[10px] text-graphite mt-1 uppercase tracking-wider">{hint}</div>
    </div>
  );
}