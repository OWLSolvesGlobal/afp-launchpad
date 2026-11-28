import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PickupLocation } from "@/lib/orders-core";
import { adminGet, adminPost, when, type AdminError, type AdminSettings } from "./api";
import { ErrorNote, Skeleton, card, inputCls, primaryBtn, quietBtn, secondaryBtn } from "./parts";

const EMPTY_BANK = { bank: "", accountName: "", accountNumber: "", branch: "", swift: "" };

function TextField({
  label,
  hint,
  value,
  onChange,
  error,
  ...input
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? hintId : undefined}
        className={inputCls}
        autoComplete={input.autoComplete ?? "off"}
        inputMode={input.inputMode}
      />
      {(error || hint) && (
        <p id={hintId} role={error ? "alert" : undefined} className={`text-xs mt-1.5 ${error ? "text-destructive" : "text-graphite"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Bank details and pickup locations. The only place either is ever typed. */
export default function Settings() {
  const client = useQueryClient();
  const query = useQuery<AdminSettings, AdminError>({ queryKey: ["admin", "settings"], queryFn: () => adminGet("settings") });
  const [editingBank, setEditingBank] = useState(false);
  const [bank, setBank] = useState(EMPTY_BANK);
  const [bankError, setBankError] = useState<{ field?: string; message: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [places, setPlaces] = useState<PickupLocation[] | null>(null);
  const [placesError, setPlacesError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (query.data && places === null) setPlaces(query.data.pickupLocations);
  }, [query.data, places]);

  const save = async (path: string, body: unknown, done: string, onError: (e: AdminError) => void) => {
    setBusy(path);
    try {
      const fresh = await adminPost<AdminSettings>(path, body);
      client.setQueryData(["admin", "settings"], fresh);
      toast.success(done);
      return fresh;
    } catch (e) {
      onError(e as AdminError);
      return null;
    } finally {
      setBusy("");
    }
  };

  if (query.isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading settings">
        <h1 className="display-lg">Settings.</h1>
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="space-y-6">
        <h1 className="display-lg">Settings.</h1>
        <ErrorNote message={query.error?.message ?? "We couldn't load settings."} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const saved = query.data.bank;
  const fieldError = (name: string) => (bankError?.field === name ? bankError.message : undefined);

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="display-lg">Settings.</h1>

      <section aria-labelledby="set-bank" className={`${card} p-5 md:p-6 space-y-5`}>
        <div>
          <h2 id="set-bank" className="font-serif text-2xl">
            Bank details
          </h2>
          <p className="text-sm text-graphite mt-1">
            Shown to a customer only once they have reserved an order and chosen bank transfer.{" "}
            {saved ? "Bank transfer is on at checkout." : "Until these are saved, checkout offers CIBC 1st Pay only."}
          </p>
        </div>

        {saved && !editingBank && (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {(
                [
                  ["Bank", saved.bank],
                  ["Account name", saved.accountName],
                  ["Account number", saved.accountNumberMasked],
                  ["Branch", saved.branch || "Not given"],
                  ["SWIFT code", saved.swift || "Not given"],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] text-graphite uppercase tracking-wider">{label}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {saved.updatedAt && (
              <p className="text-xs text-graphite">
                Last changed {when(saved.updatedAt)} by {saved.updatedBy?.split("@")[0]}.
              </p>
            )}
            {confirmRemove ? (
              <div className="border border-border rounded-2xl p-4 space-y-3">
                <p className="text-sm">Remove the bank details? Bank transfer will disappear from checkout.</p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <button
                    type="button"
                    className={secondaryBtn}
                    disabled={busy !== ""}
                    onClick={async () => {
                      await save("settings/bank/clear", {}, "Bank details removed", (e) => setBankError({ message: e.message }));
                      setConfirmRemove(false);
                    }}
                  >
                    Yes, remove them
                  </button>
                  <button type="button" className={quietBtn} onClick={() => setConfirmRemove(false)}>
                    Keep them
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <button
                  type="button"
                  className={secondaryBtn}
                  onClick={() => {
                    // The account number is never sent back to this screen, so it is typed again in full.
                    setBank({ bank: saved.bank, accountName: saved.accountName, accountNumber: "", branch: saved.branch, swift: saved.swift });
                    setBankError(null);
                    setEditingBank(true);
                  }}
                >
                  Change bank details
                </button>
                <button type="button" className={quietBtn} onClick={() => setConfirmRemove(true)}>
                  Remove
                </button>
              </div>
            )}
          </>
        )}

        {(!saved || editingBank) && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBankError(null);
              const fresh = await save("settings/bank", bank, "Bank details saved", (err) => setBankError({ field: err.field, message: err.message }));
              if (fresh) {
                setEditingBank(false);
                setBank(EMPTY_BANK);
              }
            }}
          >
            <TextField label="Bank" value={bank.bank} onChange={(v) => setBank({ ...bank, bank: v })} error={fieldError("bank")} />
            <TextField label="Account name" value={bank.accountName} onChange={(v) => setBank({ ...bank, accountName: v })} error={fieldError("accountName")} />
            <TextField
              label="Account number"
              hint={saved ? "For safety the saved number isn't shown. Type it again in full." : "Digits only."}
              value={bank.accountNumber}
              onChange={(v) => setBank({ ...bank, accountNumber: v })}
              error={fieldError("accountNumber")}
              inputMode="numeric"
            />
            <TextField label="Branch (optional)" value={bank.branch} onChange={(v) => setBank({ ...bank, branch: v })} error={fieldError("branch")} />
            <TextField
              label="SWIFT code (optional)"
              hint="For customers paying from overseas. 8 or 11 letters and numbers."
              value={bank.swift}
              onChange={(v) => setBank({ ...bank, swift: v })}
              error={fieldError("swift")}
            />
            {bankError && !bankError.field && <ErrorNote message={bankError.message} />}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <button type="submit" className={primaryBtn} disabled={busy !== ""}>
                {busy === "settings/bank" ? "Saving…" : "Save bank details"}
              </button>
              {editingBank && (
                <button type="button" className={quietBtn} onClick={() => setEditingBank(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      <section aria-labelledby="set-pickup" className={`${card} p-5 md:p-6 space-y-5`}>
        <div>
          <h2 id="set-pickup" className="font-serif text-2xl">
            Pickup locations
          </h2>
          <p className="text-sm text-graphite mt-1">Customers choosing pickup pick one of these at checkout.</p>
        </div>
        <div className="space-y-4">
          {(places ?? []).map((p, i) => (
            <fieldset key={i} className="border border-border rounded-2xl p-4 space-y-3">
              <legend className="px-2 text-[11px] text-graphite uppercase tracking-wider">Location {i + 1}</legend>
              <TextField label="Name" value={p.name} onChange={(v) => setPlaces(places!.map((x, j) => (j === i ? { ...x, name: v } : x)))} />
              <TextField label="Where" value={p.address} onChange={(v) => setPlaces(places!.map((x, j) => (j === i ? { ...x, address: v } : x)))} />
              <TextField label="When" value={p.hours} onChange={(v) => setPlaces(places!.map((x, j) => (j === i ? { ...x, hours: v } : x)))} />
              {(places ?? []).length > 1 && (
                <button type="button" className={quietBtn} onClick={() => setPlaces(places!.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove this location
                </button>
              )}
            </fieldset>
          ))}
        </div>
        {placesError && <ErrorNote message={placesError} />}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            type="button"
            className={primaryBtn}
            disabled={busy !== ""}
            onClick={async () => {
              setPlacesError("");
              const fresh = await save("settings/pickup", { locations: places }, "Pickup locations saved", (e) => setPlacesError(e.message));
              if (fresh) setPlaces(fresh.pickupLocations);
            }}
          >
            {busy === "settings/pickup" ? "Saving…" : "Save pickup locations"}
          </button>
          {(places ?? []).length < 6 && (
            <button type="button" className={quietBtn} onClick={() => setPlaces([...(places ?? []), { name: "", address: "", hours: "" }])}>
              <Plus className="w-4 h-4" aria-hidden="true" /> Add a location
            </button>
          )}
        </div>
      </section>

      <Link
        to="/admin/activity"
        className={`${card} flex items-center justify-between gap-4 p-5 md:p-6 hover:border-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40`}
      >
        <span>
          <span className="block font-serif text-2xl">Activity record</span>
          <span className="block text-sm text-graphite mt-1">Who did what to each order, and when. For when you need to check.</span>
        </span>
        <ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
      </Link>

      <p className="text-sm text-graphite">
        Items, sizes, prices, stock and photos are managed in Loyverse, as always. The shop follows within about six minutes.
      </p>
    </div>
  );
}
