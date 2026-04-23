import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Store, Check } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart, formatMoney } from "@/context/CartContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Fulfillment = "delivery" | "pickup";

const PICKUP_LOCATIONS = [
  {
    id: "downtown",
    name: "AFP Flagship — Downtown",
    address: "212 Market St, Floor 2",
    hours: "Mon–Sat · 10am–7pm",
  },
  {
    id: "westside",
    name: "AFP Westside Studio",
    address: "48 Lakeview Ave",
    hours: "Tue–Sun · 9am–6pm",
  },
];

export default function Checkout() {
  const { items, subtotal, count, clear } = useCart();
  const navigate = useNavigate();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [pickupLocation, setPickupLocation] = useState(PICKUP_LOCATIONS[0].id);

  useEffect(() => {
    document.title = "Checkout — Alo Fitness Pro";
  }, []);

  const shipping = useMemo(() => {
    if (fulfillment === "pickup") return 0;
    if (subtotal === 0) return 0;
    return subtotal >= 15000 ? 0 : 800; // free over $150, else $8
  }, [fulfillment, subtotal]);

  const tax = Math.round(subtotal * 0.08);
  const total = subtotal + shipping + tax;

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    toast.success(
      fulfillment === "pickup"
        ? "Order placed — we'll text you when it's ready for pickup."
        : "Order placed — confirmation email on the way."
    );
    clear();
    navigate("/");
  };

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

      <main className="flex-1 container pt-24 md:pt-28 pb-16 md:pb-24">
        <Link
          to="/shop/women"
          className="inline-flex items-center gap-2 eyebrow text-graphite hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3 h-3" /> Continue Shopping
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
                  subtitle="Ship to my address"
                  meta={subtotal >= 15000 ? "Free over $150" : "From $8 · 2–5 days"}
                />
                <FulfillmentCard
                  active={fulfillment === "pickup"}
                  onClick={() => setFulfillment("pickup")}
                  icon={<Store className="w-5 h-5" strokeWidth={1.5} />}
                  title="Store Pickup"
                  subtitle="Collect in-store"
                  meta="Free · Ready in 2 hours"
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
          </div>

          {/* RIGHT — order summary */}
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-24 border border-border p-6 md:p-8 space-y-6 bg-card">
              <div className="flex items-baseline justify-between">
                <h2 className="eyebrow text-graphite">Order Summary</h2>
                <span className="text-xs text-graphite">{count} {count === 1 ? "item" : "items"}</span>
              </div>

              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.id} className="py-3 flex gap-3">
                    <div className="w-16 h-20 bg-muted overflow-hidden shrink-0 relative">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      <span className="absolute -top-1 -right-1 bg-foreground text-background text-[10px] w-5 h-5 grid place-items-center rounded-full">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="text-[11px] text-graphite uppercase tracking-wider mt-0.5">
                          {item.color} · {item.size}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-medium">{formatMoney(item.price * item.quantity)}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Row label="Subtotal" value={formatMoney(subtotal)} />
                <Row
                  label={fulfillment === "pickup" ? "Pickup" : "Shipping"}
                  value={shipping === 0 ? "Free" : formatMoney(shipping)}
                />
                <Row label="Estimated tax" value={formatMoney(tax)} />
              </div>

              <div className="flex items-baseline justify-between pt-3 border-t border-border">
                <span className="eyebrow">Total</span>
                <span className="font-serif text-3xl">{formatMoney(total)}</span>
              </div>

              <Button type="submit" variant="afp-primary" size="afp" className="w-full">
                {fulfillment === "pickup" ? "Place Pickup Order" : "Place Order"}
              </Button>

              <p className="text-[11px] text-graphite text-center uppercase tracking-wider">
                Secure checkout · Demo payment
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
      "border p-5 text-left transition-colors flex flex-col gap-3 h-full",
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