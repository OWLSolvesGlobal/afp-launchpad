import { Landmark } from "lucide-react";

/**
 * Bank transfer payment path — rendered only when the Sheet's Config tab has
 * `payments_transfer_enabled = TRUE`. The instructions text comes verbatim
 * from the Config tab's `transfer_instructions` value (multiline allowed),
 * so account/BimPay/1stPay details are a Sheet edit, never a deploy.
 */
export function BankTransferSection({
  orderRef,
  instructions,
}: {
  orderRef: string;
  instructions: string;
}) {
  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 grid place-items-center bg-muted text-foreground">
          <Landmark className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <div>
          <div className="font-medium">Bank transfer</div>
          <div className="text-sm text-graphite">Pay from your bank, then send proof on WhatsApp</div>
        </div>
      </div>
      {instructions && (
        <p className="text-sm text-graphite whitespace-pre-line mb-3">{instructions}</p>
      )}
      <p className="text-sm">
        Use <span className="font-medium">{orderRef}</span> as the transfer reference.
      </p>
      <p className="text-[11px] text-graphite uppercase tracking-wider mt-3">
        Your order is confirmed once payment is verified.
      </p>
    </div>
  );
}
