import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, X, ShoppingBag, MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart, formatMoney } from "@/context/CartContext";
import { LIME, waLink } from "@/lib/afp-catalog";

export const CartDrawer = () => {
  const { items, isOpen, closeCart, updateQuantity, removeItem, subtotal, count } = useCart();
  const navigate = useNavigate();

  const goToCheckout = () => {
    closeCart();
    navigate("/checkout");
  };

  const waMessage =
    items.length === 0
      ? "Hi AFP!"
      : `Hi AFP! I'd like to order:\n${items
          .map(
            (i) =>
              `• ${i.name} — ${i.color} / ${i.size} × ${i.quantity} (${formatMoney(
                i.price * i.quantity,
              )})`,
          )
          .join("\n")}\n\nSubtotal: ${formatMoney(subtotal)}`;

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? null : closeCart())}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 bg-background">
        <SheetHeader className="px-6 py-5 border-b border-border">
          <SheetTitle className="eyebrow text-left">
            Your Bag <span className="text-graphite ml-2">({count})</span>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
            <ShoppingBag className="w-10 h-10 text-graphite" strokeWidth={1.25} />
            <div>
              <div className="font-serif text-2xl">Your bag is empty</div>
              <p className="text-sm text-graphite mt-2">Add a piece to get started.</p>
            </div>
            <Button variant="afp-primary" size="afp" onClick={closeCart} asChild>
              <Link to="/shop/women">Shop Women</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="py-4 flex gap-4">
                  <Link
                    to={`/product/${item.slug}`}
                    onClick={closeCart}
                    aria-label={`View ${item.name}`}
                    className="w-24 h-28 bg-muted overflow-hidden shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold truncate">{item.name}</h4>
                        <div className="text-[11px] text-graphite mt-1 uppercase tracking-wider">
                          {item.color} · {item.size}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.name} from bag`}
                        className="text-graphite hover:text-foreground transition-colors p-1 -mt-1 -mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded-full"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-end justify-between pt-3">
                      <div className="inline-flex items-center border border-border rounded-full">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="pl-3 pr-2 py-1.5 hover:bg-muted transition-colors rounded-l-full"
                        >
                          <Minus className="w-3 h-3" aria-hidden="true" />
                        </button>
                        <span className="px-3 text-xs tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="pr-3 pl-2 py-1.5 hover:bg-muted transition-colors rounded-r-full"
                        >
                          <Plus className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatMoney(item.price * item.quantity)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-6 py-5 space-y-3 bg-background">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-graphite">Subtotal</span>
                <span className="font-serif text-2xl">{formatMoney(subtotal)}</span>
              </div>
              <p className="text-[11px] text-graphite uppercase tracking-wider">
                Shipping & taxes calculated at checkout
              </p>
              <button
                onClick={goToCheckout}
                className="w-full inline-flex items-center justify-center rounded-full px-6 h-12 text-sm font-bold uppercase tracking-wider text-black hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/20"
                style={{ background: LIME }}
              >
                Checkout — {formatMoney(subtotal)}
              </button>
              <a
                href={waLink(waMessage)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Order on WhatsApp (opens in a new tab)"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 h-11 text-xs font-semibold uppercase tracking-wider border border-foreground/20 hover:border-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
              >
                <MessageCircle aria-hidden="true" className="w-4 h-4" /> Order on WhatsApp
              </a>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};