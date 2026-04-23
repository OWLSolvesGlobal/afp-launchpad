import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart, formatMoney } from "@/context/CartContext";

export const CartDrawer = () => {
  const { items, isOpen, closeCart, updateQuantity, removeItem, subtotal, count } = useCart();
  const navigate = useNavigate();

  const goToCheckout = () => {
    closeCart();
    navigate("/checkout");
  };

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
                    className="w-20 h-24 bg-muted overflow-hidden shrink-0"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium truncate">{item.name}</h4>
                        <div className="text-[11px] text-graphite mt-1 uppercase tracking-wider">
                          {item.color} · {item.size}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label="Remove item"
                        className="text-graphite hover:text-foreground transition-colors p-1 -mt-1 -mr-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-end justify-between pt-3">
                      <div className="inline-flex items-center border border-border">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="px-2 py-1 hover:bg-muted transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 text-xs tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="px-2 py-1 hover:bg-muted transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-sm font-medium">
                        {formatMoney(item.price * item.quantity)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-6 py-5 space-y-4 bg-background">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-graphite">Subtotal</span>
                <span className="font-serif text-2xl">{formatMoney(subtotal)}</span>
              </div>
              <p className="text-[11px] text-graphite uppercase tracking-wider">
                Shipping & taxes calculated at checkout
              </p>
              <Button
                variant="afp-primary"
                size="afp"
                className="w-full"
                onClick={goToCheckout}
              >
                Checkout — {formatMoney(subtotal)}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};