import { useState } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AdminGate } from "@/components/admin/AdminGate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, UploadCloud } from "lucide-react";

function UploadInner() {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ name: string; url: string }[]>([]);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not signed in"); setBusy(false); return; }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-product-image`;
    const next: { name: string; url: string }[] = [];
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) { toast.error(`${f.name}: ${j.error}`); continue; }
      next.push({ name: f.name, url: j.url });
    }
    setResults((r) => [...next, ...r]);
    setBusy(false);
  };

  const copy = (u: string) => {
    navigator.clipboard.writeText(u);
    toast.success("URL copied");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main id="main" className="flex-1 container pt-28 pb-24 max-w-3xl">
        <div className="eyebrow text-graphite mb-3">Admin / Upload</div>
        <h1 className="display-lg mb-2">Product images<span className="text-safety">.</span></h1>
        <p className="text-sm text-graphite mb-8">
          Upload an image, copy the URL, paste it into the <code>image_url</code> column of the Google Sheet.
        </p>

        <label className="block border-2 border-dashed border-border rounded-md p-10 text-center cursor-pointer hover:bg-muted/30 transition-colors">
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
          <UploadCloud className="w-8 h-8 mx-auto mb-3 text-graphite" />
          <div className="text-sm font-medium">{busy ? "Uploading…" : "Click to choose images"}</div>
          <div className="text-xs text-graphite mt-1">JPG, PNG, WebP, AVIF · max 8 MB each</div>
        </label>

        {results.length > 0 && (
          <ul className="mt-8 space-y-3">
            {results.map((r) => (
              <li key={r.url} className="flex items-center gap-3 bg-card border border-border p-3">
                <img src={r.url} alt={r.name} className="w-14 h-14 object-cover bg-muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-graphite truncate">{r.url}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => copy(r.url)}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy URL
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function AdminUpload() {
  return <AdminGate><UploadInner /></AdminGate>;
}