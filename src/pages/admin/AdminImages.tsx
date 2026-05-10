import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AdminGate } from "@/components/admin/AdminGate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2, Trash2, Star, UploadCloud, Search, Check, AlertCircle, RefreshCw, Pencil, ExternalLink,
} from "lucide-react";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Row {
  id: string;
  slug: string;
  name: string;
  gender: string;
  category: string;
  images: string[];
  busy: boolean;
  // edit state
  draftName: string;
  draftSlug: string;
  slugTouched: boolean;
  state: SaveState;
  err?: string;
}

/** URL-safe slug from a free-form name. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['"]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uploadOne(file: File, token: string): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-product-image`;
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Upload failed");
  return j.url as string;
}

async function pushToSheet(id: string, fields: Record<string, string>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-sheet-product`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, fields }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Sheet write failed");
}

function Workbench() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "missing" | "men" | "women">("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,slug,name,gender,category,images")
      .order("gender")
      .order("id");
    if (error) { toast.error(error.message); setLoading(false); return; }
    setRows((data ?? []).map((r: any): Row => ({
      id: r.id, slug: r.slug, name: r.name, gender: r.gender, category: r.category,
      images: r.images ?? [], busy: false,
      draftName: r.name, draftSlug: r.slug, slugTouched: false, state: "idle",
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));

  // ============ IMAGE OPERATIONS ============
  const persistImages = async (id: string, images: string[]) => {
    const { error } = await supabase.from("products").update({ images }).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const handleFiles = async (row: Row, files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    update(row.id, { busy: true });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not signed in"); update(row.id, { busy: false }); return; }
    const uploaded: string[] = [];
    for (const f of list) {
      try { uploaded.push(await uploadOne(f, session.access_token)); }
      catch (e: any) { toast.error(`${f.name}: ${e.message}`); }
    }
    const next = [...row.images, ...uploaded];
    const ok = await persistImages(row.id, next);
    update(row.id, { images: ok ? next : row.images, busy: false });
    if (ok && uploaded.length) toast.success(`Added ${uploaded.length} to ${row.name}`);
  };

  const removeAt = async (row: Row, idx: number) => {
    const next = row.images.filter((_, i) => i !== idx);
    if (await persistImages(row.id, next)) update(row.id, { images: next });
  };

  const makePrimary = async (row: Row, idx: number) => {
    if (idx === 0) return;
    const next = [row.images[idx], ...row.images.filter((_, i) => i !== idx)];
    if (await persistImages(row.id, next)) update(row.id, { images: next });
  };

  // ============ NAME / SLUG SAVE (debounced) ============
  const timers = useRef<Record<string, number>>({});

  const queueSave = (row: Row, name: string, slug: string) => {
    if (timers.current[row.id]) window.clearTimeout(timers.current[row.id]);
    update(row.id, { state: "idle" });
    timers.current[row.id] = window.setTimeout(async () => {
      const cleanSlug = slugify(slug) || row.id;
      const cleanName = name.trim() || row.name;
      // No-op if nothing changed
      if (cleanName === row.name && cleanSlug === row.slug) {
        update(row.id, { state: "idle" });
        return;
      }
      update(row.id, { state: "saving", err: undefined });
      // 1. DB update
      const { error } = await supabase
        .from("products")
        .update({ name: cleanName, slug: cleanSlug })
        .eq("id", row.id);
      if (error) {
        update(row.id, { state: "error", err: error.message });
        return;
      }
      // 2. Sheet write-back
      try {
        await pushToSheet(row.id, { name: cleanName, slug: cleanSlug });
      } catch (e: any) {
        // DB succeeded, sheet failed — surface but don't roll back
        update(row.id, {
          name: cleanName, slug: cleanSlug, draftName: cleanName, draftSlug: cleanSlug,
          state: "error", err: `Saved on site, sheet failed: ${e.message}`,
        });
        return;
      }
      update(row.id, {
        name: cleanName, slug: cleanSlug,
        draftName: cleanName, draftSlug: cleanSlug,
        state: "saved", err: undefined,
      });
      window.setTimeout(() => update(row.id, { state: "idle" }), 1800);
    }, 700);
  };

  const onNameChange = (row: Row, val: string) => {
    const nextSlug = row.slugTouched ? row.draftSlug : slugify(val);
    update(row.id, { draftName: val, draftSlug: nextSlug });
    queueSave(row, val, nextSlug);
  };
  const onSlugChange = (row: Row, val: string) => {
    update(row.id, { draftSlug: val, slugTouched: true });
    queueSave(row, row.draftName, val);
  };

  // ============ FILTERED VIEW ============
  const filtered = useMemo(() => {
    let r = rows;
    if (tab === "missing") r = r.filter((x) => x.images.length === 0);
    else if (tab === "men" || tab === "women") r = r.filter((x) => x.gender === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((x) =>
        x.name.toLowerCase().includes(q) ||
        x.slug.toLowerCase().includes(q) ||
        x.id.toLowerCase().includes(q) ||
        x.category.toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, query, tab]);

  const counts = useMemo(() => ({
    all: rows.length,
    missing: rows.filter((r) => r.images.length === 0).length,
    men: rows.filter((r) => r.gender === "men").length,
    women: rows.filter((r) => r.gender === "women").length,
  }), [rows]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main id="main" className="flex-1 container pt-24 pb-24 max-w-6xl">
        {/* Title bar */}
        <div className="flex items-end justify-between gap-4 mb-2">
          <div>
            <div className="eyebrow text-graphite">Admin / Workbench</div>
            <h1 className="display-md mt-1">Products<span className="text-safety">.</span></h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link to="/admin/sync" className="eyebrow underline underline-offset-4">Sync</Link>
            <Link to="/admin/upload" className="eyebrow underline underline-offset-4">Upload only</Link>
            <button onClick={load} className="eyebrow inline-flex items-center gap-1.5 underline underline-offset-4">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>
        <p className="text-sm text-graphite mb-6 max-w-2xl">
          Edit names, manage gallery images, set the main shot. Name changes auto-update the URL slug
          on the site <em>and</em> push back to the Google Sheet — no background work needed.
        </p>

        {/* Sticky toolbar */}
        <div className="sticky top-16 z-20 bg-background/95 backdrop-blur border-b border-border -mx-5 px-5 lg:mx-0 lg:px-0 lg:border-0 py-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-graphite" />
              <Input
                placeholder="Search by name, slug, id, category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "missing", "men", "women"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`eyebrow text-[10px] px-3 py-1.5 border ${
                    tab === t ? "bg-ink text-bone border-ink" : "border-border hover:border-ink"
                  }`}
                >
                  {t} <span className="opacity-60">({counts[t]})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-graphite eyebrow">Loading…</div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((row) => (
              <ProductRow
                key={row.id} row={row}
                onFiles={handleFiles}
                onRemove={removeAt}
                onPrimary={makePrimary}
                onNameChange={onNameChange}
                onSlugChange={onSlugChange}
              />
            ))}
            {!filtered.length && (
              <li className="py-16 text-center text-sm text-graphite border border-dashed border-border">
                Nothing matches.
              </li>
            )}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}

function StateChip({ state, err }: { state: SaveState; err?: string }) {
  if (state === "saving") return (
    <span className="inline-flex items-center gap-1 text-[10px] eyebrow text-graphite">
      <Loader2 className="w-3 h-3 animate-spin" /> Saving…
    </span>
  );
  if (state === "saved") return (
    <span className="inline-flex items-center gap-1 text-[10px] eyebrow text-foreground">
      <Check className="w-3 h-3" /> Saved · sheet updated
    </span>
  );
  if (state === "error") return (
    <span title={err} className="inline-flex items-center gap-1 text-[10px] eyebrow text-safety">
      <AlertCircle className="w-3 h-3" /> {err?.slice(0, 60) ?? "Error"}
    </span>
  );
  return null;
}

function ProductRow({
  row, onFiles, onRemove, onPrimary, onNameChange, onSlugChange,
}: {
  row: Row;
  onFiles: (row: Row, files: FileList | File[]) => void;
  onRemove: (row: Row, idx: number) => void;
  onPrimary: (row: Row, idx: number) => void;
  onNameChange: (row: Row, val: string) => void;
  onSlugChange: (row: Row, val: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files?.length) onFiles(row, e.dataTransfer.files);
  };

  return (
    <li className="bg-card border border-border rounded-sm p-4 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
      {/* Left: identity & name editor */}
      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="eyebrow text-graphite text-[10px]">{row.gender} · {row.category} · {row.id}</div>
          <a
            href={`/product/${row.slug}`} target="_blank" rel="noreferrer"
            title="View on site"
            className="text-graphite hover:text-ink transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <label className="block">
          <span className="text-[10px] eyebrow text-graphite flex items-center gap-1">
            <Pencil className="w-2.5 h-2.5" /> Name
          </span>
          <Input
            value={row.draftName}
            onChange={(e) => onNameChange(row, e.target.value)}
            className="mt-1 font-medium"
          />
        </label>

        <label className="block">
          <span className="text-[10px] eyebrow text-graphite">URL slug</span>
          <Input
            value={row.draftSlug}
            onChange={(e) => onSlugChange(row, e.target.value)}
            className="mt-1 font-mono text-xs"
          />
          <span className="text-[10px] text-graphite mt-1 block truncate">/product/{row.draftSlug}</span>
        </label>

        <div className="h-4"><StateChip state={row.state} err={row.err} /></div>
      </div>

      {/* Right: gallery */}
      <div className="min-w-0">
        {row.images.length > 0 && (
          <ul className="flex flex-wrap gap-2 mb-3">
            {row.images.map((src, i) => (
              <li key={src + i} className="relative group w-20 h-24 bg-muted overflow-hidden border border-border">
                <img src={src} alt="" className="w-full h-full object-cover" />
                {i === 0 && (
                  <span className="absolute top-1 left-1 bg-ink text-bone text-[8px] uppercase tracking-wider px-1 py-0.5">Main</span>
                )}
                <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {i !== 0 && (
                    <button onClick={() => onPrimary(row, i)} title="Make main" className="p-1.5 bg-bone text-ink hover:bg-safety hover:text-bone">
                      <Star className="w-3 h-3" />
                    </button>
                  )}
                  <button onClick={() => onRemove(row, i)} title="Remove" className="p-1.5 bg-bone text-ink hover:bg-safety hover:text-bone">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`block border-2 border-dashed rounded-md px-4 py-4 text-center cursor-pointer transition-colors ${
            dragging ? "border-ink bg-muted/50" : "border-border hover:bg-muted/30"
          }`}
        >
          <input
            type="file" accept="image/*" multiple className="sr-only"
            disabled={row.busy}
            onChange={(e) => e.target.files && onFiles(row, e.target.files)}
          />
          {row.busy ? (
            <div className="flex items-center justify-center gap-2 text-sm text-graphite">
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm">
              <UploadCloud className="w-4 h-4 text-graphite" />
              <span>{row.images.length === 0 ? "Drop images, or click to choose" : "Add more"}</span>
            </div>
          )}
        </label>
      </div>
    </li>
  );
}

export default function AdminImages() {
  return <AdminGate><Workbench /></AdminGate>;
}