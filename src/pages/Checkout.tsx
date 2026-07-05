import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Store, Check, MessageCircle } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart, formatMoney } from "@/context/CartContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CheckoutSkeleton } from "@/components/site/skeletons/CheckoutSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { LIME, waLink } from "@/lib/afp-catalog";

type Fulfillment = "delivery" | "pickup";

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

export default function Checkout() {
  const { items, subtotal, count, clear } = useCart();
  const navigate = useNavigate();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [pickupLocation, setPickupLocation] = useState(PICKUP_LOCATIONS[0].id);
  const [hydrating, setHydrating] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [creditBalanceCents, setCreditBalanceCents] = useState(0);
  const [redeemDollars, setRedeemDollars] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Checkout — Alo Fitness Pro";
    const t = window.setTimeout(() => setHydrating(false), 450);
    return () => window.clearTimeout(t);
  }, []);

  // Load signed-in user + their available credit balance (sum of unlocked, unexpired entries)
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancel) return;
      if (!session) { setUserId(null); setCreditBalanceCents(0); return; }
      setUserId(session.user.id);
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("credit_ledger")
        .select("amount_cents")
        .eq("user_id", session.user.id)
        .lte("unlocks_at", nowIso)
        .gt("expires_at", nowIso);
      const bal = (data ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
      setCreditBalanceCents(Math.max(0, bal));
    })();
    return () => { cancel = true; };
  }, []);

  const shipping = useMemo(() => {
    if (fulfillment === "pickup") return 0;
    if (subtotal === 0) return 0;
    return subtotal >= 30000 ? 0 : 1500; // free over BBD $300, else BBD $15 island-wide
  }, [fulfillment, subtotal]);

  const tax = Math.round(subtotal * 0.175); // BBD VAT 17.5%
  const maxRedeemCents = Math.min(creditBalanceCents, Math.floor(subtotal / 2));
  const waCheckoutMessage = useMemo(() => {
    if (items.length === 0) return "Hi AFP!";
    const lines = items.map(
      (i) =>
        `• ${i.name} — ${i.color} / ${i.size} × ${i.quantity} (${formatMoney(i.price * i.quantity)})`,
    );
    return `Hi AFP! I'd like to place this order:\n${lines.join("\n")}\n\nSubtotal: ${formatMoney(subtotal)}\n${
      fulfillment === "pickup" ? "Pickup preferred." : "Please arrange delivery."
    }`;
  }, [items, subtotal, fulfillment]);

  const requestedRedeemCents = Math.max(
    0,
    Math.min(maxRedeemCents, Math.round((parseFloat(redeemDollars) || 0) * 100))
  );
  const total = subtotal + shipping + tax - requestedRedeemCents;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);

    // Only call backend if signed-in AND something credit-related is happening (code or redemption)
    let resultMsg = "";
    if (userId && (code.trim() || requestedRedeemCents > 0)) {
      const { data, error } = await supabase.functions.invoke("apply-checkout", {
        body: {
          subtotalCents: subtotal,
          code: code.trim(),
          redeemCents: requestedRedeemCents,
        },
      });
      if (error || (data as any)?.error) {
        setSubmitting(false);
        return toast.error((data as any)?.error || error?.message || "Checkout failed");
      }
      const earned = (data as any).customerEarnedCents ?? 0;
      const redeemed = (data as any).redeemedCents ?? 0;
      if (earned > 0) resultMsg = ` You earned $${(earned / 100).toFixed(2)} in store credit.`;
      else if (redeemed > 0) resultMsg = ` $${(redeemed / 100).toFixed(2)} credit applied.`;
    } else if (!userId && code.trim()) {
      setSubmitting(false);
      return toast.error("Sign in to use a partner code or store credit.");
    }

    toast.success(
      (fulfillment === "pickup"
        ? "Order placed — we'll text you when it's ready for pickup."
        : "Order placed — confirmation email on the way.") + resultMsg
    );
    setSubmitting(false);
    clear();
    navigate("/");
  };

  if (hydrating) return <CheckoutSkeleton />;

  if (count === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main id="main" className="flex-1 container pt-32 pb-24 text-center">
          <div className="eyebrow text-graphite mb-4">Checkout</div>
          <h1 className="display-lg mb-6">Your bag is empty.</h1>
          <p className="text-graphite mb-8">Add something you love before checking out.</p>
          <Button variant="afp-primary" size="afp" asChild>
            <Link to="/shop/women">Continue Shopping</Link>
          </Button>
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

        <form
          onSubmit={handlePlaceOrder}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16"
        >
          {/* LEFT — form */}
          <div className="lg:col-span-7 space-y-12">
            {/* Contact */}
            <section>
              <h2 className="eyebrow text-graphite mb-4">01 — Contact</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required placeholder="you@example.com" />
                </div>
                <div>
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" required />
                </div>
                <div>
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" required />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" required />
                </div>
              </div>
            </section>

            {/* Fulfillment toggle */}
            <section>
              <h2 className="eyebrow text-graphite mb-4">02 — Delivery Method</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FulfillmentCard
                  active={fulfillment === "delivery"}
                  onClick={() => setFulfillment("delivery")}
                  icon={<MapPin className="w-5 h-5" strokeWidth={1.5} />}
                  title="Delivery"
                  subtitle="Island-wide, Barbados"
                  meta={subtotal >= 30000 ? "Free over BBD $300" : "From BBD $15 · 2–4 days"}
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
            </section>

            {/* Conditional address or pickup location */}
            {fulfillment === "delivery" ? (
              <section>
                <h2 className="eyebrow text-graphite mb-4">03 — Shipping Address</h2>
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                  <div className="sm:col-span-6">
                    <Label htmlFor="address">Street address</Label>
                    <Input id="address" required />
                  </div>
                  <div className="sm:col-span-6">
                    <Label htmlFor="address2">Apt, suite, etc. (optional)</Label>
                    <Input id="address2" />
                  </div>
                  <div className="sm:col-span-3">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" required />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" required />
                  </div>
                  <div className="sm:col-span-1">
                    <Label htmlFor="zip">ZIP</Label>
                    <Input id="zip" required />
                  </div>
                </div>
              </section>
            ) : (
              <section>
                <h2 className="eyebrow text-graphite mb-4">03 — Pickup Location</h2>
                <div className="space-y-3">
                  {PICKUP_LOCATIONS.map((loc) => {
                    const active = pickupLocation === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setPickupLocation(loc.id)}
                        className={cn(
                          "w-full text-left border p-5 transition-colors flex items-start justify-between gap-4",
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
                <p className="text-[11px] text-graphite mt-4 uppercase tracking-wider">
                  We'll text the person below when your order is ready.
                </p>
              </section>
            )}

            {/* Payment */}
            <section>
              <h2 className="eyebrow text-graphite mb-4">04 — Payment</h2>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div className="sm:col-span-6">
                  <Label htmlFor="card">Card number</Label>
                  <Input id="card" required placeholder="1234 1234 1234 1234" inputMode="numeric" />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor="exp">Expiry (MM/YY)</Label>
                  <Input id="exp" required placeholder="MM/YY" />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" required placeholder="123" inputMode="numeric" />
                </div>
              </div>
            </section>

            {/* Code + store credit */}
            <section>
              <h2 className="eyebrow text-graphite mb-4">05 — Partner Code &amp; Store Credit</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Partner code (optional)</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="AP20"
                    autoCapitalize="characters"
                  />
                  <p className="text-[11px] text-graphite mt-2 uppercase tracking-wider">
                    No upfront discount — you and the influencer each earn credit.
                  </p>
                </div>
                <div>
                  <Label htmlFor="redeem">
                    Redeem store credit{userId ? ` (avail. ${formatMoney(creditBalanceCents)})` : ""}
                  </Label>
                  <Input
                    id="redeem"
                    type="number"
                    min={0}
                    step="0.01"
                    max={maxRedeemCents / 100}
                    value={redeemDollars}
                    onChange={(e) => setRedeemDollars(e.target.value)}
                    disabled={!userId || creditBalanceCents === 0}
                    placeholder={userId ? `Max ${formatMoney(maxRedeemCents)}` : "Sign in to redeem"}
                  />
                  <p className="text-[11px] text-graphite mt-2 uppercase tracking-wider">
                    Up to 50% of subtotal. Using credit + a code on the same order means only the influencer earns.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT — order summary */}
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-24 rounded-[2rem] border border-border p-6 md:p-8 space-y-6 bg-card">
              <div className="flex items-baseline justify-between">
                <h2 className="eyebrow text-graphite">Order Summary</h2>
                <span className="text-xs text-graphite">{count} {count === 1 ? "item" : "items"}</span>
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
                          {item.color} · {item.size}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{formatMoney(item.price * item.quantity)}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Row label="Subtotal" value={formatMoney(subtotal)} />
                <Row
                  label={fulfillment === "pickup" ? "Pickup" : "Shipping"}
                  value={shipping === 0 ? "Free" : formatMoney(shipping)}
                />
                <Row label="VAT (17.5%)" value={formatMoney(tax)} />
                {requestedRedeemCents > 0 && (
                  <Row label="Store credit" value={`-${formatMoney(requestedRedeemCents)}`} />
                )}
              </div>

              <div className="flex items-baseline justify-between pt-3 border-t border-border">
                <span className="eyebrow">Total</span>
                <span className="font-serif text-3xl">{formatMoney(total)}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center rounded-full px-6 h-12 text-sm font-bold uppercase tracking-wider text-black hover:opacity-90 transition-opacity disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/20"
                style={{ background: LIME }}
              >
                {submitting ? "Placing…" : fulfillment === "pickup" ? "Place Pickup Order" : "Place Order"}
              </button>

              <div className="relative py-1 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-graphite">
                <span className="flex-1 h-px bg-border" />
                <span>or</span>
                <span className="flex-1 h-px bg-border" />
              </div>

              <a
                href={waLink(waCheckoutMessage)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Send this order to AFP on WhatsApp (opens in a new tab)"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 text-sm font-semibold uppercase tracking-wider border border-foreground/20 hover:border-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
              >
                <MessageCircle aria-hidden="true" className="w-4 h-4" /> Order on WhatsApp
              </a>

              <p className="text-[11px] text-graphite text-center uppercase tracking-wider">
                Secure checkout · Prices in BBD
              </p>
            </div>
          </aside>
        </form>
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