import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AdminGate } from "@/components/admin/AdminGate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ImageIcon, Loader2, Trash2, Star, GripVertical, UploadCloud } from "lucide-react";

interface Row {
  id: string;
  slug: string;
  name: string;
  gender: string;
  images: string[];
  busy: boolean;
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

function ImagesInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "missing">("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,slug,name,gender,images")
      .order("gender")
      .order("id");
    if (error) { toast.error(error.message); setLoading(false); return; }
    setRows((data ?? []).map((r: any) => ({ ...r, images: r.images ?? [], busy: false })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const persist = async (id: string, images: string[]) => {
    const { error } = await supabase.from("products").update({ images }).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const handleFiles = async (row: Row, files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, busy: true } : r));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not signed in"); return; }
    const uploaded: string[] = [];
    for (const f of list) {
      try { uploaded.push(await uploadOne(f, session.access_token)); }
      catch (e: any) { toast.error(`${f.name}: ${e.message}`); }
    }
    const next = [...row.images, ...uploaded];
    const ok = await persist(row.id, next);
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, images: ok ? next : r.images, busy: false } : r));
    if (ok && uploaded.length) toast.success(`Added ${uploaded.length} image${uploaded.length > 1 ? "s" : ""} to ${row.name}`);
  };

  const removeAt = async (row: Row, idx: number) => {
    const next = row.images.filter((_, i) => i !== idx);
    const ok = await persist(row.id, next);
    if (ok) setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, images: next } : r));
  };

  const makePrimary = async (row: Row, idx: number) => {
    if (idx === 0) return;
    const next = [row.images[idx], ...row.images.filter((_, i) => i !== idx)];
    const ok = await persist(row.id, next);
    if (ok) setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, images: next } : r));
  };

  const filtered = useMemo(
    () => filter === "missing" ? rows.filter((r) => r.images.length === 0) : rows,
    [rows, filter],
  );
  const missingCount = rows.filter((r) => r.images.length === 0).length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main id="main" className="flex-1 container pt-28 pb-24 max-w-5xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="eyebrow text-graphite">Admin / Product Gallery</div>
            <h1 className="display-lg mt-1">Images<span className="text-safety">.</span></h1>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/sync" className="text-xs eyebrow underline underline-offset-4">Sync</Link>
            <Link to="/admin/upload" className="text-xs eyebrow underline underline-offset-4">One-off upload</Link>
          </div>
        </div>
        <p className="text-sm text-graphite mb-6 max-w-2xl">
          Drop one or many images on a product card. They upload, attach, and appear on the storefront in seconds.
          The first image is the thumbnail used everywhere — click <Star className="inline w-3 h-3" /> to promote any image.
        </p>

        <div className="flex items-center gap-3 mb-6 text-xs">
          <button
            onClick={() => setFilter("all")}
            className={`eyebrow px-3 py-1.5 border ${filter === "all" ? "bg-ink text-bone border-ink" : "border-border"}`}
          >All ({rows.length})</button>
          <button
            onClick={() => setFilter("missing")}
            className={`eyebrow px-3 py-1.5 border ${filter === "missing" ? "bg-ink text-bone border-ink" : "border-border"}`}
          >Missing ({missingCount})</button>
        </div>

        {loading ? (
          <div className="py-24 text-center text-graphite eyebrow">Loading…</div>
        ) : (
          <ul className="space-y-4">
            {filtered.map((row) => (
              <ProductRow key={row.id} row={row} onFiles={handleFiles} onRemove={removeAt} onPrimary={makePrimary} />
            ))}
            {!filtered.length && (
              <li className="py-16 text-center text-sm text-graphite border border-dashed border-border">
                Nothing here. Add products in the Google Sheet, then hit Sync.
              </li>
            )}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ProductRow({
  row, onFiles, onRemove, onPrimary,
}: {
  row: Row;
  onFiles: (row: Row, files: FileList | File[]) => void;
  onRemove: (row: Row, idx: number) => void;
  onPrimary: (row: Row, idx: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) onFiles(row, e.dataTransfer.files);
  };

  return (
    <li className="bg-card border border-border p-4 flex flex-col md:flex-row gap-4">
      <div className="md:w-56 shrink-0">
        <div className="eyebrow text-graphite text-[10px]">{row.gender} · {row.id}</div>
        <div className="text-sm font-medium mt-1">{row.name}</div>
        <div className="text-xs text-graphite mt-1 truncate">{row.slug}</div>
      </div>

      <div className="flex-1 min-w-0">
        {/* Existing thumbs */}
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

        {/* Dropzone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`block border-2 border-dashed rounded-md px-4 py-5 text-center cursor-pointer transition-colors ${
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
              <span>{row.images.length === 0 ? "Drop images here, or click to choose" : "Add more images"}</span>
            </div>
          )}
          <div className="text-[10px] text-graphite mt-1">JPG · PNG · WebP · AVIF · max 8 MB</div>
        </label>
      </div>
    </li>
  );
}

export default function AdminImages() {
  return <AdminGate><ImagesInner /></AdminGate>;
}