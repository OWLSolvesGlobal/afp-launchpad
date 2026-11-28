/**
 * Catalog core — pure types and functions shared by the storefront, the
 * Cloudflare sync Worker, and the tests. No React, no network, no DOM.
 *
 * Loyverse is the source of truth. A Worker cron copies it into Cloudflare
 * KV every 5 minutes as a `CatalogSnapshot` (see loyverse-core.ts); the site
 * only ever reads that snapshot via /api/catalog. The snapshot types and the
 * render guards live here so both sides of the pipe agree exactly.
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
  /** Colour names. Empty for Loyverse items: each colour is its own item. */
  colors: string[];
  /** BBD, integer cents. Never floats for money. */
  priceCents: number;
  compareAtCents: number | null;
  sizes: string[];
  /** size -> units on hand. A missing size reads as 0, never unlimited. */
  stock: Record<string, number>;
  /** Filename of an image in src/assets (not a URL). May be "". */
  image: string;
  /**
   * Site-relative URL of the item's Loyverse photo (served by the Worker at
   * /api/image/<item id>), or "" when the item has no photo in Loyverse.
   * When present it wins over `image`: the owner controls photos in Loyverse.
   */
  imageUrl?: string;
  imageAlt: string;
  badge: string | null;
  active: boolean;
}

export interface CatalogConfig {
  announcementBar: string;
  featuredSkus: string[];
  heroOrder: string[];
  /** Payment paths are switched in site-settings.json. Both default to off. */
  paymentsCardEnabled: boolean;
  paymentsTransferEnabled: boolean;
  /** Multiline text shown on the transfer path (BimPay/1stPay details later). */
  transferInstructions: string;
}

export interface CatalogSnapshot {
  generatedAt: string;
  products: CatalogProduct[];
  /** Distinct categories of purchasable products, women-first. */
  categories: string[];
  config: CatalogConfig;
}

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
 * Format of an order reference: AFP-YYYYMMDD-XXX. References are issued by
 * the server when an order is reserved (newOrderRef in orders-core).
 */
export function makeOrderId(date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const suffix = String(Math.abs(Math.trunc(seq)) % 1000).padStart(3, "0");
  return `AFP-${y}${m}${d}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Render guards and stock helpers
// ---------------------------------------------------------------------------

/**
 * The only products the storefront may render. Belt and suspenders against a
 * half-filled item going live: `active` must be true *and* the price must be
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
 * group, catalog order is preserved. Derived — never hardcoded.
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
