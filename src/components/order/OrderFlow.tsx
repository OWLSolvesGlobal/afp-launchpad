import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { formatBbd } from "@/lib/catalog-core";
import type { PaymentMethod } from "@/lib/orders-core";
import { cancelOrder, isFailure, statusPath, type OrderView } from "@/lib/order-client";
import { Countdown } from "./Countdown";
import { CopyRow } from "./CopyRow";
import { PayPanel } from "./PayPanel";
import { ProofUpload } from "./ProofUpload";
import { HelpLink } from "./OrderParts";
import { STATUS_COPY, type Stage } from "./status-copy";

const stageKey = (ref: string) => `afp-order-stage-${ref}`;
const readStage = (ref: string): Stage => {
  try {
    return sessionStorage.getItem(stageKey(ref)) === "upload" ? "upload" : "pay";
  } catch {
    return "pay";
  }
};

const primary =
  "w-full inline-flex items-center justify-center gap-2 px-6 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";
const secondary =
  "inline-flex items-center justify-center gap-2 px-6 h-12 eyebrow border border-foreground text-foreground hover:bg-muted transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";
const textButton =
  "inline-flex items-center gap-1.5 min-h-11 text-sm text-graphite underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded";

/**
 * Everything a customer does with an order after it is reserved: pay, send
 * proof, replace proof, cancel, and see where it stands. Used by checkout
 * (steps 2 to 4) and by the status page.
 *
 * It offers only the actions that are valid for the order's current status,
 * and every figure it shows is the server's.
 */
export function OrderFlow({
  view,
  token,
  cibcEnabled,
  variant,
  onView,
  onRefresh,
  onStage,
  onFinished,
}: {
  view: OrderView;
  token: string;
  cibcEnabled: boolean;
  variant: "checkout" | "status";
  /** The server returned a newer copy of the order. */
  onView: (view: OrderView) => void;
  onRefresh: () => void;
  onStage?: (stage: Stage) => void;
  /** Checkout only: the order is over (cancelled/expired/rejected); start again. */
  onFinished?: (restoreBag: boolean) => void;
}) {
  const { order, payment, clockOffsetMs } = view;
  const bank = payment?.bank ?? null;
  const [stage, setStageState] = useState<Stage>(() => readStage(order.ref));
  const [method, setMethod] = useState<PaymentMethod>(cibcEnabled ? "cibc_qr" : "bank_transfer");
  const [replacing, setReplacing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const setStage = useCallback(
    (next: Stage) => {
      setStageState(next);
      try {
        sessionStorage.setItem(stageKey(order.ref), next);
      } catch {
        /* ignore */
      }
      onStage?.(next);
      window.scrollTo({ top: 0 });
    },
    [order.ref, onStage],
  );

  useEffect(() => {
    onStage?.(stage);
    // Report the restored stage once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If bank details are the only way to pay, select them.
  useEffect(() => {
    if (!cibcEnabled && bank) setMethod("bank_transfer");
    if (cibcEnabled && !bank) setMethod("cibc_qr");
  }, [cibcEnabled, bank]);

  const canPay = cibcEnabled || Boolean(bank);
  const pickup = order.fulfillment === "pickup";
  const copy = STATUS_COPY[order.status];
  const link = `${window.location.origin}${statusPath(order.ref, token)}`;

  const doCancel = async () => {
    setCancelling(true);
    setCancelError("");
    const result = await cancelOrder(order.ref, token);
    setCancelling(false);
    setConfirmingCancel(false);
    if (!isFailure(result)) onView(result);
    else {
      setCancelError(result.error);
      onRefresh();
    }
  };

  const cancelControl = (
    <div>
      {confirmingCancel ? (
        <div className="border border-border rounded-2xl p-4 space-y-3" role="group" aria-label="Cancel this order?">
          <p className="text-sm">Cancel this order and put the items back on sale?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={doCancel} disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button type="button" className={textButton} onClick={() => setConfirmingCancel(false)} disabled={cancelling}>
              Keep my order
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={textButton} onClick={() => setConfirmingCancel(true)}>
          Cancel this order
        </button>
      )}
      {cancelError && (
        <p role="alert" className="text-sm text-destructive mt-2">
          {cancelError}
        </p>
      )}
    </div>
  );

  // --- Waiting for payment --------------------------------------------------
  if (order.status === "reserved") {
    return (
      <div className="space-y-6">
        {variant === "status" && (
          <header>
            <h2 className="font-serif text-3xl mb-2">{copy.title}</h2>
            <p className="text-graphite">{copy.body(order.ref, pickup)}</p>
          </header>
        )}
        <Countdown expiresAt={order.expiresAt} clockOffsetMs={clockOffsetMs} onExpire={onRefresh} />

        {!canPay ? (
          <div className="border border-border rounded-2xl p-5 space-y-2" role="alert">
            <p className="font-medium">Online payment isn't available right now.</p>
            <p className="text-sm text-graphite">
              Your items are still held. Message us on WhatsApp with your reference {order.ref} and we'll help you pay.
            </p>
            <HelpLink orderRef={order.ref} />
          </div>
        ) : stage === "pay" ? (
          <section aria-labelledby="step-pay" className="space-y-5">
            <h2 id="step-pay" className="eyebrow text-graphite">
              02 — Pay
            </h2>
            <PayPanel
              orderRef={order.ref}
              totalLabel={formatBbd(order.totalCents)}
              totalPlain={(order.totalCents / 100).toFixed(2)}
              cibcEnabled={cibcEnabled}
              bank={bank}
              method={method}
              onMethod={setMethod}
            />
            <button type="button" className={primary} onClick={() => setStage("upload")}>
              I've paid: upload my proof
            </button>
          </section>
        ) : (
          <section aria-labelledby="step-upload" className="space-y-5">
            <button type="button" className={textButton} onClick={() => setStage("pay")}>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to payment details
            </button>
            <h2 id="step-upload" className="eyebrow text-graphite">
              03 — Upload proof of payment
            </h2>
            <p className="text-sm text-graphite">
              Send the confirmation from your banking app for{" "}
              <span className="font-medium text-foreground">{formatBbd(order.totalCents)}</span>, reference{" "}
              <span className="font-medium text-foreground">{order.ref}</span>. Your order is not submitted until we
              have it.
            </p>
            <ProofUpload
              orderRef={order.ref}
              token={token}
              method={method}
              onDone={onView}
              onFailure={onRefresh}
            />
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 pt-2 border-t border-border">
          {cancelControl}
          <HelpLink orderRef={order.ref} />
        </div>
      </div>
    );
  }

  // --- Everything after: one status message, plus what can still be done ----
  const over = order.status === "expired" || order.status === "rejected" || order.status === "cancelled";
  return (
    <div className="space-y-6">
      <header aria-live="polite">
        <h2 className="font-serif text-3xl md:text-4xl mb-3">{copy.title}</h2>
        <p className="text-graphite">{copy.body(order.ref, pickup)}</p>
        {order.status === "rejected" && order.rejectedReason && (
          <p className="mt-3 border border-border rounded-xl px-4 py-3 text-sm">
            <span className="text-graphite">Note from AFP: </span>
            {order.rejectedReason}
          </p>
        )}
      </header>

      {order.status === "proof_uploaded" && (
        <>
          <div className="space-y-2">
            <CopyRow label="Order reference" value={order.ref} />
            <CopyRow label="Link to check this order" value="Save or share this link" copyValue={link} />
            <p className="text-xs text-graphite">
              Anyone with this link can see this order's status, so keep it to yourself.{" "}
              <Link to={statusPath(order.ref, token)} className="underline underline-offset-4 hover:text-foreground">
                Open the status page
              </Link>
            </p>
          </div>
          <div className="border-t border-border pt-4 space-y-4">
            {replacing ? (
              <>
                <h3 className="font-medium">Send a different proof</h3>
                <p className="text-sm text-graphite">
                  This replaces the one we have. You can do this {order.proofUploadsLeft} more{" "}
                  {order.proofUploadsLeft === 1 ? "time" : "times"}.
                </p>
                <ProofUpload
                  orderRef={order.ref}
                  token={token}
                  method={order.paymentMethod ?? method}
                  submitLabel="Replace my proof"
                  onDone={(v) => {
                    setReplacing(false);
                    onView(v);
                  }}
                  onFailure={onRefresh}
                />
                <button type="button" className={textButton} onClick={() => setReplacing(false)}>
                  Keep the proof I sent
                </button>
              </>
            ) : order.proofUploadsLeft > 0 ? (
              <button type="button" className={textButton} onClick={() => setReplacing(true)}>
                Sent the wrong file? Replace your proof
              </button>
            ) : (
              <p className="text-sm text-graphite">
                Your proof can't be replaced again here. Message us on WhatsApp if it needs changing.
              </p>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {over && variant === "checkout" && onFinished ? (
          <button type="button" className={secondary} onClick={() => onFinished(order.status !== "rejected")}>
            {order.status === "rejected" ? "Start a new order" : "Back to my bag"}
          </button>
        ) : (
          <Link to="/shop/women" className={secondary}>
            Continue shopping
          </Link>
        )}
        <HelpLink orderRef={order.ref} />
      </div>
    </div>
  );
}
