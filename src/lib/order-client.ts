/**
 * The browser's side of an order: talking to /api/orders and remembering
 * which order this device is in the middle of.
 *
 * Two rules matter here:
 *  - The private order token is sent only in the `x-order-token` header and
 *    carried in links only after the `#`, which browsers never send to a
 *    server. It is never put in a query string.
 *  - Amounts are never worked out here. Everything shown after an order is
 *    reserved comes from the server's copy of the order.
 */
import type { CartItem } from "@/context/CartContext";
import { DEFAULT_PICKUP_LOCATIONS, type PaymentInfo, type PaymentMethod, type PickupLocation, type PublicOrder } from "@/lib/orders-core";
import type { Fulfillment } from "@/lib/pricing";

const ACTIVE_KEY = "afp-order-v1";
const TOKENS_KEY = "afp-order-tokens-v1";
const REF = /^AFP-\d{8}-\d{3}$/;
const TOKEN = /^[0-9a-f]{64}$/;

/** The order this device is part-way through at checkout. */
export interface ActiveOrder {
  ref: string;
  token: string;
  /** The bag as it was when the order was reserved, so a cancel can put it back. */
  bag: CartItem[];
}

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode): the order still works for this visit */
  }
};

export function loadActiveOrder(): ActiveOrder | null {
  const a = read<ActiveOrder>(ACTIVE_KEY);
  return a && REF.test(a.ref) && TOKEN.test(a.token) ? { ...a, bag: Array.isArray(a.bag) ? a.bag : [] } : null;
}
export function saveActiveOrder(order: ActiveOrder): void {
  write(ACTIVE_KEY, order);
  rememberToken(order.ref, order.token);
}
export function clearActiveOrder(): void {
  write(ACTIVE_KEY, null);
}

/** Keep the tokens of this device's recent orders so their status pages reopen. */
export function rememberToken(ref: string, token: string): void {
  if (!REF.test(ref) || !TOKEN.test(token)) return;
  const all = read<Record<string, string>>(TOKENS_KEY) ?? {};
  delete all[ref];
  const kept = Object.entries(all).slice(-9);
  write(TOKENS_KEY, Object.fromEntries([...kept, [ref, token]]));
}

/** The token for an order: from the link's fragment if present, else this device's memory. */
export function tokenFor(ref: string, hash: string): string | null {
  const fromHash = hash.replace(/^#/, "").trim();
  if (TOKEN.test(fromHash)) return fromHash;
  const stored = (read<Record<string, string>>(TOKENS_KEY) ?? {})[ref];
  return stored && TOKEN.test(stored) ? stored : null;
}

/** The most recent order placed from this device, if any. */
export function lastOrder(): { ref: string; token: string } | null {
  const entries = Object.entries(read<Record<string, string>>(TOKENS_KEY) ?? {});
  const last = entries[entries.length - 1];
  return last && REF.test(last[0]) && TOKEN.test(last[1]) ? { ref: last[0], token: last[1] } : null;
}

export const isOrderRef = (ref: string): boolean => REF.test(ref);

/** Path to an order's status page. The token rides after the #, never in the query. */
export const statusPath = (ref: string, token: string): string => `/order/${ref}#${token}`;

// --- API ---------------------------------------------------------------------

export interface Unavailable {
  sku: string;
  name: string;
  size: string;
  requested: number;
  available: number;
}

export interface OrderView {
  order: PublicOrder;
  payment?: PaymentInfo;
  /** Server clock minus this device's clock, in ms. Countdown uses this. */
  clockOffsetMs: number;
}

export type ApiFailure = {
  ok: false;
  status: number;
  error: string;
  field?: string;
  reason?: string;
  unavailable?: Unavailable[];
};
export type ApiResult<T> = ({ ok: true } & T) | ApiFailure;

/** True when a call failed. (A type guard, so it narrows under any compiler settings.) */
export const isFailure = <T,>(r: ApiResult<T>): r is ApiFailure => r.ok === false;

const OFFLINE = "We couldn't reach the shop. Check your connection and try again.";

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* not JSON: fall through to a generic message */
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof body.error === "string" ? body.error : "Something went wrong. Please try again.",
      field: typeof body.field === "string" ? body.field : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
      unavailable: Array.isArray(body.unavailable) ? (body.unavailable as Unavailable[]) : undefined,
    };
  }
  return { ok: true, ...(body as T) };
}

const withClock = <T extends { serverTime?: string }>(body: T): number => {
  const server = body.serverTime ? Date.parse(body.serverTime) : NaN;
  return Number.isFinite(server) ? server - Date.now() : 0;
};

type Wire = { order: PublicOrder; payment?: PaymentInfo; serverTime?: string; token?: string };

const toView = (r: ApiResult<Wire>): ApiResult<OrderView & { token?: string }> =>
  isFailure(r)
    ? r
    : { ok: true, order: r.order, payment: r.payment, token: r.token, clockOffsetMs: withClock(r) };

export interface ReserveInput {
  items: { sku: string; size: string; quantity: number }[];
  fulfillment: Fulfillment;
  pickupLocation: string;
  customer: { name: string; phone: string; email: string; address: string };
  /** True only if the customer ticked the marketing box. */
  marketingOptIn: boolean;
}

/** Pickup locations the owner offers. Falls back to the built-in list if the shop can't be reached. */
export async function fetchPickupLocations(): Promise<PickupLocation[]> {
  try {
    const res = await fetch("/api/checkout-config");
    if (!res.ok) return DEFAULT_PICKUP_LOCATIONS;
    const body = (await res.json()) as { pickupLocations?: PickupLocation[] };
    return Array.isArray(body.pickupLocations) && body.pickupLocations.length > 0 ? body.pickupLocations : DEFAULT_PICKUP_LOCATIONS;
  } catch {
    return DEFAULT_PICKUP_LOCATIONS;
  }
}

export async function reserveOrder(input: ReserveInput): Promise<ApiResult<OrderView & { token?: string }>> {
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return toView(await parse<Wire>(res));
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  }
}

export async function fetchOrder(ref: string, token: string): Promise<ApiResult<OrderView>> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(ref)}`, {
      headers: { "x-order-token": token },
      cache: "no-store",
    });
    return toView(await parse<Wire>(res));
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  }
}

export async function cancelOrder(ref: string, token: string): Promise<ApiResult<OrderView>> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(ref)}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-order-token": token },
      body: "{}",
    });
    return toView(await parse<Wire>(res));
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  }
}

export const PROOF_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** Send a proof, reporting progress (0 to 1) as it uploads. */
export function uploadProof(
  ref: string,
  token: string,
  file: File,
  method: PaymentMethod,
  onProgress: (fraction: number) => void,
): Promise<ApiResult<OrderView>> {
  return new Promise((resolve) => {
    const form = new FormData();
    form.set("method", method);
    form.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/orders/${encodeURIComponent(ref)}/proof`);
    xhr.setRequestHeader("x-order-token", token);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, error: OFFLINE });
    xhr.ontimeout = () => resolve({ ok: false, status: 0, error: OFFLINE });
    xhr.onload = async () => {
      const res = new Response(xhr.responseText, { status: xhr.status });
      resolve(toView(await parse<Wire>(res)));
    };
    xhr.send(form);
  });
}
