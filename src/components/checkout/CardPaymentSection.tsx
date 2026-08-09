import { CreditCard } from "lucide-react";

/**
 * Card payment path — rendered only when the Sheet's Config tab has
 * `payments_card_enabled = TRUE`.
 *
 * Deliberately a stub: the Fygaro integration (JWT-signed payment links +
 * webhooks) lands later and should touch ONLY this component. Amounts must
 * be signed server-side when that happens — never trust a browser total.
 */
export function CardPaymentSection({ orderRef }: { orderRef: string }) {
  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-10 h-10 grid place-items-center bg-muted text-foreground">
          <CreditCard className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <div>
          <div className="font-medium">Pay by card</div>
          <div className="text-sm text-graphite">Visa · Mastercard</div>
        </div>
      </div>
      <p className="text-sm text-graphite">
        Secure card checkout is on its way. Until it's live, order via WhatsApp
        and quote <span className="font-medium text-foreground">{orderRef}</span>.
      </p>
    </div>
  );
}
