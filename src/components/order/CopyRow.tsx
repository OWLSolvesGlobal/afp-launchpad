import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/** A value the customer has to type into their banking app, with a copy button. */
export function CopyRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue ?? value);
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Please type it in.");
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 border border-border rounded-xl px-4 py-3 min-h-[64px]">
      <div className="min-w-0">
        <div className="text-[11px] text-graphite uppercase tracking-wider">{label}</div>
        <div className="font-semibold text-base sm:text-lg tabular-nums break-all">{value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 h-11 min-w-11 px-4 text-xs font-medium border border-border rounded-full hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
