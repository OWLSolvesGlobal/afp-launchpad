import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, MapPin, MessageCircle, Store } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { useCart, formatMoney, type CartItem } from "@/context/CartContext";
import { isPurchasable, useCatalog } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/brand";
import { calculateOrderTotal, FREE_SHIPPING_THRESHOLD_CENTS, type Fulfillment } from "@/lib/pricing";
import {
  clearActiveOrder,
  isFailure,
  lastOrder,
  loadActiveOrder,
  reserveOrder,
  saveActiveOrder,
  statusPath,
  type ActiveOrder,
  type OrderView,
  type Unavailable,
} from "@/lib/order-client";
import { useOrder } from "@/hooks/useOrder";
import { useNoIndex } from "@/hooks/useNoIndex";
import { validateDetails, type DetailFields as Fields, type DetailErrors as FieldErrors } from "@/lib/checkout-details";
import { OrderFlow } from "@/components/order/OrderFlow";
import { stepFor } from "@/components/order/status-copy";
import { HelpLink, OrderSummary, Stepper } from "@/components/order/OrderParts";
import { LogoLoader } from "@/components/site/LogoLoader";
import { CardPaymentSection } from "@/components/checkout/CardPaymentSection";

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
 * Checkout: Details → Pay → Upload proof → Done.
 *
 * Details reserves the order on the server, which holds the items for 60
 * minutes. From then on this page shows the server's copy of the order: its
 * reference, its total and its time left. Refreshing or coming back resumes
 * the same order. The order is not submitted until proof of payment has been
 * uploaded, and it is not paid until the owner has checked the bank account.
 */
export default function Checkout() {
  const cart = useCart();
  const [active, setActive] = useState<ActiveOrder | null>(() => loadActiveOrder());
  const [initialView, setInitialView] = useState<OrderView | undefined>();

  useNoIndex();
  useEffect(() => {
    document.title = "Checkout — Alo Fitness Pro";
  }, []);

  const onReserved = useCallback(
    (view: OrderView, token: string, bag: CartItem[]) => {
      const next = { ref: view.order.ref, token, bag };
      saveActiveOrder(next);
      setInitialView(view);
      setActive(next);
      // The bag is emptied only now that the order exists on the server.
      cart.clear();
      window.scrollTo({ top: 0 });
    },
    [cart],
  );

  const onFinished = useCallback(
    (restoreBag: boolean) => {
      if (restoreBag && active && active.bag.length > 0 && cart.count === 0) cart.replaceAll(active.bag);
      clearActiveOrder();
      setInitialView(undefined);
      setActive(null);
      window.scrollTo({ top: 0 });
    },
    [active, cart],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main id="main" className="flex-1 container pt-24 md:pt-28 pb-16 md:pb-24">
        {active ? (
          <ActiveCheckout key={active.ref} active={active} initialView={initialView} onFinished={onFinished} />
        ) : cart.count === 0 ? (
          <EmptyBag />
        ) : (
          <DetailsStep onReserved={onReserved} />
        )}
      </main>
      <Footer />
    </div>
  );
}

function EmptyBag() {
  const last = lastOrder();
  return (
    <div className="pt-8 pb-8 text-center">
      <div className="eyebrow text-graphite mb-4">Checkout</div>
      <h1 className="display-lg mb-6">Your bag is empty.</h1>
      <p className="text-graphite mb-8">Add something you love before checking out.</p>
      <Link
        to="/shop/women"
        className="inline-flex items-center justify-center px-8 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        Continue Shopping
      </Link>
      {last && (
        <p className="mt-8 text-sm text-graphite">
          Looking for an order you placed?{" "}
          <Link to={statusPath(last.ref, last.token)} className="underline underline-offset-4 hover:text-foreground">
            Check order {last.ref}
          </Link>
        </p>
      )}
    </div>
  );
}

// --- Steps 2 to 4: an order that exists on the server --------------------------

function ActiveCheckout({
  active,
  initialView,
  onFinished,
}: {
  active: ActiveOrder;
  initialView?: OrderView;
  onFinished: (restoreBag: boolean) => void;
}) {
  const { data: catalog } = useCatalog();
  const { state, refresh, show } = useOrder(active.ref, active.token, initialView);
  const [stage, setStage] = useState<"pay" | "upload">("pay");

  // An order this device remembers but the server does not: start again.
  useEffect(() => {
    if (state.phase === "not-found") onFinished(true);
  }, [state.phase, onFinished]);

  // Once an order has left "waiting for payment", checkout has done its job:
  // the next visit to /checkout starts fresh, and the status link takes over.
  const status = state.phase === "ready" ? state.view.order.status : null;
  useEffect(() => {
    if (status && status !== "reserved") clearActiveOrder();
  }, [status]);

  if (state.phase === "loading" || state.phase === "not-found") {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <LogoLoader label="Loading your order" />
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div className="max-w-xl">
        <h1 className="display-lg mb-6">Checkout.</h1>
        <div role="alert" className="border border-border rounded-2xl p-5 space-y-3">
          <p className="font-medium">We couldn't load your order just now.</p>
          <p className="text-sm text-graphite">
            {state.message} Your order {active.ref} is safe; nothing has been lost.
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center justify-center px-6 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            Try again
          </button>
          <div>
            <HelpLink orderRef={active.ref} />
          </div>
        </div>
      </div>
    );
  }

  const { view } = state;
  return (
    <>
      <h1 className="display-lg mb-8 md:mb-10">Checkout.</h1>
      {/* An order that ended without being submitted is not "step 4 of 4". */}
      {!["expired", "rejected", "cancelled"].includes(view.order.status) && (
        <Stepper current={stepFor(view.order.status, stage)} />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
        <div className="lg:col-span-7">
          <OrderFlow
            view={view}
            token={active.token}
            cibcEnabled={catalog?.config.paymentsTransferEnabled ?? false}
            variant="checkout"
            onView={show}
            onRefresh={() => void refresh()}
            onStage={setStage}
            onFinished={onFinished}
          />
          {/* Card path: a stub until Fygaro; off by default. */}
          {view.order.status === "reserved" && catalog?.config.paymentsCardEnabled && (
            <div className="mt-6">
              <CardPaymentSection orderRef={view.order.ref} />
            </div>
          )}
        </div>
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <OrderSummary order={view.order} />
          </div>
        </aside>
      </div>
    </>
  );
}

// --- Step 1: details -------------------------------------------------------------

function DetailsStep({ onReserved }: { onReserved: (view: OrderView, token: string, bag: CartItem[]) => void }) {
  const cart = useCart();
  const { items, subtotal, count } = cart;
  const { data: catalog } = useCatalog();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [pickupLocation, setPickupLocation] = useState(PICKUP_LOCATIONS[0].id);
  const [fields, setFields] = useState<Fields>({ name: "", phone: "", email: "", address: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [unavailable, setUnavailable] = useState<Unavailable[]>([]);
  const [priceNotes, setPriceNotes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Guards against a double tap: state updates are too slow to stop the second one.
  const inFlight = useRef(false);
  const errorSummary = useRef<HTMLDivElement>(null);

  // --- Keep the bag honest against the live catalog: prices and availability
  const bySku = useMemo(() => new Map((catalog?.products ?? []).map((p) => [p.sku, p])), [catalog]);
  useEffect(() => {
    if (!catalog || items.length === 0) return;
    const notes: string[] = [];
    let changed = false;
    const next = items.map((item) => {
      const product = bySku.get(item.sku);
      if (product && isPurchasable(product) && product.priceCents !== item.priceCents) {
        notes.push(
          `${item.name} is now ${formatMoney(product.priceCents)} (was ${formatMoney(item.priceCents)}).`,
        );
        changed = true;
        return { ...item, priceCents: product.priceCents };
      }
      return item;
    });
    if (changed) {
      cart.replaceAll(next);
      setPriceNotes((prev) => [...prev, ...notes]);
    }
    // Runs when the catalog arrives or the bag's contents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, items]);

  const gone = items.filter((i) => {
    if (!catalog) return false;
    const p = bySku.get(i.sku);
    return !p || !isPurchasable(p);
  });

  const { shippingCents: shipping, totalCents: total } = calculateOrderTotal({ subtotalCents: subtotal, fulfillment });

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setFormError("");
    setUnavailable([]);

    const found = validateDetails(fields, fulfillment);
    setErrors(found);
    const firstBad = (Object.keys(found) as (keyof Fields)[])[0];
    if (firstBad) {
      document.getElementById(`checkout-${firstBad}`)?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    const bag = items;
    const pickup = PICKUP_LOCATIONS.find((l) => l.id === pickupLocation);
    const result = await reserveOrder({
      items: bag.map((i) => ({ sku: i.sku, size: i.size, quantity: i.quantity })),
      fulfillment,
      pickupLocation: fulfillment === "pickup" ? (pickup?.name ?? "") : "",
      customer: {
        name: fields.name.trim(),
        phone: fields.phone.trim(),
        email: fields.email.trim(),
        address: fulfillment === "delivery" ? fields.address.trim() : "",
      },
    });
    inFlight.current = false;
    setSubmitting(false);

    if (!isFailure(result)) {
      if (result.token) {
        onReserved(result, result.token, bag);
        return;
      }
      setFormError("Something went wrong reserving your order. Please try again.");
    } else if (result.field && result.field in fields) {
      setErrors({ [result.field]: result.error });
      document.getElementById(`checkout-${result.field}`)?.focus();
      return;
    } else {
      setUnavailable(result.unavailable ?? []);
      setFormError(
        result.status === 503 || result.status === 0
          ? "Ordering isn't available right now. Your bag is safe. Please try again in a few minutes."
          : result.error,
      );
    }
    window.setTimeout(() => errorSummary.current?.focus(), 0);
  };

  /** Bring one line of the bag down to what is actually left. */
  const fixLine = (u: Unavailable) => {
    const line = items.find((i) => i.sku === u.sku && i.size === u.size);
    if (line) cart.updateQuantity(line.id, u.available);
    setUnavailable((prev) => prev.filter((x) => !(x.sku === u.sku && x.size === u.size)));
  };

  const small =
    "inline-flex items-center justify-center h-11 px-4 text-xs font-medium border border-border rounded-full hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";

  return (
    <>
      <Link
        to="/shop/women"
        className="inline-flex items-center gap-2 eyebrow text-graphite hover:text-foreground transition-colors mb-6 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded-full px-1 -mx-1"
      >
        <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Continue Shopping
      </Link>

      <h1 className="display-lg mb-8 md:mb-10">Checkout.</h1>
      <Stepper current={0} />

      <form onSubmit={submit} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
        <div className="lg:col-span-7 space-y-10">
          {(priceNotes.length > 0 || gone.length > 0) && (
            <div role="status" className="border border-border rounded-2xl p-5 space-y-3">
              {priceNotes.length > 0 && (
                <div>
                  <p className="font-medium">A price changed since you added it to your bag.</p>
                  <ul className="text-sm text-graphite mt-1 list-disc pl-5">
                    {priceNotes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-graphite mt-1">Your total below uses the new price.</p>
                </div>
              )}
              {gone.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">{i.name}</span> is no longer available.
                  </p>
                  <button type="button" className={small} onClick={() => cart.removeItem(i.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <section aria-labelledby="details-you">
            <h2 id="details-you" className="eyebrow text-graphite mb-4">
              01 — Your details
            </h2>
            <div className="space-y-4">
              <Field
                id="checkout-name"
                label="Full name"
                value={fields.name}
                onChange={set("name")}
                error={errors.name}
                autoComplete="name"
              />
              <Field
                id="checkout-phone"
                label="Phone or WhatsApp number"
                hint="So we can confirm your order and arrange delivery or pickup."
                value={fields.phone}
                onChange={set("phone")}
                error={errors.phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
              />
              <Field
                id="checkout-email"
                label="Email (optional)"
                value={fields.email}
                onChange={set("email")}
                error={errors.email}
                type="email"
                inputMode="email"
                autoComplete="email"
              />
            </div>
          </section>

          <section aria-labelledby="details-delivery">
            <h2 id="details-delivery" className="eyebrow text-graphite mb-4">
              Delivery or pickup
            </h2>
            <div role="radiogroup" aria-labelledby="details-delivery" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FulfillmentCard
                active={fulfillment === "delivery"}
                onClick={() => setFulfillment("delivery")}
                icon={<MapPin className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />}
                title="Delivery"
                subtitle="Island-wide, Barbados"
                meta={subtotal >= FREE_SHIPPING_THRESHOLD_CENTS ? "Free over BDS $300" : "BDS $15 · Free over BDS $300"}
              />
              <FulfillmentCard
                active={fulfillment === "pickup"}
                onClick={() => setFulfillment("pickup")}
                icon={<Store className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />}
                title="Pickup"
                subtitle="Meet-up in Barbados"
                meta="Free"
              />
            </div>

            {fulfillment === "delivery" && (
              <div className="mt-4">
                <Field
                  id="checkout-address"
                  label="Delivery address"
                  hint="House or building, street, district and parish."
                  value={fields.address}
                  onChange={set("address")}
                  error={errors.address}
                  autoComplete="street-address"
                  multiline
                />
              </div>
            )}

            {fulfillment === "pickup" && (
              <div role="radiogroup" aria-label="Pickup location" className="space-y-3 mt-4">
                {PICKUP_LOCATIONS.map((loc) => {
                  const on = pickupLocation === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPickupLocation(loc.id)}
                      className={cn(
                        "w-full text-left border p-5 transition-colors flex items-start justify-between gap-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
                        on ? "border-foreground bg-foreground/[0.02]" : "border-border hover:border-foreground/40",
                      )}
                    >
                      <div>
                        <div className="font-medium">{loc.name}</div>
                        <div className="text-sm text-graphite mt-1">{loc.address}</div>
                        <div className="text-[11px] text-graphite mt-2 uppercase tracking-wider">{loc.hours}</div>
                      </div>
                      <Radio on={on} />
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-sm text-graphite mt-4">
              Ordering from overseas?{" "}
              <a
                href={waLink("Hi AFP! I'd like to order from overseas.")}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Message us<span className="sr-only"> on WhatsApp (opens in a new tab)</span>
              </a>
            </p>
          </section>

          {(formError || unavailable.length > 0) && (
            <div
              ref={errorSummary}
              tabIndex={-1}
              role="alert"
              className="border border-destructive/40 rounded-2xl p-5 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              <p className="font-medium">{formError}</p>
              {unavailable.map((u) => (
                <div key={`${u.sku}-${u.size}`} className="flex items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">
                      {u.name}, size {u.size}
                    </span>
                    : {u.available === 0 ? "sold out" : `only ${u.available} left`} (you asked for {u.requested}).
                  </p>
                  <button type="button" className={small} onClick={() => fixLine(u)}>
                    {u.available === 0 ? "Remove" : `Change to ${u.available}`}
                  </button>
                </div>
              ))}
              <HelpLink />
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={submitting || gone.length > 0}
              className="w-full inline-flex items-center justify-center gap-2 px-6 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              {submitting ? "Reserving your items…" : "Reserve my items and pay"}
            </button>
            <p className="text-xs text-graphite">
              We'll hold your items for 60 minutes while you pay from your banking app and upload proof of payment.
              Nothing is charged by this site.
            </p>
            <HelpLink />
          </div>
        </div>

        {/* RIGHT — bag review */}
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24 rounded-[2rem] border border-border p-6 md:p-8 space-y-6 bg-card">
            <div className="flex items-baseline justify-between">
              <h2 className="eyebrow text-graphite">Your bag</h2>
              <span className="text-xs text-graphite">
                {count} {count === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="py-3 flex gap-3">
                  <div className="w-20 h-24 bg-muted overflow-hidden shrink-0 relative rounded-2xl">
                    {item.image && (
                      <img src={item.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                    )}
                    <span className="absolute -top-1.5 -right-1.5 bg-foreground text-background text-[10px] w-5 h-5 grid place-items-center rounded-full font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{item.name}</div>
                    <div className="text-[11px] text-graphite uppercase tracking-wider mt-0.5">
                      {item.color ? `${item.color} · ` : ""}
                      {item.size}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {formatMoney(item.priceCents * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <Row label="Subtotal" value={formatMoney(subtotal)} />
              <Row
                label={fulfillment === "pickup" ? "Pickup" : "Delivery"}
                value={shipping === 0 ? "Free" : formatMoney(shipping)}
              />
            </div>

            <div className="flex items-baseline justify-between pt-3 border-t border-border">
              <span className="eyebrow">Total</span>
              <span className="font-serif text-3xl tabular-nums">{formatMoney(total)}</span>
            </div>

            <p className="text-[11px] text-graphite text-center uppercase tracking-wider">
              Prices in BBD, VAT included
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-graphite">{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

const Radio = ({ on }: { on: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "w-5 h-5 border rounded-full flex items-center justify-center shrink-0 mt-1",
      on ? "border-foreground bg-foreground" : "border-border",
    )}
  >
    {on && <Check className="w-3 h-3 text-background" strokeWidth={3} />}
  </span>
);

function Field({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  multiline,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  multiline?: boolean;
  type?: string;
  inputMode?: "tel" | "email" | "text";
  autoComplete?: string;
}) {
  const hintId = useId();
  const errorId = useId();
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  const cls = cn(
    "w-full border bg-background rounded-xl px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
    error ? "border-destructive" : "border-border",
  );
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete={input.autoComplete}
          className={cn(cls, "py-3")}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(cls, "h-12")}
          {...input}
        />
      )}
      {hint && (
        <p id={hintId} className="text-xs text-graphite mt-1.5">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
}

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
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={cn(
      "border p-5 text-left transition-colors flex flex-col gap-3 h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
      active ? "border-foreground bg-foreground/[0.02]" : "border-border hover:border-foreground/40",
    )}
  >
    <div className="flex items-center justify-between">
      <div
        className={cn(
          "w-10 h-10 grid place-items-center",
          active ? "bg-foreground text-background" : "bg-muted text-foreground",
        )}
      >
        {icon}
      </div>
      <Radio on={active} />
    </div>
    <div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-graphite">{subtitle}</div>
    </div>
    <div className="text-[11px] text-graphite uppercase tracking-wider mt-auto">{meta}</div>
  </button>
);
