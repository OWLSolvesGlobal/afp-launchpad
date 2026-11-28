import { useId, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Mail, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { formatBbd } from "@/lib/catalog-core";
import {
  actorName,
  adminGet,
  adminPost,
  describeAction,
  when,
  whatsappLink,
  AdminError,
  type AdminOrderDetail,
} from "./api";
import { ErrorNote, Skeleton, StatusPill, card, primaryBtn, quietBtn, secondaryBtn } from "./parts";

const METHOD: Record<string, string> = { cibc_qr: "CIBC 1st Pay", bank_transfer: "Bank transfer" };

/**
 * One order: "Did this money actually arrive?" and "What do I hand over?"
 *
 * The proof sits beside the exact amount and reference to look for in the
 * bank. It is evidence only: Mark paid stays disabled until the owner ticks
 * that she has checked the bank account herself.
 */
export default function OrderDetail() {
  const { ref = "" } = useParams();
  const client = useQueryClient();
  const confirmId = useId();
  const reasonId = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [panel, setPanel] = useState<"none" | "reject" | "cancel">("none");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [proofFailed, setProofFailed] = useState(false);

  const query = useQuery<{ order: AdminOrderDetail }, AdminError>({
    queryKey: ["admin", "order", ref],
    queryFn: () => adminGet(`orders/${ref}`),
    refetchInterval: 30_000,
  });

  const act = async (action: string, body: unknown, done: string) => {
    setBusy(action);
    setError("");
    try {
      const fresh = await adminPost<{ order: AdminOrderDetail }>(`orders/${ref}/${action}`, body);
      client.setQueryData(["admin", "order", ref], fresh);
      toast.success(done);
      setPanel("none");
      setReason("");
      setConfirmed(false);
    } catch (e) {
      const err = e as AdminError;
      setError(err.message);
      if (err.status === 409) void query.refetch();
      if (err.signedOut) void client.invalidateQueries({ queryKey: ["admin", "me"] });
    } finally {
      setBusy("");
      void client.invalidateQueries({ queryKey: ["admin", "orders"] });
      void client.invalidateQueries({ queryKey: ["admin", "summary"] });
    }
  };

  const back = (
    <Link to="/admin/orders" className={quietBtn}>
      <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All orders
    </Link>
  );

  if (query.isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading order">
        {back}
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="space-y-6">
        {back}
        <ErrorNote
          message={query.error?.status === 404 ? "We couldn't find that order." : (query.error?.message ?? "We couldn't load that order.")}
          onRetry={query.error?.status === 404 ? undefined : () => void query.refetch()}
        />
      </div>
    );
  }

  const o = query.data.order;
  const total = formatBbd(o.totalCents);
  const pickup = o.fulfillment === "pickup";
  const proofUrl = `/api/admin/orders/${o.ref}/proof?v=${encodeURIComponent(o.proofUploadedAt ?? "")}`;
  const isPdf = false; // decided by how the image loads: a PDF fails to draw and falls back to the download button
  const hello = `Hi ${o.customerName.split(" ")[0]}, this is Alo Fitness Pro about your order ${o.ref}.`;

  return (
    <div className="space-y-8">
      {back}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow text-graphite mb-2">Order {o.ref}</div>
          <h1 className="display-lg">{o.customerName}</h1>
          <p className="text-sm text-graphite mt-2">Placed {when(o.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={o.status} />
          {o.needsLoyverse && (
            <span className="inline-flex items-center h-7 px-3 rounded-full text-xs font-medium border border-dashed border-foreground/50">
              Not yet in Loyverse
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-7 space-y-6">
          {/* --- What to look for in the bank, beside the proof --- */}
          {(o.status === "proof_uploaded" || o.hasProof) && (
            <section aria-labelledby="check-payment" className={`${card} p-5 md:p-6 space-y-5`}>
              <h2 id="check-payment" className="eyebrow text-graphite">
                {o.status === "proof_uploaded" ? "Check this payment" : "Payment"}
              </h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <dt className="text-[11px] text-graphite uppercase tracking-wider">Amount to find</dt>
                  <dd className="font-serif text-3xl tabular-nums">{total}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-graphite uppercase tracking-wider">Reference to find</dt>
                  <dd className="font-semibold text-lg tabular-nums break-all">{o.ref}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-graphite uppercase tracking-wider">Paid by</dt>
                  <dd>{METHOD[o.paymentMethod ?? ""] ?? "Not stated"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-graphite uppercase tracking-wider">Proof sent</dt>
                  <dd>{when(o.proofUploadedAt) || "No proof yet"}</dd>
                </div>
              </dl>

              {o.hasProof && (
                <div className="space-y-3">
                  {!proofFailed && !isPdf && (
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="block bg-muted rounded-2xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">
                      <img
                        src={proofUrl}
                        alt={`Proof of payment sent by ${o.customerName}`}
                        className="w-full max-h-[70vh] object-contain"
                        onError={() => setProofFailed(true)}
                      />
                    </a>
                  )}
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
                    <Download className="w-4 h-4" aria-hidden="true" />
                    {proofFailed ? "Open the proof (PDF)" : "Open the proof full size"}
                  </a>
                  <p className="text-xs text-graphite">
                    A screenshot is easy to fake. It tells you what to look for; only your bank account tells you the
                    money arrived.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* --- What can be done now --- */}
          <section aria-labelledby="order-actions" className="space-y-4">
            <h2 id="order-actions" className="sr-only">
              Actions
            </h2>
            {error && <ErrorNote message={error} />}

            {o.status === "proof_uploaded" && panel === "none" && (
              <div className={`${card} p-5 md:p-6 space-y-4`}>
                <label htmlFor={confirmId} className="flex items-start gap-3 cursor-pointer min-h-11">
                  <input
                    id={confirmId}
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 w-5 h-5 accent-[hsl(var(--foreground))]"
                  />
                  <span>
                    I have checked the bank account and can see <span className="font-semibold">{total}</span> with
                    reference <span className="font-semibold">{o.ref}</span>.
                  </span>
                </label>
                <button
                  type="button"
                  className={`${primaryBtn} w-full`}
                  disabled={!confirmed || busy !== ""}
                  onClick={() => void act("paid", { confirmed: true }, "Marked paid")}
                >
                  {busy === "paid" ? "Saving…" : "Mark paid"}
                </button>
                <div className="flex flex-wrap gap-x-6">
                  <button type="button" className={quietBtn} onClick={() => setPanel("reject")}>
                    The money isn't there: reject
                  </button>
                  <button type="button" className={quietBtn} onClick={() => setPanel("cancel")}>
                    Cancel this order
                  </button>
                </div>
              </div>
            )}

            {panel === "reject" && (
              <div className={`${card} p-5 md:p-6 space-y-4`}>
                <h3 className="font-medium">Reject this proof</h3>
                <p className="text-sm text-graphite">
                  The items go back on sale and the customer sees your reason on their order page.
                </p>
                <div>
                  <label htmlFor={reasonId} className="block text-sm font-medium mb-1.5">
                    Reason the customer will see
                  </label>
                  <textarea
                    id={reasonId}
                    rows={3}
                    maxLength={300}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="For example: We could not find a payment for this amount."
                    className="w-full border border-border bg-background rounded-xl px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <button
                    type="button"
                    className={secondaryBtn}
                    disabled={reason.trim().length < 3 || busy !== ""}
                    onClick={() => void act("reject", { reason }, "Proof rejected")}
                  >
                    {busy === "reject" ? "Saving…" : "Reject and release the items"}
                  </button>
                  <button type="button" className={quietBtn} onClick={() => setPanel("none")}>
                    Go back
                  </button>
                </div>
              </div>
            )}

            {panel === "cancel" && (
              <div className={`${card} p-5 md:p-6 space-y-4`}>
                <h3 className="font-medium">Cancel this order?</h3>
                <p className="text-sm text-graphite">The items go back on sale. This can't be undone.</p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <button type="button" className={secondaryBtn} disabled={busy !== ""} onClick={() => void act("cancel", {}, "Order cancelled")}>
                    {busy === "cancel" ? "Cancelling…" : "Yes, cancel it"}
                  </button>
                  <button type="button" className={quietBtn} onClick={() => setPanel("none")}>
                    Keep the order
                  </button>
                </div>
              </div>
            )}

            {o.status === "reserved" && panel === "none" && (
              <div className={`${card} p-5 md:p-6 space-y-3`}>
                <p>
                  The customer is still paying. Their items are held until <span className="font-medium">{when(o.expiresAt)}</span>,
                  then released on their own if no proof arrives.
                </p>
                <button type="button" className={quietBtn} onClick={() => setPanel("cancel")}>
                  Cancel this order
                </button>
              </div>
            )}

            {o.status === "paid" && (
              <div className={`${card} p-5 md:p-6 space-y-3`}>
                <p>
                  Paid {when(o.paidAt)}. {pickup ? "Hand the order over, then mark it collected." : "Deliver the order, then mark it delivered."}
                </p>
                <button type="button" className={`${primaryBtn} w-full`} disabled={busy !== ""} onClick={() => void act("delivered", {}, pickup ? "Marked collected" : "Marked delivered")}>
                  {busy === "delivered" ? "Saving…" : pickup ? "Mark collected" : "Mark delivered"}
                </button>
              </div>
            )}

            {o.needsLoyverse && (
              <div className="border border-dashed border-foreground/50 rounded-3xl p-5 md:p-6 space-y-3">
                <h3 className="font-medium">Ring this sale up in Loyverse</h3>
                <p className="text-sm text-graphite">
                  The website doesn't record sales in Loyverse yet. Ring up these items at the till, then tell the
                  website so it stops holding them. If you skip this, the shop will show fewer in stock than you have.
                </p>
                <button type="button" className={secondaryBtn} disabled={busy !== ""} onClick={() => void act("recorded", {}, "Noted: rung up in Loyverse")}>
                  {busy === "recorded" ? "Saving…" : "I've rung this up in Loyverse"}
                </button>
              </div>
            )}

            {(o.status === "rejected" || o.status === "cancelled" || o.status === "expired") && (
              <div className={`${card} p-5 md:p-6`}>
                <p>
                  {o.status === "expired"
                    ? "No proof arrived within 60 minutes, so the items went back on sale."
                    : `Closed ${when(o.closedAt)}. The items are back on sale.`}
                </p>
                {o.closedReason && o.status !== "expired" && (
                  <p className="text-sm text-graphite mt-2">
                    {o.status === "rejected" ? "Reason shown to the customer: " : "Note: "}
                    {o.closedReason}
                  </p>
                )}
              </div>
            )}

            {o.status === "delivered" && !o.needsLoyverse && (
              <div className={`${card} p-5 md:p-6`}>
                <p>
                  {pickup ? "Collected" : "Delivered"} {when(o.deliveredAt)}. Nothing more to do.
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="order-history">
            <h2 id="order-history" className="eyebrow text-graphite mb-3">
              What has happened
            </h2>
            <ol className="space-y-3">
              {o.history.map((h, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span aria-hidden="true" className="mt-1.5 w-2 h-2 rounded-full bg-foreground shrink-0" />
                  <div>
                    <div className="font-medium">{describeAction(h.action)}</div>
                    <div className="text-graphite text-xs">
                      {when(h.at)} · {actorName(h.actor)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="lg:col-span-5 space-y-6">
          <section aria-labelledby="order-customer" className={`${card} p-5 md:p-6 space-y-4`}>
            <h2 id="order-customer" className="eyebrow text-graphite">
              Customer
            </h2>
            <div>
              <div className="font-semibold">{o.customerName}</div>
              <div className="text-sm text-graphite">{o.customerPhone}</div>
              {o.customerEmail && <div className="text-sm text-graphite break-all">{o.customerEmail}</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={whatsappLink(o.customerPhone, hello)} target="_blank" rel="noopener noreferrer" className={`${secondaryBtn} px-4`}>
                <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp
              </a>
              <a href={`tel:${o.customerPhone.replace(/[^+\d]/g, "")}`} className={`${secondaryBtn} px-4`}>
                <Phone className="w-4 h-4" aria-hidden="true" /> Call
              </a>
              {o.customerEmail && (
                <a
                  href={`mailto:${o.customerEmail}?subject=${encodeURIComponent(`Your Alo Fitness Pro order ${o.ref}`)}&body=${encodeURIComponent(`${hello}\n\n`)}`}
                  className={`${secondaryBtn} px-4`}
                >
                  <Mail className="w-4 h-4" aria-hidden="true" /> Email
                </a>
              )}
            </div>
            <dl className="text-sm space-y-3 pt-2 border-t border-border">
              <div>
                <dt className="text-[11px] text-graphite uppercase tracking-wider">{pickup ? "Pickup from" : "Deliver to"}</dt>
                <dd className="whitespace-pre-wrap">{pickup ? o.pickupLocation || "To be arranged" : o.deliveryAddress}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-graphite uppercase tracking-wider">Marketing emails</dt>
                <dd>{o.marketingOptIn ? "Yes, agreed at checkout" : "No, did not agree"}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="order-items" className={`${card} p-5 md:p-6 space-y-4`}>
            <h2 id="order-items" className="eyebrow text-graphite">
              {pickup ? "To hand over" : "To deliver"}
            </h2>
            <ul className="divide-y divide-border">
              {o.items.map((item) => (
                <li key={`${item.sku}-${item.size}`} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="text-[11px] text-graphite uppercase tracking-wider mt-0.5">
                      Size {item.size} × {item.quantity}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatBbd(item.priceCents * item.quantity)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-2 pt-2 border-t border-border text-sm">
              <div className="flex justify-between">
                <span className="text-graphite">Subtotal</span>
                <span className="tabular-nums">{formatBbd(o.subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-graphite">{pickup ? "Pickup" : "Delivery"}</span>
                <span className="tabular-nums">{o.shippingCents === 0 ? "Free" : formatBbd(o.shippingCents)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-border">
                <span className="eyebrow">Total</span>
                <span className="font-serif text-2xl tabular-nums">{total}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
