import { useEffect, useId, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { PROOF_LIMITS, type PaymentMethod } from "@/lib/orders-core";
import { PROOF_ACCEPT, isFailure, uploadProof, type ApiFailure, type OrderView } from "@/lib/order-client";

const ACCEPTED = PROOF_ACCEPT.split(",");

/**
 * Choose and send proof of payment. The checks here are a courtesy so the
 * customer finds out quickly; the server checks the file again, by its
 * contents, and has the final say.
 *
 * A failed upload leaves the order untouched: the customer can pick another
 * file or try again.
 */
export function ProofUpload({
  orderRef,
  token,
  method,
  submitLabel = "Send proof of payment",
  onDone,
  onFailure,
}: {
  orderRef: string;
  token: string;
  method: PaymentMethod;
  submitLabel?: string;
  onDone: (view: OrderView) => void;
  /** Called for failures that change the order itself (expired, limit reached). */
  onFailure?: (failure: ApiFailure) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const sending = progress !== null;

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (chosen: File | null) => {
    setError("");
    if (!chosen) return;
    if (!ACCEPTED.includes(chosen.type)) {
      setFile(null);
      setError("That file isn't a photo, screenshot or PDF. Please choose a JPG, PNG, WebP or PDF.");
      return;
    }
    if (chosen.size > PROOF_LIMITS.maxBytes) {
      setFile(null);
      setError("That file is larger than 8 MB. Please choose a smaller photo, screenshot or PDF.");
      return;
    }
    if (chosen.size === 0) {
      setFile(null);
      setError("That file is empty. Please choose another.");
      return;
    }
    setFile(chosen);
  };

  const send = async () => {
    if (!file || sending) return;
    setError("");
    setProgress(0);
    const result = await uploadProof(orderRef, token, file, method, setProgress);
    setProgress(null);
    if (!isFailure(result)) {
      onDone(result);
      return;
    }
    setError(result.error);
    if (result.status === 410 || result.status === 409 || result.status === 404) onFailure?.(result);
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={inputId}
          className="flex flex-col items-center justify-center gap-2 text-center border border-dashed border-foreground/40 rounded-2xl px-5 py-8 min-h-[140px] cursor-pointer hover:bg-muted/50 transition-colors focus-within:ring-2 focus-within:ring-foreground/40"
        >
          <Upload className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
          <span className="font-medium">{file ? "Choose a different file" : "Choose your proof of payment"}</span>
          <span className="text-sm text-graphite">Photo, screenshot or PDF, up to 8 MB</span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={PROOF_ACCEPT}
            className="sr-only"
            disabled={sending}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              choose(e.target.files?.[0] ?? null);
              e.target.value = ""; // choosing the same file again still fires
            }}
          />
        </label>
      </div>

      {file && (
        <div className="flex items-center gap-4 border border-border rounded-2xl p-3">
          {/* Fixed box so the preview appearing does not move the page. */}
          <div className="w-20 h-24 shrink-0 rounded-xl bg-muted overflow-hidden grid place-items-center">
            {preview ? (
              <img src={preview} alt="Your proof of payment" className="w-full h-full object-cover" />
            ) : (
              <FileText className="w-7 h-7 text-graphite" strokeWidth={1.5} aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium break-all">{file.name}</div>
            <div className="text-xs text-graphite mt-0.5">
              {file.type === "application/pdf" ? "PDF" : "Image"} · {file.size < 1024 * 1024
                ? `${Math.max(1, Math.round(file.size / 1024))} KB`
                : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
            </div>
          </div>
        </div>
      )}

      {sending && (
        <div>
          <div
            role="progressbar"
            aria-label="Uploading your proof"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((progress ?? 0) * 100)}
            className="h-2 rounded-full bg-muted overflow-hidden"
          >
            <div className="h-full bg-foreground transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
          <p className="text-xs text-graphite mt-2">Uploading… keep this page open.</p>
        </div>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive border border-destructive/40 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={send}
        disabled={!file || sending}
        className="w-full inline-flex items-center justify-center gap-2 px-6 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors disabled:opacity-40 disabled:hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        {sending ? "Sending…" : error && file ? "Try again" : submitLabel}
      </button>

      <p className="text-xs text-graphite">
        We check every payment against our own bank record before confirming your order. Your proof is seen only by AFP.
      </p>
    </div>
  );
}
