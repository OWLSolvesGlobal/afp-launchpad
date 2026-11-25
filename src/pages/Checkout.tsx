import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Store, Check, MessageCircle } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { useCart, formatMoney } from "@/context/CartContext";
import { newOrderId, useCatalog } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/brand";
import { CardPaymentSection } from "@/components/checkout/CardPaymentSection";
import { BankTransferSection } from "@/components/checkout/BankTransferSection";
import { calculateOrderTotal, FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/pricing";

import type { Fulfillment } from "@/lib/pricing";

const PICKUP_LOCATIONS = [
  {
    id: "st-michael",
    name: "AFP HQ — St Michael",
    address: "By appointment · St Michael, Barbados",
    hours: "Mon–Sat · 10am–6pm",
  },
  {
    id: "bridgetown",
    name: "AFP Drop — Bridgetown",
    address: "Meet-up pickup arranged via WhatsApp",
    hours: "Tue–Sat · 11am–5pm",
  },
];

/**
 * Checkout: cart review → order reference → payment paths.
 *
 * WhatsApp is always available. Bank QR code and Card appear only when the
 * site settings enable them (paymentsTransferEnabled /
 * paymentsCardEnabled). The card section is a stub until Fygaro lands.
 * Prices include VAT, so the total is subtotal plus delivery.
 */
export default function Checkout() {
  const { items, subtotal, count } = useCart();
  const { data: catalog } = useCatalog();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [pickupLocation, setPickupLocation] = useState(PICKUP_LOCATIONS[0].id);

  // One reference per checkout visit — quoted in the WhatsApp message and on
  // transfer payments so the owner can copy it into the Orders tab.
  const orderRef = useMemo(() => newOrderId(), []);

  const cardEnabled = catalog?.config.paymentsCardEnabled ?? false;
  const transferEnabled = catalog?.config.paymentsTransferEnabled ?? false;

  useEffect(() => {
    document.title = "Checkout — Alo Fitness Pro";
  }, []);

  const {
    shippingCents: shipping,
    totalCents: total,
  } = calculateOrderTotal({
    subtotalCents: subtotal,
    fulfillment,
  });

  // The order message sent to AFP on WhatsApp. `paid` is true when the
  // customer has already paid by CIBC 1st Pay, so the owner knows to look for
  // the payment in her bank record under this reference.
  const buildOrderMessage = useCallback(
    (paid = false) => {
      if (items.length === 0) return "Hi AFP!";
      const lines = items.map(
        (i) =>
          `• ${i.name} — ${i.color ? `${i.color} / ` : ""}${i.size} × ${i.quantity} (${formatMoney(i.priceCents * i.quantity)})`,
      );
      const pickup = PICKUP_LOCATIONS.find((l) => l.id === pickupLocation);
      return (
        `Hi AFP! I'd like to place this order:\n` +
        `Order ref: ${orderRef}\n\n` +
        `${lines.join("\n")}\n\n` +
        `Subtotal: ${formatMoney(subtotal)}\n` +
        `${fulfillment === "pickup" ? "Pickup" : "Delivery"}: ${shipping === 0 ? "Free" : formatMoney(shipping)}\n` +
        `Total (VAT included): ${formatMoney(total)}\n\n` +
        (paid
          ? `I have paid ${formatMoney(total)} by CIBC 1st Pay with reference ${orderRef}.\n\n`
          : "Please hold my items. I will arrange payment with you here.\n\n") +
        (fulfillment === "pickup"
          ? `Pickup preferred — ${pickup?.name ?? "location to confirm"}.`
          : "Please arrange delivery.")
      );
    },
    [items, subtotal, shipping, total, fulfillment, pickupLocation, orderRef],
  );

  if (count === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main id="main" className="flex-1 container pt-32 pb-24 text-center">
          <div className="eyebrow text-graphite mb-4">Checkout</div>
          <h1 className="display-lg mb-6">Your bag is empty.</h1>
          <p className="text-graphite mb-8">Add something you love before checking out.</p>
          <Link
            to="/shop/women"
            className="inline-flex items-center justify-center px-8 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            Continue Shopping
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main id="main" className="flex-1 container pt-24 md:pt-28 pb-16 md:pb-24">
        <Link
          to="/shop/women"
          className="inline-flex items-center gap-2 eyebrow text-graphite hover:text-foreground transition-colors mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded-full px-1 py-1 -mx-1"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Continue Shopping
        </Link>

        <h1 className="display-lg mb-10 md:mb-14">Checkout.</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          {/* LEFT — fulfillment + payment paths */}
          <div className="lg:col-span-7 space-y-12">
            {/* Fulfillment toggle */}
            <section>
              <h2 className="eyebrow text-graphite mb-4">01 — Delivery Method</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FulfillmentCard
                  active={fulfillment === "delivery"}
                  onClick={() => setFulfillment("delivery")}
                  icon={<MapPin className="w-5 h-5" strokeWidth={1.5} />}
                  title="Delivery"
                  subtitle="Island-wide, Barbados"
                  meta={
                    subtotal >= FREE_SHIPPING_THRESHOLD_CENTS
                      ? "Free over BDS $300"
                      : "From BDS $15 · Island-wide"
                  }
                />
                <FulfillmentCard
                  active={fulfillment === "pickup"}
                  onClick={() => setFulfillment("pickup")}
                  icon={<Store className="w-5 h-5" strokeWidth={1.5} />}
                  title="Store Pickup"
                  subtitle="Meet-up in Barbados"
                  meta="Free · Confirmed via WhatsApp"
                />
              </div>

              {fulfillment === "pickup" && (
                <div className="space-y-3 mt-4">
                  {PICKUP_LOCATIONS.map((loc) => {
                    const active = pickupLocation === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setPickupLocation(loc.id)}
                        className={cn(
                          "w-full text-left border p-5 transition-colors flex items-start justify-between gap-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
                          active
                            ? "border-foreground bg-foreground/[0.02]"
                            : "border-border hover:border-foreground/40"
                        )}
                      >
                        <div>
                          <div className="font-medium">{loc.name}</div>
                          <div className="text-sm text-graphite mt-1">{loc.address}</div>
                          <div className="text-[11px] text-graphite mt-2 uppercase tracking-wider">
                            {loc.hours}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "w-5 h-5 border rounded-full flex items-center justify-center shrink-0 mt-1",
                            active ? "border-foreground bg-foreground" : "border-border"
                          )}
                        >
                          {active && <Check className="w-3 h-3 text-background" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Payment paths */}
            <section>
              <h2 className="eyebrow text-graphite mb-4">02 — Payment</h2>
              <div className="space-y-4">
                {/* CIBC 1st Pay QR code — when enabled in site settings */}
                {transferEnabled && (
                  <BankTransferSection
                    orderRef={orderRef}
                    totalLabel={formatMoney(total)}
                    totalPlain={(total / 100).toFixed(2)}
                    paidHref={waLink(buildOrderMessage(true))}
                  />
                )}

                {/* WhatsApp — always available */}
                <div className="border border-border rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 grid place-items-center bg-muted text-foreground">
                      <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
                    </span>
                    <div>
                      <div className="font-medium">
                        {transferEnabled ? "Any other bank: order on WhatsApp" : "Order on WhatsApp"}
                      </div>
                      <div className="text-sm text-graphite">
                        Message Ashlee, AFP's owner, and arrange payment with her directly
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-graphite mb-4">
                    Your order details and reference{" "}
                    <span className="font-medium text-foreground">{orderRef}</span> are
                    pre-filled — just press send. Your items are held for 24 hours while
                    payment is arranged. After that an unpaid order is released.
                  </p>
                  <a
                    href={waLink(buildOrderMessage())}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Send this order to AFP on WhatsApp (opens in a new tab)"
                    className={cn(
                      "w-full inline-flex items-center justify-center gap-2 px-6 h-12 eyebrow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
                      transferEnabled
                        ? "border border-foreground text-foreground hover:bg-muted"
                        : "bg-ink text-bone hover:bg-accent",
                    )}
                  >
                    <MessageCircle aria-hidden="true" className="w-4 h-4" /> Send Order on WhatsApp
                  </a>
                </div>

                {/* Card path — a stub until Fygaro; off by default */}
                {cardEnabled && <CardPaymentSection orderRef={orderRef} />}
              </div>
            </section>
          </div>

          {/* RIGHT — cart review */}
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-24 rounded-[2rem] border border-border p-6 md:p-8 space-y-6 bg-card">
              <div className="flex items-baseline justify-between">
                <h2 className="eyebrow text-graphite">Order Summary</h2>
                <span className="text-xs text-graphite">{count} {count === 1 ? "item" : "items"}</span>
              </div>

              <div className="text-[11px] text-graphite uppercase tracking-wider">
                Order ref · <span className="text-foreground font-medium">{orderRef}</span>
              </div>

              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.id} className="py-3 flex gap-3">
                    <div className="w-20 h-24 bg-muted overflow-hidden shrink-0 relative rounded-2xl">
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute -top-1.5 -right-1.5 bg-foreground text-background text-[10px] w-5 h-5 grid place-items-center rounded-full font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="text-sm font-semibold truncate">{item.name}</div>
                        <div className="text-[11px] text-graphite uppercase tracking-wider mt-0.5">
                          {item.color ? `${item.color} · ` : ""}{item.size}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{formatMoney(item.priceCents * item.quantity)}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Row label="Subtotal" value={formatMoney(subtotal)} />
                <Row
                  label={fulfillment === "pickup" ? "Pickup" : "Shipping"}
                  value={shipping === 0 ? "Free" : formatMoney(shipping)}
                />
              </div>

              <div className="flex items-baseline justify-between pt-3 border-t border-border">
                <span className="eyebrow">Total</span>
                <span className="font-serif text-3xl">{formatMoney(total)}</span>
              </div>

              <p className="text-[11px] text-graphite text-center uppercase tracking-wider">
                Prices in BBD, VAT included · Orders confirmed on WhatsApp
              </p>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-graphite">{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

interface FulfillmentCardProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  meta: string;
}

const FulfillmentCard = ({ active, onClick, icon, title, subtitle, meta }: FulfillmentCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "border p-5 text-left transition-colors flex flex-col gap-3 h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
      active
        ? "border-foreground bg-foreground/[0.02]"
        : "border-border hover:border-foreground/40"
    )}
  >
    <div className="flex items-center justify-between">
      <div className={cn("w-10 h-10 grid place-items-center", active ? "bg-foreground text-background" : "bg-muted text-foreground")}>
        {icon}
      </div>
      <div
        className={cn(
          "w-5 h-5 border rounded-full flex items-center justify-center",
          active ? "border-foreground bg-foreground" : "border-border"
        )}
      >
        {active && <Check className="w-3 h-3 text-background" strokeWidth={3} />}
      </div>
    </div>
    <div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-graphite">{subtitle}</div>
    </div>
    <div className="text-[11px] text-graphite uppercase tracking-wider mt-auto">{meta}</div>
  </button>
);
