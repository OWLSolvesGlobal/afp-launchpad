import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AdminGate } from "@/components/admin/AdminGate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Copy } from "lucide-react";

interface SyncRow {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_processed: number;
  errors: { row?: number; id?: string; message: string }[];
  triggered_by: string | null;
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const SYNC_URL = `${FUNCTIONS_BASE}/sync-products`;

function SyncInner() {
  const [logs, setLogs] = useState<SyncRow[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const { data } = await supabase
      .from("sync_log").select("*")
      .order("started_at", { ascending: false }).limit(10);
    setLogs((data ?? []) as SyncRow[]);
  };

  useEffect(() => { refresh(); }, []);

  const runSync = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(SYNC_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "sync failed");
      toast.success(`Synced ${j.rows_processed} rows · ${j.errors?.length ?? 0} errors`);
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const appsScript = `// Paste in Extensions → Apps Script in your sheet
const SYNC_URL = "${SYNC_URL}";
const SYNC_TOKEN = "PASTE_SYNC_SHARED_SECRET_HERE";

function onEdit(e) {
  // Debounce: write a flag, the time-driven trigger flushes it.
  PropertiesService.getScriptProperties().setProperty("dirty", "1");
}

function flushSync() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("dirty") !== "1") return;
  props.deleteProperty("dirty");
  UrlFetchApp.fetch(SYNC_URL, {
    method: "post",
    headers: { "X-Sync-Token": SYNC_TOKEN },
    muteHttpExceptions: true,
  });
}

// Run once from the editor to install the 30s flush trigger:
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "flushSync") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("flushSync").timeBased().everyMinutes(1).create();
}`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main id="main" className="flex-1 container pt-28 pb-24 max-w-4xl">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow text-graphite">Admin / Sync</div>
          <Link to="/admin/images" className="eyebrow text-xs underline underline-offset-4">Manage images →</Link>
        </div>
        <h1 className="display-lg mb-2">Catalog sync<span className="text-safety">.</span></h1>
        <p className="text-sm text-graphite mb-8">
          Pull the latest catalog from the Google Sheet into the database.
        </p>

        <Button onClick={runSync} disabled={busy} className="mb-10">
          <RefreshCw className={`w-4 h-4 mr-2 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Syncing…" : "Sync now"}
        </Button>

        <h2 className="eyebrow mb-3">Recent runs</h2>
        <div className="border border-border bg-card divide-y divide-border mb-12">
          {logs.length === 0 && <div className="p-4 text-sm text-graphite">No runs yet.</div>}
          {logs.map((l) => (
            <div key={l.id} className="p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className={`eyebrow ${l.status === "completed" ? "text-foreground" : l.status === "failed" ? "text-safety" : "text-graphite"}`}>
                  {l.status}
                </span>
                <span className="text-graphite text-xs">{new Date(l.started_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-graphite text-xs">
                {l.rows_processed} rows · {l.triggered_by ?? "unknown"}
                {l.errors?.length ? ` · ${l.errors.length} errors` : ""}
              </div>
              {l.errors?.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-graphite">Show errors</summary>
                  <ul className="mt-2 space-y-1 font-mono">
                    {l.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>row {e.row ?? "?"}{e.id ? ` (${e.id})` : ""}: {e.message}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>

        <h2 className="eyebrow mb-3">Apps Script (paste into your sheet once)</h2>
        <p className="text-sm text-graphite mb-3">
          In the sheet → Extensions → Apps Script → replace <code>Code.gs</code> with the snippet below.
          Replace <code>PASTE_SYNC_SHARED_SECRET_HERE</code> with the value you stored as <code>SYNC_SHARED_SECRET</code>,
          then run <code>installTrigger</code> once from the Apps Script editor.
        </p>
        <div className="relative">
          <Button
            type="button" variant="outline" size="sm"
            className="absolute top-3 right-3"
            onClick={() => { navigator.clipboard.writeText(appsScript); toast.success("Snippet copied"); }}
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy
          </Button>
          <pre className="bg-card border border-border p-4 text-xs overflow-x-auto whitespace-pre-wrap">{appsScript}</pre>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function AdminSync() {
  return <AdminGate><SyncInner /></AdminGate>;
}