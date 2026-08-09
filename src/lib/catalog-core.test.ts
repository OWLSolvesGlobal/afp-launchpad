import { describe, it, expect } from "vitest";
import {
  bbdToCents,
  buildSnapshot,
  deriveCategories,
  firstAvailableSize,
  formatBbd,
  isPurchasable,
  isSoldOut,
  makeOrderId,
  newOrderId,
  parseCatalogRows,
  parseConfigRows,
  sizeStock,
  slugify,
  totalStock,
  visibleProducts,
  type CatalogProduct,
} from "@/lib/catalog-core";

const HEADERS = [
  "sku", "name", "description", "gender", "category", "color", "price_bbd",
  "compare_at_bbd", "sizes", "stock_S", "stock_M", "stock_L", "stock_XL",
  "one_size_stock", "image", "image_alt", "badge", "active",
];

const row = (overrides: Partial<Record<string, string>> = {}): string[] => {
  const base: Record<string, string> = {
    sku: "W-ROM-001",
    name: "Zip-Front Romper — Magenta",
    description: "",
    gender: "women",
    category: "Bodysuits & Rompers",
    color: "Magenta",
    price_bbd: "189.00",
    compare_at_bbd: "",
    sizes: "",
    stock_S: "3",
    stock_M: "5",
    stock_L: "0",
    stock_XL: "2",
    one_size_stock: "",
    image: "ashlee-pink.webp",
    image_alt: "Magenta romper",
    badge: "",
    active: "TRUE",
    ...overrides,
  };
  return HEADERS.map((h) => base[h] ?? "");
};

const parseOne = (overrides: Partial<Record<string, string>> = {}): CatalogProduct =>
  parseCatalogRows([HEADERS, row(overrides)])[0];

const product = (overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  ...parseOne(),
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

describe("parseCatalogRows", () => {
  it("parses a full row", () => {
    const p = parseOne();
    expect(p.sku).toBe("W-ROM-001");
    expect(p.name).toBe("Zip-Front Romper — Magenta");
    expect(p.gender).toBe("women");
    expect(p.priceCents).toBe(18_900);
    expect(p.compareAtCents).toBeNull();
    expect(p.active).toBe(true);
    expect(p.slug).toBe("zip-front-romper-magenta");
  });

  // Blank description stays blank — the product page renders nothing, never
  // placeholder copy.
  it("passes description through and defaults it to empty", () => {
    expect(parseOne({ description: "Second-skin fit. Front zip." }).description).toBe(
      "Second-skin fit. Front zip.",
    );
    expect(parseOne().description).toBe("");
  });

  // Blank `sizes` must mean the default S|M|L|XL run, not "no sizes".
  it("defaults blank sizes to S|M|L|XL", () => {
    expect(parseOne({ sizes: "" }).sizes).toEqual(["S", "M", "L", "XL"]);
  });

  it("honours a per-item sizes override", () => {
    expect(parseOne({ sizes: "XS | S | M" }).sizes).toEqual(["XS", "S", "M"]);
  });

  it("maps per-size stock columns onto the size run", () => {
    const p = parseOne();
    expect(p.stock).toEqual({ S: 3, M: 5, L: 0, XL: 2 });
  });

  it("reads ONE SIZE items from one_size_stock", () => {
    const p = parseOne({ sizes: "ONE SIZE", one_size_stock: "7" });
    expect(p.sizes).toEqual(["ONE SIZE"]);
    expect(p.stock).toEqual({ "ONE SIZE": 7 });
  });

  it("treats blank or junk stock cells as zero, never unlimited", () => {
    const p = parseOne({ stock_S: "", stock_M: "lots", stock_L: "-4" });
    expect(p.stock.S).toBe(0);
    expect(p.stock.M).toBe(0);
    expect(p.stock.L).toBe(0);
  });

  it("skips rows missing a sku or name", () => {
    const rows = [HEADERS, row({ sku: "" }), row({ sku: "W-X", name: "" }), row({ sku: "W-OK" })];
    const out = parseCatalogRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].sku).toBe("W-OK");
  });

  it("ignores a duplicate sku instead of double-listing", () => {
    const out = parseCatalogRows([HEADERS, row(), row()]);
    expect(out).toHaveLength(1);
  });

  it("de-duplicates slugs when two products share a name", () => {
    const out = parseCatalogRows([HEADERS, row(), row({ sku: "W-ROM-009" })]);
    // Row 2 shares the name, so its slug gets the sku suffix.
    const slugs = out.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("normalises unknown genders to unisex rather than dropping the product", () => {
    expect(parseOne({ gender: "womens" }).gender).toBe("unisex");
  });

  // Only a literal TRUE activates a row; blanks and anything else stay hidden.
  it("parses the active flag strictly", () => {
    expect(parseOne({ active: "TRUE" }).active).toBe(true);
    expect(parseOne({ active: "true" }).active).toBe(true);
    expect(parseOne({ active: "FALSE" }).active).toBe(false);
    expect(parseOne({ active: "" }).active).toBe(false);
    expect(parseOne({ active: "yes" }).active).toBe(false);
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

  it("never hardcodes: a new sheet value creates a new category", () => {
    const withNew = [...list, product({ sku: "W3", gender: "women", category: "Swim" })];
    expect(deriveCategories(withNew)).toContain("Swim");
  });
});

describe("config parsing", () => {
  it("reads the known keys", () => {
    const cfg = parseConfigRows([
      ["key", "value"],
      ["announcement_bar", "Free delivery over BDS $300"],
      ["featured_skus", "W-ROM-001 | w-drs-002"],
      ["hero_order", "W-SET-001, W-ROM-002"],
    ]);
    expect(cfg.announcementBar).toBe("Free delivery over BDS $300");
    expect(cfg.featuredSkus).toEqual(["W-ROM-001", "W-DRS-002"]);
    expect(cfg.heroOrder).toEqual(["W-SET-001", "W-ROM-002"]);
  });

  it("returns empty defaults for a missing tab", () => {
    const cfg = parseConfigRows([]);
    expect(cfg.announcementBar).toBe("");
    expect(cfg.featuredSkus).toEqual([]);
    expect(cfg.heroOrder).toEqual([]);
  });
});

describe("buildSnapshot", () => {
  it("assembles products, derived categories and config", () => {
    const snap = buildSnapshot(
      [HEADERS, row(), row({ sku: "M-TEE-001", name: "Tee", gender: "men", category: "Men: T-Shirts" })],
      [["key", "value"], ["announcement_bar", "hi"]],
      "2026-08-05T12:00:00.000Z",
    );
    expect(snap.generatedAt).toBe("2026-08-05T12:00:00.000Z");
    expect(snap.products).toHaveLength(2);
    expect(snap.categories).toEqual(["Bodysuits & Rompers", "Men: T-Shirts"]);
    expect(snap.config.announcementBar).toBe("hi");
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
