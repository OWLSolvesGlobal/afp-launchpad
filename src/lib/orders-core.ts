/**
 * Order rules — pure functions, no network, no database, no React.
 * Imported by the Worker (which owns the database) and the tests.
 *
 * The browser sends WHAT the customer wants (items, sizes, quantities, their
 * details). It never sends a price or a total: every amount is worked out
 * here from the catalog snapshot, so a tampered request cannot change what
 * an order costs.
 */
import {
  isPurchasable,
  makeOrderId,
  sizeStock,
  type CatalogProduct,
  type CatalogSnapshot,
} from "./catalog-core";
import { calculateOrderTotal, type Fulfillment } from "./pricing";

/** How long items are reserved while the customer pays and uploads proof. */
export const PAY_WINDOW_MINUTES = 60;

export const ORDER_LIMITS = {
  maxLines: 20,
  maxQuantityPerLine: 10,
  maxBodyBytes: 10_000,
  /** Order attempts allowed per visitor in the window below. */
  maxOrdersPerWindow: 6,
  windowMinutes: 10,
  /** Unpaid reservations one visitor may hold at once. */
  maxOpenReservations: 3,
} as const;

export const ORDER_STATUSES = [
  "reserved",
  "proof_uploaded",
  "paid",
  "delivered",
  "expired",
  "rejected",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderLineInput {
  sku: string;
  size: string;
  quantity: number;
}

export interface OrderInput {
  items: OrderLineInput[];
  fulfillment: Fulfillment;
  pickupLocation: string;
  customer: { name: string; phone: string; email: string; address: string };
}

export interface PricedLine {
  sku: string;
  name: string;
  size: string;
  quantity: number;
  priceCents: number;
}

export interface PricedOrder {
  lines: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; field?: string };

const fail = (error: string, field?: string): Result<never> => ({ ok: false, error, field });

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * Check and tidy everything the browser sent. Unknown fields are dropped;
 * anything resembling a price or total is ignored entirely.
 */
export function parseOrderInput(body: unknown): Result<OrderInput> {
  if (!body || typeof body !== "object") return fail("We couldn't read that order.");
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.items) || b.items.length === 0) return fail("Your bag is empty.", "items");
  if (b.items.length > ORDER_LIMITS.maxLines) return fail("That's too many different items for one order.", "items");

  const merged = new Map<string, OrderLineInput>();
  for (const raw of b.items) {
    const line = (raw ?? {}) as Record<string, unknown>;
    const sku = clean(line.sku, 80);
    const size = clean(line.size, 20);
    const quantity = line.quantity;
    if (!sku || !size) return fail("One of the items in your bag is missing its size.", "items");
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return fail("One of the quantities isn't a whole number.", "items");
    }
    const key = `${sku}\u0000${size}`;
    const existing = merged.get(key);
    const total = (existing?.quantity ?? 0) + quantity;
    if (total > ORDER_LIMITS.maxQuantityPerLine) {
      return fail(`You can order up to ${ORDER_LIMITS.maxQuantityPerLine} of one size at a time.`, "items");
    }
    merged.set(key, { sku, size, quantity: total });
  }

  const fulfillment = b.fulfillment === "pickup" ? "pickup" : b.fulfillment === "delivery" ? "delivery" : null;
  if (!fulfillment) return fail("Choose delivery or pickup.", "fulfillment");

  const c = (b.customer ?? {}) as Record<string, unknown>;
  const name = clean(c.name, 80);
  const phone = clean(c.phone, 30);
  const email = clean(c.email, 120).toLowerCase();
  const address = clean(c.address, 300);

  if (name.length < 2) return fail("Please enter your name.", "name");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15 || !/^[+\d][\d\s().-]*$/.test(phone)) {
    return fail("Please enter a phone number we can reach you on.", "phone");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return fail("That email address doesn't look right.", "email");
  }
  if (fulfillment === "delivery" && address.length < 8) {
    return fail("Please enter the delivery address.", "address");
  }

  return {
    ok: true,
    value: {
      items: [...merged.values()],
      fulfillment,
      pickupLocation: fulfillment === "pickup" ? clean(b.pickupLocation, 60) : "",
      customer: { name, phone, email, address: fulfillment === "delivery" ? address : "" },
    },
  };
}

/**
 * Price an order from the catalog. Fails if any item is not currently for
 * sale or the size does not exist. Stock is checked separately, atomically,
 * in the database.
 */
export function priceOrder(input: OrderInput, snapshot: CatalogSnapshot): Result<PricedOrder> {
  const bySku = new Map<string, CatalogProduct>();
  for (const p of snapshot.products) bySku.set(p.sku, p);

  const lines: PricedLine[] = [];
  for (const item of input.items) {
    const product = bySku.get(item.sku);
    if (!product || !isPurchasable(product)) {
      return fail("One of the items in your bag is no longer available.", "items");
    }
    if (!product.sizes.includes(item.size)) {
      return fail(`${product.name} is not available in size ${item.size}.`, "items");
    }
    lines.push({
      sku: product.sku,
      name: product.name,
      size: item.size,
      quantity: item.quantity,
      priceCents: product.priceCents,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const totals = calculateOrderTotal({ subtotalCents, fulfillment: input.fulfillment });
  return {
    ok: true,
    value: {
      lines,
      subtotalCents,
      shippingCents: totals.shippingCents,
      totalCents: totals.totalCents,
    },
  };
}

export const holdKey = (sku: string, size: string): string => `${sku}\u0000${size}`;

/**
 * The catalog as customers should see it: Loyverse stock minus items held by
 * open orders. Never below zero. Returns a new snapshot; the input is untouched.
 */
export function applyHolds(snapshot: CatalogSnapshot, holds: Map<string, number>): CatalogSnapshot {
  if (holds.size === 0) return snapshot;
  return {
    ...snapshot,
    products: snapshot.products.map((p) => {
      let changed = false;
      const stock: Record<string, number> = { ...p.stock };
      for (const size of p.sizes) {
        const held = holds.get(holdKey(p.sku, size)) ?? 0;
        if (held > 0) {
          stock[size] = Math.max(0, sizeStock(p, size) - held);
          changed = true;
        }
      }
      return changed ? { ...p, stock } : p;
    }),
  };
}

/** Barbados is UTC-4 all year; order references carry the local date. */
export function barbadosDate(now: Date): Date {
  return new Date(now.getTime() - 4 * 60 * 60 * 1000);
}

export function newOrderRef(now: Date, random: () => number = Math.random): string {
  const local = barbadosDate(now);
  // makeOrderId reads the date with local getters; feed it UTC parts.
  const asLocal = new Date(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return makeOrderId(asLocal, Math.floor(random() * 1000));
}

export function expiryFor(now: Date): string {
  return new Date(now.getTime() + PAY_WINDOW_MINUTES * 60 * 1000).toISOString();
}

/** What the customer may see about their own order. No internal fields. */
export interface PublicOrder {
  ref: string;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  fulfillment: Fulfillment;
  items: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}
