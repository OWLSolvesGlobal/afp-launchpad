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
  Loader2, Trash2, Star, UploadCloud, Search, Check, AlertCircle, RefreshCw, Pencil, ExternalLink, Boxes, ChevronDown, ChevronUp, Palette, Plus, DollarSign, X,
} from "lucide-react";
import { StockGrid } from "@/components/admin/StockGrid";
import { ColorsEditor, type ColorWay } from "@/components/admin/ColorsEditor";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Row {
  id: string;
  slug: string;
  name: string;
  gender: string;
  category: string;
  images: string[];
  sizes: string[];
  colors: ColorWay[];
  priceCents: number;
  busy: boolean;
  // edit state
  draftName: string;
  draftSlug: string;
  draftPrice: string;       // dollars, free text while editing
  slugTouched: boolean;
  state: SaveState;
  err?: string;
  deleting?: boolean;
}

interface NewProductDraft {
  id: string;
  name: string;
  slug: string;
  gender: "men" | "women";
  category: string;
  priceUsd: string;
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

async function pushToSheet(
  id: string,
  fields: Record<string, string>,
  action: "update" | "create" | "delete" = "update",
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-sheet-product`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, action, fields }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Sheet write failed");
}

function formatDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
function parseDollars(s: string): number | null {
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function Workbench() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "missing" | "men" | "women">("all");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,slug,name,gender,category,images,sizes,colors,price_cents")
      .order("gender")
      .order("id");
    if (error) { toast.error(error.message); setLoading(false); return; }
    setRows((data ?? []).map((r: any): Row => ({
      id: r.id, slug: r.slug, name: r.name, gender: r.gender, category: r.category,
      images: r.images ?? [],
      sizes: Array.isArray(r.sizes) ? r.sizes : [],
      colors: Array.isArray(r.colors) ? r.colors : [],
      priceCents: r.price_cents ?? 0,
      busy: false,
      draftName: r.name, draftSlug: r.slug,
      draftPrice: formatDollars(r.price_cents ?? 0),
      slugTouched: false, state: "idle",
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

  // ============ PRICE SAVE (debounced) ============
  const priceTimers = useRef<Record<string, number>>({});
  const onPriceChange = (row: Row, val: string) => {
    update(row.id, { draftPrice: val, state: "idle" });
    if (priceTimers.current[row.id]) window.clearTimeout(priceTimers.current[row.id]);
    priceTimers.current[row.id] = window.setTimeout(async () => {
      const cents = parseDollars(val);
      if (cents == null) {
        update(row.id, { state: "error", err: "Invalid price" });
        return;
      }
      if (cents === row.priceCents) {
        update(row.id, { state: "idle" });
        return;
      }
      update(row.id, { state: "saving", err: undefined });
      const { error } = await supabase
        .from("products").update({ price_cents: cents }).eq("id", row.id);
      if (error) { update(row.id, { state: "error", err: error.message }); return; }
      try {
        await pushToSheet(row.id, { price_usd: formatDollars(cents) });
      } catch (e: any) {
        update(row.id, {
          priceCents: cents, draftPrice: formatDollars(cents),
          state: "error", err: `Saved on site, sheet failed: ${e.message}`,
        });
        return;
      }
      update(row.id, { priceCents: cents, draftPrice: formatDollars(cents), state: "saved" });
      window.setTimeout(() => update(row.id, { state: "idle" }), 1500);
    }, 700);
  };

  // ============ DELETE PRODUCT ============
  const onDelete = async (row: Row) => {
    if (!window.confirm(`Delete "${row.name}" from the site AND the Google Sheet? This cannot be undone.`)) return;
    update(row.id, { deleting: true, state: "saving" });
    // 1. Sheet first — if this fails we keep the DB row so admin can retry.
    try {
      await pushToSheet(row.id, {}, "delete");
    } catch (e: any) {
      update(row.id, { deleting: false, state: "error", err: `Sheet delete failed: ${e.message}` });
      return;
    }
    // 2. Stock rows
    await supabase.from("product_stock").delete().eq("product_id", row.id);
    // 3. Product row
    const { error } = await supabase.from("products").delete().eq("id", row.id);
    if (error) {
      update(row.id, { deleting: false, state: "error", err: error.message });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success(`Deleted ${row.name}`);
  };

  // ============ CREATE NEW PRODUCT ============
  const onCreate = async (draft: NewProductDraft): Promise<boolean> => {
    const id = draft.id.trim();
    if (!id || !draft.name.trim()) { toast.error("Name and id required"); return false; }
    if (rows.some((r) => r.id === id)) { toast.error("That id already exists"); return false; }
    const cents = parseDollars(draft.priceUsd) ?? 0;
    const slug = slugify(draft.slug || draft.name);

    // 1. Sheet first — if this fails the next sync would re-introduce drift.
    try {
      await pushToSheet(id, {
        name: draft.name.trim(),
        slug,
        gender: draft.gender,
        category: draft.category.trim().toLowerCase() || "uncategorized",
        price_usd: formatDollars(cents),
        sizes: "",
        colors: "",
        published: "TRUE",
      }, "create");
    } catch (e: any) {
      toast.error(`Sheet create failed: ${e.message}`);
      return false;
    }

    // 2. DB insert
    const { error } = await supabase.from("products").insert({
      id,
      slug,
      name: draft.name.trim(),
      gender: draft.gender,
      category: draft.category.trim().toLowerCase() || "uncategorized",
      price_cents: cents,
      colors: [],
      sizes: [],
      images: [],
      published: true,
    });
    if (error) { toast.error(`DB insert failed: ${error.message}`); return false; }

    toast.success(`Added ${draft.name}`);
    await load();
    return true;
  };

  // ============ COLORS ============
  const onColorsChange = async (row: Row, next: ColorWay[]) => {
    // Normalise: dedupe by lowercased name, ensure hex starts with #
    const seen = new Set<string>();
    const clean = next
      .map((c) => ({ name: c.name.trim(), hex: (c.hex || "#000000").trim() }))
      .filter((c) => c.name && !seen.has(c.name.toLowerCase()) && seen.add(c.name.toLowerCase()))
      .map((c) => ({ name: c.name, hex: c.hex.startsWith("#") ? c.hex : `#${c.hex}` }));

    const removed = row.colors.filter((c) => !clean.some((n) => n.name.toLowerCase() === c.name.toLowerCase()));

    // Optimistic UI
    update(row.id, { colors: clean, state: "saving", err: undefined });

    // 1. DB write
    const { error } = await supabase
      .from("products")
      .update({ colors: clean })
      .eq("id", row.id);
    if (error) {
      update(row.id, { colors: row.colors, state: "error", err: error.message });
      return;
    }

    // 2. Drop stock rows for removed colorways
    if (removed.length) {
      await supabase
        .from("product_stock")
        .delete()
        .eq("product_id", row.id)
        .in("color", removed.map((c) => c.name));
    }

    // 3. Push to sheet (Name:#hex|Name2:#hex2)
    const serialized = clean.map((c) => `${c.name}:${c.hex}`).join("|");
    try {
      await pushToSheet(row.id, { colors: serialized });
    } catch (e: any) {
      update(row.id, { state: "error", err: `Saved on site, sheet failed: ${e.message}` });
      return;
    }
    update(row.id, { state: "saved" });
    window.setTimeout(() => update(row.id, { state: "idle" }), 1500);
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
            <button
              onClick={() => setCreating(true)}
              className="ml-auto eyebrow text-[10px] px-3 py-1.5 bg-safety text-bone border border-safety hover:bg-safety-deep inline-flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" /> New product
            </button>
          </div>
        </div>

        {creating && (
          <NewProductCard
            onClose={() => setCreating(false)}
            onCreate={onCreate}
          />
        )}

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
                onColorsChange={onColorsChange}
                onPriceChange={onPriceChange}
                onDelete={onDelete}
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
  row, onFiles, onRemove, onPrimary, onNameChange, onSlugChange, onColorsChange, onPriceChange, onDelete,
}: {
  row: Row;
  onFiles: (row: Row, files: FileList | File[]) => void;
  onRemove: (row: Row, idx: number) => void;
  onPrimary: (row: Row, idx: number) => void;
  onNameChange: (row: Row, val: string) => void;
  onSlugChange: (row: Row, val: string) => void;
  onColorsChange: (row: Row, next: ColorWay[]) => void;
  onPriceChange: (row: Row, val: string) => void;
  onDelete: (row: Row) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
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

        <label className="block">
          <span className="text-[10px] eyebrow text-graphite flex items-center gap-1">
            <DollarSign className="w-2.5 h-2.5" /> Price (USD)
          </span>
          <div className="relative mt-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-graphite text-sm">$</span>
            <Input
              value={row.draftPrice}
              inputMode="decimal"
              onChange={(e) => onPriceChange(row, e.target.value)}
              className="pl-6 font-mono text-sm"
            />
          </div>
        </label>

        <div className="h-4"><StateChip state={row.state} err={row.err} /></div>

        <button
          type="button"
          onClick={() => onDelete(row)}
          disabled={row.deleting}
          className="eyebrow text-[10px] inline-flex items-center gap-1.5 text-graphite hover:text-safety transition-colors disabled:opacity-50"
        >
          {row.deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Delete product
        </button>
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
              <span>
                {row.images.length === 0
                  ? "Drop images, or click to choose (multiple = product carousel)"
                  : `Add more · ${row.images.length} in carousel`}
              </span>
            </div>
          )}
        </label>

        {/* Stock panel */}
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setColorsOpen((v) => !v)}
            className="inline-flex items-center gap-2 eyebrow text-[10px] text-graphite hover:text-ink transition-colors mr-4"
          >
            <Palette className="w-3 h-3" />
            {colorsOpen ? "Hide colorways" : `Edit colorways (${row.colors.length})`}
            {colorsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => setStockOpen((v) => !v)}
            className="inline-flex items-center gap-2 eyebrow text-[10px] text-graphite hover:text-ink transition-colors"
          >
            <Boxes className="w-3 h-3" />
            {stockOpen ? "Hide stock" : "Edit stock"}
            {stockOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {colorsOpen && (
            <div className="mt-3">
              <ColorsEditor
                colors={row.colors}
                onChange={(next) => onColorsChange(row, next)}
              />
            </div>
          )}
          {stockOpen && (
            <div className="mt-3">
              <StockGrid productId={row.id} sizes={row.sizes} colors={row.colors} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default function AdminImages() {
  return <AdminGate><Workbench /></AdminGate>;
}

function NewProductCard({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: NewProductDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<NewProductDraft>({
    id: "", name: "", slug: "", gender: "women", category: "", priceUsd: "",
  });
  const [busy, setBusy] = useState(false);

  const setField = <K extends keyof NewProductDraft>(k: K, v: NewProductDraft[K]) =>
    setDraft((d) => {
      const next = { ...d, [k]: v };
      if (k === "name" && !d.slug) next.slug = slugify(v as string);
      if (k === "name" && !d.id) next.id = slugify(v as string);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onCreate(draft);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <form
      onSubmit={submit}
      className="bg-card border border-safety rounded-sm p-4 mb-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
    >
      <div className="md:col-span-6 flex items-center justify-between">
        <span className="eyebrow text-safety">New product</span>
        <button type="button" onClick={onClose} className="text-graphite hover:text-ink">
          <X className="w-4 h-4" />
        </button>
      </div>
      <label className="md:col-span-2 block text-xs">
        <span className="eyebrow text-[10px] text-graphite">Name</span>
        <Input value={draft.name} onChange={(e) => setField("name", e.target.value)} required className="mt-1" />
      </label>
      <label className="block text-xs">
        <span className="eyebrow text-[10px] text-graphite">ID</span>
        <Input value={draft.id} onChange={(e) => setField("id", slugify(e.target.value))} required className="mt-1 font-mono" />
      </label>
      <label className="block text-xs">
        <span className="eyebrow text-[10px] text-graphite">Slug</span>
        <Input value={draft.slug} onChange={(e) => setField("slug", slugify(e.target.value))} className="mt-1 font-mono" />
      </label>
      <label className="block text-xs">
        <span className="eyebrow text-[10px] text-graphite">Gender</span>
        <select
          value={draft.gender}
          onChange={(e) => setField("gender", e.target.value as "men" | "women")}
          className="mt-1 w-full h-9 px-2 bg-background border border-input rounded-md text-sm"
        >
          <option value="women">women</option>
          <option value="men">men</option>
        </select>
      </label>
      <label className="block text-xs">
        <span className="eyebrow text-[10px] text-graphite">Category</span>
        <Input value={draft.category} onChange={(e) => setField("category", e.target.value)} placeholder="e.g. tops" className="mt-1" />
      </label>
      <label className="md:col-span-2 block text-xs">
        <span className="eyebrow text-[10px] text-graphite">Price (USD)</span>
        <Input value={draft.priceUsd} onChange={(e) => setField("priceUsd", e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 font-mono" />
      </label>
      <div className="md:col-span-4 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={busy} className="bg-safety hover:bg-safety-deep text-bone">
          {busy ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Plus className="w-3 h-3 mr-2" />}
          Create in site &amp; sheet
        </Button>
      </div>
    </form>
  );
}