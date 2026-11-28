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
  /** True only if the customer ticked "Email me about new drops and offers". */
  marketingOptIn: boolean;
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
  if (!email) return fail("Please enter your email address.", "email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
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
      // Consent must be an explicit yes. Anything else is a no.
      marketingOptIn: b.marketingOptIn === true,
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

// --- Payment proof ---------------------------------------------------------

export const PROOF_LIMITS = {
  /** Largest proof file accepted. */
  maxBytes: 8 * 1024 * 1024,
  /** Proofs one order may have accepted: the first plus two replacements. */
  maxUploadsPerOrder: 3,
  /** Upload attempts (accepted or refused) allowed on one order, ever. */
  maxAttemptsPerOrder: 12,
  /** Upload attempts allowed per visitor in the window below. */
  maxAttemptsPerWindow: 12,
  windowMinutes: 10,
} as const;

export const PAYMENT_METHODS = ["cibc_qr", "bank_transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);

export interface ProofType {
  contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  ext: "jpg" | "png" | "webp" | "pdf";
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

/**
 * What a file really is, from its first bytes. The file's name and the type
 * the browser claims are never consulted: a renamed program or web page is
 * refused because it does not begin the way a picture or PDF does.
 * Returns null for anything that is not a JPEG, PNG, WebP or PDF.
 */
export function sniffProof(bytes: Uint8Array): ProofType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", ext: "png" };
  }
  // "RIFF" <4 size bytes> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { contentType: "image/webp", ext: "webp" };
  }
  // "%PDF-"
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { contentType: "application/pdf", ext: "pdf" };
  return null;
}

/** AFP's bank details, typed into the owner's portal. Never in the repo. */
export interface BankDetails {
  bank: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  swift: string;
}

/**
 * Read the stored bank details. Returns null unless the three fields a
 * customer needs to make a transfer are all present, so the bank transfer
 * option is hidden rather than shown half-filled.
 */
export function parseBankDetails(stored: string | null | undefined): BankDetails | null {
  if (!stored) return null;
  try {
    const v = JSON.parse(stored) as Record<string, unknown>;
    const details: BankDetails = {
      bank: clean(v.bank, 80),
      accountName: clean(v.accountName, 120),
      accountNumber: clean(v.accountNumber, 40),
      branch: clean(v.branch, 120),
      swift: clean(v.swift, 20),
    };
    if (!details.bank || !details.accountName || !details.accountNumber) return null;
    return details;
  } catch {
    return null;
  }
}

/** What the customer may see about their own order. No internal fields. */
export interface PublicOrder {
  ref: string;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  fulfillment: Fulfillment;
  pickupLocation: string;
  items: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod | null;
  proofUploadedAt: string | null;
  /** How many more times the customer may send a proof for this order. */
  proofUploadsLeft: number;
  /** The owner's reason, shown only when a proof was rejected. */
  rejectedReason: string | null;
}

/** How the customer pays. Sent only with a valid order token, while payment is due. */
export interface PaymentInfo {
  bank: BankDetails | null;
}

// --- Owner's portal ----------------------------------------------------------

export interface PickupLocation {
  name: string;
  address: string;
  hours: string;
}

/** Used until the owner saves her own list in the portal's Settings. */
export const DEFAULT_PICKUP_LOCATIONS: PickupLocation[] = [
  { name: "AFP HQ — St Michael", address: "By appointment · St Michael, Barbados", hours: "Mon–Sat · 10am–6pm" },
  { name: "AFP Drop — Bridgetown", address: "Meet-up pickup arranged via WhatsApp", hours: "Tue–Sat · 11am–5pm" },
];

export const SETTINGS_LIMITS = { maxPickupLocations: 6 } as const;

/** Check a list of pickup locations typed into Settings. */
export function parsePickupInput(body: unknown): Result<PickupLocation[]> {
  const list = (body as { locations?: unknown } | null)?.locations;
  if (!Array.isArray(list) || list.length === 0) return fail("Add at least one pickup location.", "locations");
  if (list.length > SETTINGS_LIMITS.maxPickupLocations) {
    return fail(`You can have up to ${SETTINGS_LIMITS.maxPickupLocations} pickup locations.`, "locations");
  }
  const out: PickupLocation[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const name = clean(r.name, 60);
    if (name.length < 2) return fail("Every pickup location needs a name.", "locations");
    if (seen.has(name.toLowerCase())) return fail("Two pickup locations have the same name.", "locations");
    seen.add(name.toLowerCase());
    out.push({ name, address: clean(r.address, 120), hours: clean(r.hours, 80) });
  }
  return { ok: true, value: out };
}

/** The stored pickup locations, or the defaults if none have been saved. */
export function parsePickupLocations(stored: string | null | undefined): PickupLocation[] {
  if (!stored) return DEFAULT_PICKUP_LOCATIONS;
  try {
    const parsed = parsePickupInput({ locations: JSON.parse(stored) });
    return parsed.ok ? parsed.value : DEFAULT_PICKUP_LOCATIONS;
  } catch {
    return DEFAULT_PICKUP_LOCATIONS;
  }
}

/** Check bank details typed into Settings. All five are sent together, in full. */
export function parseBankInput(body: unknown): Result<BankDetails> {
  const b = (body ?? {}) as Record<string, unknown>;
  const details: BankDetails = {
    bank: clean(b.bank, 80),
    accountName: clean(b.accountName, 120),
    accountNumber: clean(b.accountNumber, 40),
    branch: clean(b.branch, 120),
    swift: clean(b.swift, 20).toUpperCase(),
  };
  if (details.bank.length < 2) return fail("Enter the bank's name.", "bank");
  if (details.accountName.length < 2) return fail("Enter the account name.", "accountName");
  if (!/^[0-9][0-9 -]{3,38}$/.test(details.accountNumber)) {
    return fail("Enter the account number, digits only.", "accountNumber");
  }
  if (details.swift && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(details.swift)) {
    return fail("A SWIFT code is 8 or 11 letters and numbers.", "swift");
  }
  return { ok: true, value: details };
}

/** An account number with everything but its last four digits hidden. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  return digits.length <= 4 ? "••••" : `•••• ${digits.slice(-4)}`;
}

/** The only status moves an admin can make. Anything else is refused. */
export const ADMIN_MOVES = {
  paid: { from: ["proof_uploaded"], to: "paid" },
  reject: { from: ["proof_uploaded"], to: "rejected" },
  delivered: { from: ["paid"], to: "delivered" },
  cancel: { from: ["reserved", "proof_uploaded"], to: "cancelled" },
} as const satisfies Record<string, { from: readonly OrderStatus[]; to: OrderStatus }>;
export type AdminMove = keyof typeof ADMIN_MOVES;

/** The words the owner sees for each status. Never the internal code. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  reserved: "Waiting for payment",
  proof_uploaded: "Proof to check",
  paid: "Paid, to deliver",
  delivered: "Delivered",
  expired: "Ran out of time",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const ADMIN_EMAILS = ["alofitnesspro@outlook.com", "brandonhlouis@outlook.com"] as const;
