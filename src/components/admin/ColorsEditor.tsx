import { useState } from "react";
import { Plus, Trash2, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface ColorWay {
  name: string;
  hex: string;
}

/** Inline editor for a product's colorway list. Calls onChange after each commit. */
export function ColorsEditor({
  colors, onChange, disabled,
}: {
  colors: ColorWay[];
  onChange: (next: ColorWay[]) => void;
  disabled?: boolean;
}) {
  const [draftName, setDraftName] = useState("");
  const [draftHex, setDraftHex] = useState("#000000");

  const update = (idx: number, patch: Partial<ColorWay>) => {
    const next = colors.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };

  const remove = (idx: number) => {
    if (!confirm(`Delete the "${colors[idx].name}" colorway? Stock rows for this color will also be removed.`)) return;
    onChange(colors.filter((_, i) => i !== idx));
  };

  const add = () => {
    const name = draftName.trim();
    if (!name) return;
    if (colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    onChange([...colors, { name, hex: draftHex || "#000000" }]);
    setDraftName("");
    setDraftHex("#000000");
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[10px] eyebrow text-graphite">
        <Palette className="w-3 h-3" /> Colorways
      </div>

      {colors.length === 0 && (
        <p className="text-xs text-graphite mb-2">No colorways yet — add one below.</p>
      )}

      <ul className="space-y-1.5 mb-3">
        {colors.map((c, i) => (
          <li key={`${c.name}-${i}`} className="flex items-center gap-2">
            <input
              type="color"
              value={c.hex || "#000000"}
              onChange={(e) => update(i, { hex: e.target.value })}
              disabled={disabled}
              aria-label={`${c.name} swatch`}
              className="w-8 h-8 border border-border bg-transparent cursor-pointer disabled:cursor-not-allowed"
            />
            <Input
              value={c.name}
              onChange={(e) => update(i, { name: e.target.value })}
              disabled={disabled}
              className="h-8 text-xs flex-1"
            />
            <Input
              value={c.hex}
              onChange={(e) => update(i, { hex: e.target.value })}
              disabled={disabled}
              className="h-8 text-xs font-mono w-24"
              placeholder="#000000"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled}
              title="Delete colorway"
              className="p-1.5 text-graphite hover:text-safety transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 pt-2 border-t border-dashed border-border">
        <input
          type="color"
          value={draftHex}
          onChange={(e) => setDraftHex(e.target.value)}
          aria-label="New colorway swatch"
          className="w-8 h-8 border border-border bg-transparent cursor-pointer"
        />
        <Input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="New colorway name (e.g. Onyx)"
          className="h-8 text-xs flex-1"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={add}
          disabled={disabled || !draftName.trim()}
          className="inline-flex items-center gap-1 eyebrow text-[10px] px-2.5 h-8 border border-border hover:border-ink disabled:opacity-40"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}