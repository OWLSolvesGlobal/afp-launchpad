import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { CartProvider, useCart, formatMoney } from "@/context/CartContext";
import type { Product } from "@/lib/catalog";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "w-001",
  slug: "lime-zip-romper",
  name: "Lime Zip Romper",
  gender: "women",
  category: "rompers",
  price: 6_800,
  colors: [
    { name: "Lime", hex: "#B5D334" },
    { name: "Blush", hex: "#F7C8D0" },
  ],
  sizes: ["XS", "S", "M", "L"],
  image: "/img/lime.jpg",
  images: ["/img/lime.jpg"],
  imageAlt: "Lime zip romper",
  badge: null,
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
});

describe("variant handling", () => {
  it("merges quantity when the same size and colour is added twice", () => {
    const { result } = setup();
    act(() => result.current.addItem(product(), { size: "M", color: "Lime" }));
    act(() => result.current.addItem(product(), { size: "M", color: "Lime" }));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.subtotal).toBe(13_600);
  });

  it("keeps different sizes as separate lines", () => {
    const { result } = setup();
    act(() => result.current.addItem(product(), { size: "S", color: "Lime" }));
    act(() => result.current.addItem(product(), { size: "M", color: "Lime" }));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.count).toBe(2);
  });

  it("keeps different colours as separate lines", () => {
    const { result } = setup();
    act(() => result.current.addItem(product(), { size: "M", color: "Lime" }));
    act(() => result.current.addItem(product(), { size: "M", color: "Blush" }));

    expect(result.current.items).toHaveLength(2);
  });

  // Deliberate: the default skips the first size so shoppers don't land on XS.
  // Locking it in so a future "tidy-up" doesn't silently change what's added.
  it("defaults to the second size when several are available", () => {
    const { result } = setup();
    act(() => result.current.addItem(product()));
    expect(result.current.items[0].size).toBe("S");
  });

  it("falls back to the only size for single-size products", () => {
    const { result } = setup();
    act(() => result.current.addItem(product({ sizes: ["OS"] })));
    expect(result.current.items[0].size).toBe("OS");
  });

  it("defaults to the first colour", () => {
    const { result } = setup();
    act(() => result.current.addItem(product()));
    expect(result.current.items[0].color).toBe("Lime");
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
    localStorage.setItem("afp-cart-v1", "{not valid json");
    const { result } = setup();
    expect(result.current.items).toHaveLength(0);
  });
});

describe("formatMoney", () => {
  it("renders cents as a decimal amount", () => {
    expect(formatMoney(6_800)).toContain("68.00");
    expect(formatMoney(0)).toContain("0.00");
  });
});
