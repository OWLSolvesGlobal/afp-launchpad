import { describe, it, expect } from "vitest";
import {
  FLAT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
  calculateOrderTotal,
  maxRedeemableCents,
  redeemCents,
  shippingCents,
  taxCents,
} from "@/lib/pricing";

describe("shippingCents", () => {
  it("is free for pickup regardless of subtotal", () => {
    expect(shippingCents(0, "pickup")).toBe(0);
    expect(shippingCents(500, "pickup")).toBe(0);
    expect(shippingCents(999_999, "pickup")).toBe(0);
  });

  it("is free for an empty cart", () => {
    expect(shippingCents(0, "delivery")).toBe(0);
  });

  it("charges the flat fee below the free-shipping threshold", () => {
    expect(shippingCents(100, "delivery")).toBe(FLAT_SHIPPING_CENTS);
    expect(shippingCents(29_999, "delivery")).toBe(FLAT_SHIPPING_CENTS);
  });

  // The boundary is where off-by-one errors actually cost money.
  it("is free exactly at the threshold", () => {
    expect(shippingCents(FREE_SHIPPING_THRESHOLD_CENTS, "delivery")).toBe(0);
  });

  it("is free above the threshold", () => {
    expect(shippingCents(FREE_SHIPPING_THRESHOLD_CENTS + 1, "delivery")).toBe(0);
  });
});

describe("taxCents", () => {
  it("is zero on an empty cart", () => {
    expect(taxCents(0)).toBe(0);
  });

  it("applies 17.5% VAT", () => {
    expect(taxCents(10_000)).toBe(1_750);
    expect(taxCents(20_000)).toBe(3_500);
  });

  it("returns whole cents, never fractions", () => {
    const tax = taxCents(999);
    expect(Number.isInteger(tax)).toBe(true);
    expect(tax).toBe(175); // 174.825 rounds to 175
  });
});

describe("maxRedeemableCents", () => {
  it("caps redemption at half the subtotal", () => {
    expect(maxRedeemableCents(100_000, 20_000)).toBe(10_000);
  });

  it("caps redemption at the available balance", () => {
    expect(maxRedeemableCents(500, 20_000)).toBe(500);
  });

  it("is zero with no balance", () => {
    expect(maxRedeemableCents(0, 20_000)).toBe(0);
  });

  it("is zero on an empty cart even with a balance", () => {
    expect(maxRedeemableCents(100_000, 0)).toBe(0);
  });

  it("never returns a fractional cent on an odd subtotal", () => {
    const max = maxRedeemableCents(100_000, 999);
    expect(max).toBe(499);
    expect(Number.isInteger(max)).toBe(true);
  });
});

describe("redeemCents", () => {
  it("converts dollar input to cents", () => {
    expect(redeemCents("50", 100_000, 20_000)).toBe(5_000);
    expect(redeemCents("12.34", 100_000, 20_000)).toBe(1_234);
  });

  it("clamps a request above the ceiling", () => {
    // Ceiling here is half of 20_000 = 10_000.
    expect(redeemCents("999", 100_000, 20_000)).toBe(10_000);
  });

  it("treats unparseable input as zero", () => {
    expect(redeemCents("", 100_000, 20_000)).toBe(0);
    expect(redeemCents("abc", 100_000, 20_000)).toBe(0);
  });

  it("never returns a negative amount", () => {
    expect(redeemCents("-100", 100_000, 20_000)).toBe(0);
  });
});

describe("calculateOrderTotal", () => {
  it("sums subtotal, shipping and tax for a small delivery order", () => {
    const t = calculateOrderTotal({
      subtotalCents: 20_000,
      fulfillment: "delivery",
    });
    expect(t.shippingCents).toBe(1_500);
    expect(t.taxCents).toBe(3_500);
    expect(t.redeemedCents).toBe(0);
    expect(t.totalCents).toBe(25_000);
  });

  it("drops the shipping line once the order qualifies for free delivery", () => {
    const t = calculateOrderTotal({
      subtotalCents: 30_000,
      fulfillment: "delivery",
    });
    expect(t.shippingCents).toBe(0);
    expect(t.totalCents).toBe(30_000 + 5_250);
  });

  it("subtracts applied store credit", () => {
    const t = calculateOrderTotal({
      subtotalCents: 20_000,
      fulfillment: "delivery",
      creditBalanceCents: 100_000,
      redeemDollarsInput: "50",
    });
    expect(t.redeemedCents).toBe(5_000);
    expect(t.totalCents).toBe(20_000 + 1_500 + 3_500 - 5_000);
  });

  it("caps credit at half the subtotal even when the balance is larger", () => {
    const t = calculateOrderTotal({
      subtotalCents: 20_000,
      fulfillment: "delivery",
      creditBalanceCents: 100_000,
      redeemDollarsInput: "999",
    });
    expect(t.redeemedCents).toBe(10_000);
    expect(t.totalCents).toBe(15_000);
  });

  it("charges nothing for an empty cart", () => {
    const t = calculateOrderTotal({ subtotalCents: 0, fulfillment: "delivery" });
    expect(t.totalCents).toBe(0);
  });

  it("never produces a negative total", () => {
    const t = calculateOrderTotal({
      subtotalCents: 1_000,
      fulfillment: "pickup",
      creditBalanceCents: 999_999,
      redeemDollarsInput: "9999",
    });
    expect(t.totalCents).toBeGreaterThanOrEqual(0);
  });

  it("returns whole cents for every line", () => {
    const t = calculateOrderTotal({
      subtotalCents: 12_345,
      fulfillment: "delivery",
      creditBalanceCents: 777,
      redeemDollarsInput: "3.33",
    });
    for (const v of Object.values(t)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
