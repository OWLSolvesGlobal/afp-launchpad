import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { CartProvider, useCart, formatMoney } from "@/context/CartContext";
import type { Product } from "@/lib/catalog";

const product = (overrides: Partial<Product> = {}): Product => ({
  sku: "W-ROM-001",
  slug: "zip-front-romper-magenta",
  name: "Zip-Front Romper — Magenta",
  description: "",
  gender: "women",
  category: "Bodysuits & Rompers",
  color: "Magenta",
  priceCents: 6_800,
  compareAtCents: null,
  sizes: ["S", "M", "L", "XL"],
  stock: { S: 3, M: 5, L: 2, XL: 1 },
  image: "ashlee-pink.webp",
  imageAlt: "Magenta romper",
  badge: null,
  active: true,
  ...overrides,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const setup = () => renderHook(() => useCart(), { wrapper });

beforeEach(() => {
  localStorage.clear();
});

describe("cart basics", () => {
  it("starts empty", () => {
    const { result } = setup();
    expect(result.current.items).toHaveLength(0);
    expect(result.current.count).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("adds an item and reflects it in count and subtotal", () => {
    const { result } = setup();
    act(() => result.current.addItem(product()));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.count).toBe(1);
    expect(result.current.subtotal).toBe(6_800);
  });

  it("opens the drawer when something is added", () => {
    const { result } = setup();
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.addItem(product()));
    expect(result.current.isOpen).toBe(true);
  });

  it("multiplies price by quantity in the subtotal", () => {
    const { result } = setup();
    act(() => result.current.addItem(product(), { quantity: 3 }));

    expect(result.current.count).toBe(3);
    expect(result.current.subtotal).toBe(20_400);
  });

  it("carries the product's colour onto the line item", () => {
    const { result } = setup();
    act(() => result.current.addItem(product()));
    expect(result.current.items[0].color).toBe("Magenta");
  });
});

describe("variant handling", () => {
  it("merges quantity when the same size is added twice", () => {
    const { result } = setup();
    act(() => result.current.addItem(product(), { size: "M" }));
    act(() => result.current.addItem(product(), { size: "M" }));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.subtotal).toBe(13_600);
  });

  it("keeps different sizes as separate lines", () => {
    const { result } = setup();
    act(() => result.current.addItem(product(), { size: "S" }));
    act(() => result.current.addItem(product(), { size: "M" }));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.count).toBe(2);
  });

  it("keeps different products as separate lines", () => {
    const { result } = setup();
    act(() => result.current.addItem(product(), { size: "M" }));
    act(() => result.current.addItem(product({ sku: "W-ROM-002", slug: "sleeveless-romper-lime" }), { size: "M" }));

    expect(result.current.items).toHaveLength(2);
  });

  // Deliberate: quick-add must never queue a sold-out size, so the default
  // is the first size that actually has stock.
  it("defaults to the first size with stock", () => {
    const { result } = setup();
    act(() => result.current.addItem(product({ stock: { S: 0, M: 4, L: 1, XL: 0 } })));
    expect(result.current.items[0].size).toBe("M");
  });

  it("falls back to the only size for one-size products", () => {
    const { result } = setup();
    act(() =>
      result.current.addItem(
        product({ sizes: ["ONE SIZE"], stock: { "ONE SIZE": 6 } }),
      ),
    );
    expect(result.current.items[0].size).toBe("ONE SIZE");
  });
});

describe("quantity and removal", () => {
  it("updates quantity", () => {
    const { result } = setup();
    act(() => result.current.addItem(product()));
    const id = result.current.items[0].id;

    act(() => result.current.updateQuantity(id, 4));
    expect(result.current.count).toBe(4);
    expect(result.current.subtotal).toBe(27_200);
  });

  // A shopper decrementing to zero should empty the line, not leave a ghost.
  it("removes the line when quantity drops to zero", () => {
    const { result } = setup();
    act(() => result.current.addItem(product()));
    const id = result.current.items[0].id;

    act(() => result.current.updateQuantity(id, 0));
    expect(result.current.items).toHaveLength(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("removes the line for a negative quantity", () => {
    const { result } = setup();
    act(() => result.current.addItem(product()));
    const id = result.current.items[0].id;

    act(() => result.current.updateQuantity(id, -2));
    expect(result.current.items).toHaveLength(0);
  });

  it("removes a specific item", () => {
    const { result } = setup();
    act(() => result.current.addItem(product(), { size: "S" }));
    act(() => result.current.addItem(product(), { size: "M" }));
    const id = result.current.items[0].id;

    act(() => result.current.removeItem(id));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].size).toBe("M");
  });

  it("clears the whole cart", () => {
    const { result } = setup();
    act(() => result.current.addItem(product(), { size: "S" }));
    act(() => result.current.addItem(product(), { size: "M" }));

    act(() => result.current.clear());
    expect(result.current.items).toHaveLength(0);
    expect(result.current.subtotal).toBe(0);
  });
});

describe("persistence", () => {
  it("survives a remount", () => {
    const first = setup();
    act(() => first.result.current.addItem(product(), { size: "M" }));
    first.unmount();

    const second = setup();
    expect(second.result.current.items).toHaveLength(1);
    expect(second.result.current.items[0].size).toBe("M");
  });

  it("recovers from corrupted stored data rather than crashing", () => {
    localStorage.setItem("afp-cart-v2", "{not valid json");
    const { result } = setup();
    expect(result.current.items).toHaveLength(0);
  });
});

describe("formatMoney", () => {
  it("renders the BBD display format", () => {
    expect(formatMoney(6_800)).toBe("BDS $68.00");
    expect(formatMoney(0)).toBe("BDS $0.00");
  });
});
