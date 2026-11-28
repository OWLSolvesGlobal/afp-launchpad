import { Check, MessageCircle } from "lucide-react";
import { formatBbd } from "@/lib/catalog-core";
import type { PublicOrder } from "@/lib/orders-core";
import { waLink } from "@/lib/brand";
import { cn } from "@/lib/utils";

const CHECKOUT_STEPS = ["Details", "Pay", "Upload proof", "Done"] as const;

/** Where the customer is in checkout. `current` is 0-based. */
export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3 mb-8 md:mb-10" aria-label="Checkout steps">
      {CHECKOUT_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn("flex items-center gap-2", !active && "min-w-0", i < CHECKOUT_STEPS.length - 1 && "flex-1")}
          >
            <span
              className={cn(
                "w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold tabular-nums border",
                done || active ? "bg-foreground text-background border-foreground" : "border-border text-graphite",
              )}
            >
              {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-xs sm:text-sm",
                active ? "font-semibold whitespace-nowrap" : "text-graphite truncate hidden sm:inline",
              )}
            >
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
            {i < CHECKOUT_STEPS.length - 1 && <span aria-hidden="true" className="h-px flex-1 bg-border min-w-3" />}
          </li>
        );
      })}
    </ol>
  );
}

/** The one WhatsApp link kept in checkout: for help, not for ordering. */
export function HelpLink({ orderRef, className }: { orderRef?: string; className?: string }) {
  const text = orderRef ? `Hi AFP, I need help with my order ${orderRef}.` : "Hi AFP, I need help with my order.";
  return (
    <a
      href={waLink(text)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 min-h-11 text-sm text-graphite underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded",
        className,
      )}
    >
      <MessageCircle className="w-4 h-4" aria-hidden="true" /> Need help? WhatsApp us
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-graphite">{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

/** The order as the server holds it. Every figure here is the server's. */
export function OrderSummary({ order }: { order: PublicOrder }) {
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <div className="rounded-[2rem] border border-border p-6 md:p-8 space-y-5 bg-card">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow text-graphite">Your order</h2>
        <span className="text-xs text-graphite">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="text-[11px] text-graphite uppercase tracking-wider">
        Order ref · <span className="text-foreground font-medium">{order.ref}</span>
      </div>
      <ul className="divide-y divide-border">
        {order.items.map((item) => (
          <li key={`${item.sku}-${item.size}`} className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{item.name}</div>
              <div className="text-[11px] text-graphite uppercase tracking-wider mt-0.5">
                {item.size} × {item.quantity}
              </div>
            </div>
            <div className="text-sm font-semibold tabular-nums shrink-0">
              {formatBbd(item.priceCents * item.quantity)}
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-2 pt-2 border-t border-border">
        <Row label="Subtotal" value={formatBbd(order.subtotalCents)} />
        <Row
          label={order.fulfillment === "pickup" ? "Pickup" : "Delivery"}
          value={order.shippingCents === 0 ? "Free" : formatBbd(order.shippingCents)}
        />
        {order.fulfillment === "pickup" && order.pickupLocation && (
          <Row label="Pickup from" value={order.pickupLocation} />
        )}
      </div>
      <div className="flex items-baseline justify-between pt-3 border-t border-border">
        <span className="eyebrow">Total</span>
        <span className="font-serif text-3xl tabular-nums">{formatBbd(order.totalCents)}</span>
      </div>
      <p className="text-[11px] text-graphite text-center uppercase tracking-wider">Prices in BBD, VAT included</p>
    </div>
  );
}
