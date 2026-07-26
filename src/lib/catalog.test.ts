import { describe, it, expect } from "vitest";
import {
  colorAvailable,
  formatPrice,
  sizeAvailable,
  stockFor,
  type StockEntry,
} from "@/lib/catalog";

const stock: StockEntry[] = [
  { size: "S", color: "Lime", quantity: 4 },
  { size: "M", color: "Lime", quantity: 0 },
  { size: "M", color: "Blush", quantity: 2 },
  { size: "L", color: "Blush", quantity: 0 },
];

describe("stockFor", () => {
  it("returns the quantity for a matching variant", () => {
    expect(stockFor(stock, "S", "Lime")).toBe(4);
    expect(stockFor(stock, "M", "Blush")).toBe(2);
  });

  it("returns zero for a sold-out variant", () => {
    expect(stockFor(stock, "M", "Lime")).toBe(0);
  });

  // A missing row must read as sold out, never as unlimited.
  it("returns zero for a combination that has no row at all", () => {
    expect(stockFor(stock, "XL", "Lime")).toBe(0);
    expect(stockFor([], "S", "Lime")).toBe(0);
  });
});

describe("sizeAvailable", () => {
  it("is true when any colour in that size has stock", () => {
    expect(sizeAvailable(stock, "S")).toBe(true);
    expect(sizeAvailable(stock, "M")).toBe(true); // Blush still has 2
  });

  it("is false when every colour in that size is at zero", () => {
    expect(sizeAvailable(stock, "L")).toBe(false);
  });

  it("is false for an unknown size", () => {
    expect(sizeAvailable(stock, "XXL")).toBe(false);
  });
});

describe("colorAvailable", () => {
  it("is true when the colour has stock in any size", () => {
    expect(colorAvailable(stock, "Lime")).toBe(true);
    expect(colorAvailable(stock, "Blush")).toBe(true);
  });

  it("narrows correctly when a size is supplied", () => {
    expect(colorAvailable(stock, "Lime", "S")).toBe(true);
    expect(colorAvailable(stock, "Lime", "M")).toBe(false); // Lime/M is zero
    expect(colorAvailable(stock, "Blush", "M")).toBe(true);
  });

  it("is false for an unknown colour", () => {
    expect(colorAvailable(stock, "Turquoise")).toBe(false);
  });
});

describe("formatPrice", () => {
  it("renders cents as a decimal amount", () => {
    expect(formatPrice(6_800)).toContain("68.00");
    expect(formatPrice(129_99)).toContain("129.99");
  });
});
