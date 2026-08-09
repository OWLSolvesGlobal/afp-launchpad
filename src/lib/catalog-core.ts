/**
 * Catalog core — pure types and functions shared by the storefront, the
 * Cloudflare sync Worker, and the tests. No React, no network, no DOM.
 *
 * The Google Sheet is the source of truth. A Worker cron copies it into
 * Cloudflare KV every 5 minutes as a `CatalogSnapshot`; the site only ever
 * reads that snapshot via /api/catalog. Everything that interprets sheet
 * data lives here so both sides of the pipe agree exactly.
 */

export type Gender = "women" | "men" | "unisex";

export interface CatalogProduct {
  sku: string;
  slug: string;
  name: string;
  /** Short owner-written copy (1–3 sentences). Blank renders nothing. */
  description: string;
  gender: Gender;
  category: string;
  /**
   * Colour names from the Sheet's `color` column, pipe-separated for
   * multi-colour items (`Black | Lime`). Per-size stock is shared across
   * colours; items needing per-colour stock use one row per colourway.
   */
  colors: string[];
  /** BBD, integer cents. Never floats for money. */
  priceCents: number;
  compareAtCents: number | null;
  sizes: string[];
  /** size -> units on hand. A missing size reads as 0, never unlimited. */
  stock: Record<string, number>;
  /** Filename of an image in src/assets (not a URL). May be "". */
  image: string;
  imageAlt: string;
  badge: string | null;
  active: boolean;
}

export interface CatalogConfig {
  announcementBar: string;
  featuredSkus: string[];
  heroOrder: string[];
  /**
   * Payment paths are enabled by Sheet edit, never by deploy. Both default
   * to FALSE; only a literal TRUE turns one on.
   */
  paymentsCardEnabled: boolean;
  paymentsTransferEnabled: boolean;
  /** Multiline text shown on the transfer path (BimPay/1stPay details later). */
  transferInstructions: string;
}

/** Order lifecycle vocabulary — used in the Sheet's Orders tab and docs. */
export const ORDER_STATUSES = ["pending", "paid", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface CatalogSnapshot {
  generatedAt: string;
  products: CatalogProduct[];
  /** Distinct categories of purchasable products, women-first. */
  categories: string[];
  config: CatalogConfig;
}

export const DEFAULT_SIZES = ["S", "M", "L", "XL"];

/** Sheet columns that carry per-size stock for the standard size range. */
const SIZE_STOCK_COLUMNS: Record<string, string> = {
  XS: "stock_xs",
  S: "stock_s",
  M: "stock_m",
  L: "stock_l",
  XL: "stock_xl",
};

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** "189", "189.5", "BDS $1,189.00" -> integer cents. Unparseable -> 0. */
export function bbdToCents(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  const cleaned = String(input).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

/** Display format used everywhere on the site: `BDS $189.00`. */
export function formatBbd(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const formatted = dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${cents < 0 ? "-" : ""}BDS $${formatted}`;
}

// ---------------------------------------------------------------------------
// Slugs and order references
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Order reference quoted in the WhatsApp checkout message so the owner can
 * copy it straight into the Orders tab of the Sheet: AFP-YYYYMMDD-XXX.
 */
export function makeOrderId(date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const suffix = String(Math.abs(Math.trunc(seq)) % 1000).padStart(3, "0");
  return `AFP-${y}${m}${d}-${suffix}`;
}

export function newOrderId(date: Date = new Date()): string {
  return makeOrderId(date, Math.floor(Math.random() * 1000));
}

// ---------------------------------------------------------------------------
// Sheet parsing
// ---------------------------------------------------------------------------

type Row = Record<string, string>;

/** First row is headers; map the rest to lowercase-keyed objects. */
function rowsToObjects(rows: (string | number)[][]): Row[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h ?? "").trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const row: Row = {};
    headers.forEach((h, i) => {
      if (h) row[h] = String(cells?.[i] ?? "").trim();
    });
    return row;
  });
}

function parseSizes(raw: string): string[] {
  if (!raw) return [...DEFAULT_SIZES];
  const sizes = raw
    .split("|")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return sizes.length ? sizes : [...DEFAULT_SIZES];
}

function parseStock(row: Row, sizes: string[]): Record<string, number> {
  const stock: Record<string, number> = {};
  // A single non-standard size (e.g. ONE SIZE) draws from one_size_stock.
  const usesOneSize = sizes.length === 1 && !(sizes[0] in SIZE_STOCK_COLUMNS);
  for (const size of sizes) {
    const column = usesOneSize ? "one_size_stock" : SIZE_STOCK_COLUMNS[size];
    const qty = column ? Number.parseInt(row[column] ?? "", 10) : NaN;
    stock[size] = Number.isFinite(qty) && qty > 0 ? qty : 0;
  }
  return stock;
}

function parseGender(raw: string): Gender {
  const g = raw.toLowerCase();
  return g === "women" || g === "men" ? g : "unisex";
}

/**
 * Parse the Catalog tab (headers + data rows) into products. Rows without a
 * sku or name are skipped — a half-typed row must never take the site down.
 */
export function parseCatalogRows(rows: (string | number)[][]): CatalogProduct[] {
  const products: CatalogProduct[] = [];
  const seenSkus = new Set<string>();
  const seenSlugs = new Set<string>();

  for (const row of rowsToObjects(rows)) {
    const sku = (row["sku"] ?? "").toUpperCase();
    const name = row["name"] ?? "";
    if (!sku || !name || seenSkus.has(sku)) continue;
    seenSkus.add(sku);

    const sizes = parseSizes(row["sizes"] ?? "");
    let slug = slugify(name) || sku.toLowerCase();
    if (seenSlugs.has(slug)) slug = `${slug}-${sku.toLowerCase()}`;
    seenSlugs.add(slug);

    products.push({
      sku,
      slug,
      name,
      description: row["description"] ?? "",
      gender: parseGender(row["gender"] ?? ""),
      category: row["category"] || "Uncategorised",
      colors: (row["color"] ?? "")
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean),
      priceCents: bbdToCents(row["price_bbd"]),
      compareAtCents: row["compare_at_bbd"] ? bbdToCents(row["compare_at_bbd"]) : null,
      sizes,
      stock: parseStock(row, sizes),
      image: row["image"] ?? "",
      imageAlt: row["image_alt"] || name,
      badge: row["badge"] || null,
      active: (row["active"] ?? "").toUpperCase() === "TRUE",
    });
  }
  return products;
}

function parseList(raw: string): string[] {
  return raw
    .split(/[|,]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/** Parse the Config tab (key/value rows). Unknown keys are ignored. */
export function parseConfigRows(rows: (string | number)[][]): CatalogConfig {
  const map: Record<string, string> = {};
  for (const row of rowsToObjects(rows)) {
    const key = (row["key"] ?? "").toLowerCase();
    if (key) map[key] = row["value"] ?? "";
  }
  const flag = (key: string) => (map[key] ?? "").toUpperCase() === "TRUE";
  return {
    announcementBar: map["announcement_bar"] ?? "",
    featuredSkus: parseList(map["featured_skus"] ?? ""),
    heroOrder: parseList(map["hero_order"] ?? ""),
    paymentsCardEnabled: flag("payments_card_enabled"),
    paymentsTransferEnabled: flag("payments_transfer_enabled"),
    transferInstructions: map["transfer_instructions"] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Guards and derivations
// ---------------------------------------------------------------------------

/**
 * The only products the storefront may render. Belt and suspenders against a
 * half-filled Sheet going live: `active` must be TRUE *and* the price must be
 * a positive number. Prices are never invented — a product with price 0 stays
 * hidden even if someone flips it active.
 */
export function isPurchasable(p: CatalogProduct): boolean {
  return p.active && p.priceCents > 0;
}

export function visibleProducts(products: CatalogProduct[]): CatalogProduct[] {
  return products.filter(isPurchasable);
}

/** Units on hand for one size. Missing size reads as 0. */
export function sizeStock(p: CatalogProduct, size: string): number {
  return p.stock[size] ?? 0;
}

export function totalStock(p: CatalogProduct): number {
  return p.sizes.reduce((sum, s) => sum + sizeStock(p, s), 0);
}

/** Fully out of stock — still shown (with a Sold out state), never hidden. */
export function isSoldOut(p: CatalogProduct): boolean {
  return totalStock(p) === 0;
}

export function firstAvailableSize(p: CatalogProduct): string | null {
  return p.sizes.find((s) => sizeStock(p, s) > 0) ?? null;
}

/**
 * Distinct categories of purchasable products, women-first: categories with
 * any women's product come first, then unisex-only, then men-only. Within a
 * group, Sheet row order is preserved. Derived — never hardcoded.
 */
export function deriveCategories(products: CatalogProduct[]): string[] {
  const rank = new Map<string, number>();
  const order: string[] = [];
  for (const p of visibleProducts(products)) {
    const r = p.gender === "women" ? 0 : p.gender === "unisex" ? 1 : 2;
    if (!rank.has(p.category)) {
      rank.set(p.category, r);
      order.push(p.category);
    } else if (r < (rank.get(p.category) as number)) {
      rank.set(p.category, r);
    }
  }
  return order.sort((a, b) => {
    const diff = (rank.get(a) as number) - (rank.get(b) as number);
    return diff !== 0 ? diff : order.indexOf(a) - order.indexOf(b);
  });
}

export function categorySlug(category: string): string {
  return slugify(category);
}

/** Assemble the snapshot the sync Worker writes to KV. */
export function buildSnapshot(
  catalogRows: (string | number)[][],
  configRows: (string | number)[][],
  generatedAt: string,
): CatalogSnapshot {
  const products = parseCatalogRows(catalogRows);
  return {
    generatedAt,
    products,
    categories: deriveCategories(products),
    config: parseConfigRows(configRows),
  };
}
