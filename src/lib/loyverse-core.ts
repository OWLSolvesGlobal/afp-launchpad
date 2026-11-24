/**
 * Loyverse -> catalog snapshot. Pure functions: no network, no React, no DOM.
 * Imported by the sync Worker and the tests.
 *
 * Loyverse (the shop's point of sale) is the source of truth for items,
 * sizes, prices and stock. It has no place for website-only details (photo,
 * description, Men/Women section, show/hide), so those come from
 * `src/data/site-settings.json`, keyed by the Loyverse item name.
 *
 * Safety rules, in the same spirit as the render guards in catalog-core:
 *  - A size is sellable online only if Loyverse holds a FIXED price for it.
 *    "Variable" (price typed at the till) is never shown.
 *  - One product shows one price. If sizes carry different prices, the most
 *    common price wins and the other sizes are left out and reported, so the
 *    site can never quote the wrong amount for a size.
 *  - Negative or fractional stock reads as a whole number, never below 0.
 *  - Prices are never invented here. No fixed price -> priceCents 0 -> the
 *    existing `isPurchasable` guard keeps the product off the site.
 */
import {
  deriveCategories,
  slugify,
  type CatalogConfig,
  type CatalogProduct,
  type CatalogSnapshot,
  type Gender,
} from "./catalog-core";

// --- Loyverse API shapes (only the fields the sync reads) -------------------

export interface LoyverseVariantStore {
  store_id?: string;
  pricing_type?: string | null;
  price?: number | null;
  available_for_sale?: boolean | null;
}

export interface LoyverseVariant {
  variant_id: string;
  sku?: string | null;
  option1_value?: string | null;
  option2_value?: string | null;
  option3_value?: string | null;
  default_pricing_type?: string | null;
  default_price?: number | null;
  stores?: LoyverseVariantStore[] | null;
  deleted_at?: string | null;
}

export interface LoyverseItem {
  id: string;
  item_name: string;
  category_id?: string | null;
  variants?: LoyverseVariant[] | null;
  deleted_at?: string | null;
}

export interface LoyverseCategory {
  id: string;
  name: string;
  deleted_at?: string | null;
}

export interface LoyverseInventoryLevel {
  variant_id: string;
  store_id?: string;
  in_stock?: number | null;
}

// --- Website-only settings ---------------------------------------------------

export interface ItemSettings {
  /** Filename in src/assets. Blank or missing -> placeholder image. */
  image?: string;
  imageAlt?: string;
  description?: string;
  /** Overrides the automatic Men / Women / Accessories rule. */
  gender?: Gender;
  /** true keeps the item off the website even if it is priced and in stock. */
  hidden?: boolean;
  badge?: string;
}

export interface SiteSettings {
  /** Keyed by Loyverse item name (case and surrounding spaces ignored). */
  items?: Record<string, ItemSettings>;
  /** Loyverse categories whose items are accessories (unisex). */
  accessoryCategories?: string[];
  /** Shown as the category for items with no Loyverse category. */
  uncategorisedLabel?: string;
  config?: Partial<CatalogConfig>;
}

export interface LoyverseBuildResult {
  snapshot: CatalogSnapshot;
  /** Human-readable notes for the sync log: what was left out and why. */
  warnings: string[];
}

// --- Helpers -----------------------------------------------------------------

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL"];

const SIZE_ALIASES: Record<string, string> = {
  "extra small": "XS",
  xsmall: "XS",
  "x-small": "XS",
  xs: "XS",
  small: "S",
  smll: "S",
  sm: "S",
  s: "S",
  medium: "M",
  med: "M",
  m: "M",
  large: "L",
  lg: "L",
  l: "L",
  "extra large": "XL",
  xlarge: "XL",
  "x-large": "XL",
  xl: "XL",
  xxl: "XXL",
  "2xl": "XXL",
  xxs: "XXS",
};

export const ONE_SIZE = "ONE SIZE";

/** "Large" -> "L", "SMALL" -> "S", "Smll" -> "S", blank -> "ONE SIZE". */
export function normaliseSize(raw: string | null | undefined): string {
  const cleaned = (raw ?? "").trim();
  if (!cleaned) return ONE_SIZE;
  return SIZE_ALIASES[cleaned.toLowerCase()] ?? cleaned.toUpperCase();
}

function sizeRank(size: string): number {
  const i = SIZE_ORDER.indexOf(size);
  return i === -1 ? SIZE_ORDER.length : i;
}

/** Fixed price for a variant in integer cents, or 0 when none is set. */
export function variantPriceCents(variant: LoyverseVariant): number {
  const candidates: { type?: string | null; price?: number | null }[] = [
    { type: variant.default_pricing_type, price: variant.default_price },
    ...(variant.stores ?? []).map((s) => ({ type: s.pricing_type, price: s.price })),
  ];
  for (const c of candidates) {
    if (c.type === "FIXED" && typeof c.price === "number" && Number.isFinite(c.price) && c.price > 0) {
      return Math.round(c.price * 100);
    }
  }
  return 0;
}

/** A variant switched off for sale in every store is not sold online either. */
function variantAvailable(variant: LoyverseVariant): boolean {
  const stores = variant.stores ?? [];
  if (stores.length === 0) return true;
  return stores.some((s) => s.available_for_sale !== false);
}

const MENS_NAME = /\bmen['’]?s?\b/i;

export function deriveGender(
  itemName: string,
  category: string,
  settings: SiteSettings,
  override?: Gender,
): Gender {
  if (override === "women" || override === "men" || override === "unisex") return override;
  const accessories = (settings.accessoryCategories ?? []).map((c) => c.trim().toLowerCase());
  if (accessories.includes(category.trim().toLowerCase())) return "unisex";
  return MENS_NAME.test(itemName) ? "men" : "women";
}

const DEFAULT_CONFIG: CatalogConfig = {
  announcementBar: "",
  featuredSkus: [],
  heroOrder: [],
  paymentsCardEnabled: false,
  paymentsTransferEnabled: false,
  transferInstructions: "",
};

export function buildConfig(settings: SiteSettings): CatalogConfig {
  const c = settings.config ?? {};
  return {
    announcementBar: typeof c.announcementBar === "string" ? c.announcementBar : "",
    featuredSkus: Array.isArray(c.featuredSkus) ? c.featuredSkus.map(String) : [],
    heroOrder: Array.isArray(c.heroOrder) ? c.heroOrder.map(String) : [],
    // Payment paths stay off unless literally true, as before.
    paymentsCardEnabled: c.paymentsCardEnabled === true,
    paymentsTransferEnabled: c.paymentsTransferEnabled === true,
    transferInstructions:
      typeof c.transferInstructions === "string"
        ? c.transferInstructions
        : DEFAULT_CONFIG.transferInstructions,
  };
}

// --- The mapping -------------------------------------------------------------

export function buildLoyverseSnapshot(
  items: LoyverseItem[],
  categories: LoyverseCategory[],
  inventory: LoyverseInventoryLevel[],
  settings: SiteSettings,
  generatedAt: string,
): LoyverseBuildResult {
  const warnings: string[] = [];

  const categoryNames = new Map<string, string>();
  for (const c of categories) {
    if (!c.deleted_at) categoryNames.set(c.id, c.name.trim());
  }

  // Stock per variant, summed across stores.
  const stockByVariant = new Map<string, number>();
  for (const level of inventory) {
    const qty = typeof level.in_stock === "number" && Number.isFinite(level.in_stock) ? level.in_stock : 0;
    stockByVariant.set(level.variant_id, (stockByVariant.get(level.variant_id) ?? 0) + qty);
  }

  const itemSettings = new Map<string, ItemSettings>();
  for (const [name, value] of Object.entries(settings.items ?? {})) {
    itemSettings.set(name.trim().toLowerCase(), value ?? {});
  }
  const matchedSettings = new Set<string>();

  const usedSlugs = new Set<string>();
  const products: CatalogProduct[] = [];

  for (const item of items) {
    if (item.deleted_at) continue;
    const name = (item.item_name ?? "").trim();
    if (!name) continue;

    const key = name.toLowerCase();
    const site = itemSettings.get(key) ?? {};
    if (itemSettings.has(key)) matchedSettings.add(key);

    const category =
      (item.category_id && categoryNames.get(item.category_id)) ||
      (settings.uncategorisedLabel ?? "More");

    const variants = (item.variants ?? []).filter((v) => !v.deleted_at && variantAvailable(v));

    // Price: most common fixed price across sizes; ties go to the higher one.
    const priced = variants
      .map((v) => ({ v, cents: variantPriceCents(v) }))
      .filter((x) => x.cents > 0);
    const counts = new Map<number, number>();
    for (const x of priced) counts.set(x.cents, (counts.get(x.cents) ?? 0) + 1);
    let priceCents = 0;
    let best = 0;
    for (const [cents, n] of counts) {
      if (n > best || (n === best && cents > priceCents)) {
        best = n;
        priceCents = cents;
      }
    }

    const unpriced = variants.length - priced.length;
    if (variants.length > 0 && priced.length === 0) {
      warnings.push(`${name}: no fixed price in Loyverse, hidden`);
    } else if (unpriced > 0) {
      warnings.push(`${name}: ${unpriced} size(s) without a fixed price left out`);
    }

    const stock: Record<string, number> = {};
    let mismatched = 0;
    for (const { v, cents } of priced) {
      if (cents !== priceCents) {
        mismatched += 1;
        continue;
      }
      const size = normaliseSize(v.option1_value);
      const qty = Math.max(0, Math.floor(stockByVariant.get(v.variant_id) ?? 0));
      stock[size] = (stock[size] ?? 0) + qty;
    }
    if (mismatched > 0) {
      warnings.push(
        `${name}: ${mismatched} size(s) priced differently from the rest left out (one price per product)`,
      );
    }

    const sizes = Object.keys(stock).sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));

    let slug = slugify(name) || slugify(item.id);
    if (usedSlugs.has(slug)) slug = `${slug}-${slugify(item.id).slice(0, 8)}`;
    usedSlugs.add(slug);

    const image = (site.image ?? "").trim();
    products.push({
      sku: `LV-${item.id}`,
      slug,
      name,
      description: (site.description ?? "").trim(),
      gender: deriveGender(name, category, settings, site.gender),
      category,
      colors: [],
      priceCents,
      compareAtCents: null,
      sizes,
      stock,
      image,
      imageAlt: (site.imageAlt ?? "").trim() || name,
      badge: (site.badge ?? "").trim() || null,
      active: site.hidden !== true && sizes.length > 0,
    });
  }

  for (const key of itemSettings.keys()) {
    if (!matchedSettings.has(key)) {
      warnings.push(`site-settings: "${key}" matches no Loyverse item (renamed or deleted?)`);
    }
  }

  products.sort((a, b) => a.name.localeCompare(b.name));

  return {
    snapshot: {
      generatedAt,
      products,
      categories: deriveCategories(products),
      config: buildConfig(settings),
    },
    warnings,
  };
}
