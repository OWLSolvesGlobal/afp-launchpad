import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firstAvailableSize, formatBbd, productImageUrl, type Product } from "@/lib/catalog";

export interface CartItem {
  id: string; // composite: sku + size
  sku: string;
  slug: string;
  name: string;
  priceCents: number;
  image: string; // resolved URL
  size: string;
  color: string;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product, opts?: { size?: string; quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
// v2: sku-keyed lines with BBD cents; ignore any v1 carts left in storage.
const STORAGE_KEY = "afp-cart-v2";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

    const addItem: CartContextValue["addItem"] = (product, opts) => {
      // Default to the first size that actually has stock, so quick-add never
      // silently queues a sold-out variant.
      const size = opts?.size ?? firstAvailableSize(product) ?? product.sizes[0] ?? "ONE SIZE";
      const quantity = opts?.quantity ?? 1;
      const id = `${product.sku}::${size}`;
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.id === id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
          return next;
        }
        return [
          ...prev,
          {
            id,
            sku: product.sku,
            slug: product.slug,
            name: product.name,
            priceCents: product.priceCents,
            image: productImageUrl(product.image),
            size,
            color: product.color,
            quantity,
          },
        ];
      });
      setIsOpen(true);
    };

    return {
      items,
      count,
      subtotal,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      removeItem: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
      updateQuantity: (id, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => i.id !== id)
            : prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i))
        ),
      clear: () => setItems([]),
    };
  }, [items, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

const noopCart: CartContextValue = {
  items: [],
  count: 0,
  subtotal: 0,
  isOpen: false,
  openCart: () => {},
  closeCart: () => {},
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clear: () => {},
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    if (typeof window !== "undefined") {
      console.warn("useCart called outside CartProvider — returning no-op cart");
    }
    return noopCart;
  }
  return ctx;
};

/** BBD display, e.g. `BDS $189.00`. */
export const formatMoney = formatBbd;
