import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, AlertCircle, Boxes } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Cell {
  size: string;
  color: string;
  qty: number;
  state: "idle" | "saving" | "saved" | "error";
  err?: string;
}

/** Editable size × color stock matrix for one product. Saves on debounce. */
export function StockGrid({
  productId, sizes, colors,
}: {
  productId: string;
  sizes: string[];
  colors: { name: string; hex?: string }[];
}) {
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [loading, setLoading] = useState(true);
  const timers = useRef<Record<string, number>>({});

  const key = (s: string, c: string) => `${s}|${c}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("product_stock")
        .select("size,color,quantity")
        .eq("product_id", productId);
      if (cancelled) return;
      if (error) { toast.error(error.message); setLoading(false); return; }
      const next: Record<string, Cell> = {};
      for (const s of sizes) {
        for (const c of colors) {
          const found = (data ?? []).find((r) => r.size === s && r.color === c.name);
          next[key(s, c.name)] = {
            size: s, color: c.name,
            qty: found?.quantity ?? 0,
            state: "idle",
          };
        }
      }
      setCells(next);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [productId, sizes.join("|"), colors.map((c) => c.name).join("|")]);

  const save = (s: string, c: string, qty: number) => {
    const k = key(s, c);
    setCells((prev) => ({ ...prev, [k]: { ...prev[k], qty, state: "saving", err: undefined } }));
    if (timers.current[k]) window.clearTimeout(timers.current[k]);
    timers.current[k] = window.setTimeout(async () => {
      const safe = Number.isFinite(qty) && qty >= 0 ? Math.floor(qty) : 0;
      const { error } = await supabase
        .from("product_stock")
        .upsert(
          { product_id: productId, size: s, color: c, quantity: safe, updated_at: new Date().toISOString() },
          { onConflict: "product_id,size,color" },
        );
      setCells((prev) => ({
        ...prev,
        [k]: error
          ? { ...prev[k], state: "error", err: error.message }
          : { ...prev[k], state: "saved" },
      }));
      if (!error) {
        window.setTimeout(() => {
          setCells((prev) => prev[k] ? { ...prev, [k]: { ...prev[k], state: "idle" } } : prev);
        }, 1500);
      }
    }, 500);
  };

  if (loading) {
    return (
      <div className="text-xs text-graphite eyebrow inline-flex items-center gap-2 py-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading stock…
      </div>
    );
  }

  if (!sizes.length || !colors.length) {
    return (
      <p className="text-xs text-graphite py-2">
        Add sizes and colors in the Google Sheet to enable stock tracking for this product.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-2 mb-2 text-[10px] eyebrow text-graphite">
        <Boxes className="w-3 h-3" /> Stock per size · color
      </div>
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left p-1.5 text-[10px] eyebrow text-graphite">Size \ Color</th>
            {colors.map((c) => (
              <th key={c.name} className="p-1.5 text-[10px] eyebrow text-graphite text-left whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  {c.hex && (
                    <span
                      className="w-3 h-3 rounded-full border border-border inline-block"
                      style={{ backgroundColor: c.hex }}
                    />
                  )}
                  {c.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={s}>
              <th className="text-left p-1.5 font-medium text-foreground">{s}</th>
              {colors.map((c) => {
                const cell = cells[key(s, c.name)];
                if (!cell) return <td key={c.name} />;
                return (
                  <td key={c.name} className="p-1">
                    <div className="relative">
                      <Input
                        type="number" inputMode="numeric" min={0}
                        value={cell.qty}
                        onChange={(e) => save(s, c.name, Number(e.target.value))}
                        className={`h-8 w-20 text-xs pr-6 ${
                          cell.state === "error" ? "border-safety" : ""
                        }`}
                        title={cell.err}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        {cell.state === "saving" && <Loader2 className="w-3 h-3 animate-spin text-graphite" />}
                        {cell.state === "saved" && <Check className="w-3 h-3 text-foreground" />}
                        {cell.state === "error" && <AlertCircle className="w-3 h-3 text-safety" />}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}