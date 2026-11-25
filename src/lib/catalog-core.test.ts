import { describe, it, expect } from "vitest";
import {
  bbdToCents,
  deriveCategories,
  firstAvailableSize,
  formatBbd,
  isPurchasable,
  isSoldOut,
  makeOrderId,
  newOrderId,
  sizeStock,
  slugify,
  totalStock,
  visibleProducts,
  type CatalogProduct,
} from "@/lib/catalog-core";

const product = (overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  sku: "LV-1",
  slug: "zip-front-romper-magenta",
  name: "Zip-Front Romper — Magenta",
  description: "",
  gender: "women",
  category: "Bodysuits & Rompers",
  colors: [],
  priceCents: 18900,
  compareAtCents: null,
  sizes: ["S", "M", "L", "XL"],
  stock: { S: 3, M: 5, L: 0, XL: 2 },
  image: "ashlee-pink.webp",
  imageAlt: "Magenta romper",
  badge: null,
  active: true,
  ...overrides,
});

describe("bbdToCents", () => {
  it("converts plain and decimal amounts to integer cents", () => {
    expect(bbdToCents("189")).toBe(18_900);
    expect(bbdToCents("189.50")).toBe(18_950);
    expect(bbdToCents("0.05")).toBe(5);
  });

  it("tolerates currency decoration and thousands separators", () => {
    expect(bbdToCents("BDS $1,189.00")).toBe(118_900);
  });

  it("treats junk, blanks and negatives as zero (which the guard then hides)", () => {
    expect(bbdToCents("")).toBe(0);
    expect(bbdToCents("call us")).toBe(0);
    expect(bbdToCents("-40")).toBe(0);
    expect(bbdToCents(undefined)).toBe(0);
  });
});

describe("formatBbd", () => {
  it("renders the site-wide BBD format", () => {
    expect(formatBbd(18_900)).toBe("BDS $189.00");
    expect(formatBbd(5)).toBe("BDS $0.05");
  });

  it("groups thousands", () => {
    expect(formatBbd(123_456_789)).toBe("BDS $1,234,567.89");
  });
});

describe("isPurchasable / visibleProducts — the render guard", () => {
  it("excludes inactive products", () => {
    expect(isPurchasable(product({ active: false }))).toBe(false);
  });

  // Belt and suspenders: a price of 0 means "price not set yet" and must
  // never render, even if the row is flipped active.
  it("excludes price-0 products even when active", () => {
    expect(isPurchasable(product({ active: true, priceCents: 0 }))).toBe(false);
  });

  it("includes active products with a real price", () => {
    expect(isPurchasable(product())).toBe(true);
  });

  it("filters a mixed list down to purchasable rows only", () => {
    const list = [
      product({ sku: "A" }),
      product({ sku: "B", active: false }),
      product({ sku: "C", priceCents: 0 }),
    ];
    expect(visibleProducts(list).map((p) => p.sku)).toEqual(["A"]);
  });
});

describe("per-size stock", () => {
  it("reports stock for a given size", () => {
    const p = product();
    expect(sizeStock(p, "M")).toBe(5);
    expect(sizeStock(p, "L")).toBe(0);
  });

  it("reads a size with no entry as zero", () => {
    expect(sizeStock(product(), "XXL")).toBe(0);
  });

  it("sums total stock", () => {
    expect(totalStock(product())).toBe(10);
  });

  it("flags a product sold out only when every size is at zero", () => {
    expect(isSoldOut(product())).toBe(false);
    expect(isSoldOut(product({ stock: { S: 0, M: 0, L: 0, XL: 0 } }))).toBe(true);
  });

  it("finds the first size with stock, skipping sold-out ones", () => {
    expect(firstAvailableSize(product({ stock: { S: 0, M: 2, L: 0, XL: 0 } }))).toBe("M");
    expect(firstAvailableSize(product({ stock: { S: 0, M: 0, L: 0, XL: 0 } }))).toBeNull();
  });
});

describe("deriveCategories", () => {
  const list = [
    product({ sku: "M1", gender: "men", category: "Men: T-Shirts" }),
    product({ sku: "W1", gender: "women", category: "Bodysuits & Rompers" }),
    product({ sku: "U1", gender: "unisex", category: "Accessories" }),
    product({ sku: "W2", gender: "women", category: "Tennis & Golf" }),
  ];

  it("orders women's categories first, then unisex, then men's", () => {
    expect(deriveCategories(list)).toEqual([
      "Bodysuits & Rompers",
      "Tennis & Golf",
      "Accessories",
      "Men: T-Shirts",
    ]);
  });

  it("only counts purchasable products", () => {
    const hidden = [product({ active: false, category: "Ghost" })];
    expect(deriveCategories(hidden)).toEqual([]);
  });

  it("never hardcodes: a new Loyverse category creates a new category", () => {
    const withNew = [...list, product({ sku: "W3", gender: "women", category: "Swim" })];
    expect(deriveCategories(withNew)).toContain("Swim");
  });
});

describe("order references", () => {
  it("formats AFP-YYYYMMDD-XXX", () => {
    expect(makeOrderId(new Date(2026, 7, 5), 7)).toBe("AFP-20260805-007");
    expect(makeOrderId(new Date(2026, 0, 31), 123)).toBe("AFP-20260131-123");
  });

  it("wraps the sequence into three digits", () => {
    expect(makeOrderId(new Date(2026, 7, 5), 1234)).toBe("AFP-20260805-234");
  });

  it("newOrderId always matches the documented pattern", () => {
    for (let i = 0; i < 20; i++) {
      expect(newOrderId(new Date(2026, 11, 9))).toMatch(/^AFP-20261209-\d{3}$/);
    }
  });
});

describe("slugify", () => {
  it("handles the seed catalog's naming style", () => {
    expect(slugify("Zip-Front Romper — Magenta")).toBe("zip-front-romper-magenta");
    expect(slugify("Men's Performance Tee — White")).toBe("mens-performance-tee-white");
    expect(slugify("Bodysuits & Rompers")).toBe("bodysuits-and-rompers");
  });
});
