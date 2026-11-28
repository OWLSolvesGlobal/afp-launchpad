/**
 * The portal's calls to /api/admin/*.
 *
 * Signing in is Cloudflare Access's job: it sits in front of /admin and adds
 * a signed token to every request, which the Worker checks. This file never
 * handles a password or a token. It only notices when the sign-in has lapsed
 * (the API answers 403, or Access redirects the request to its sign-in page)
 * and says so, so the screen can ask the owner to sign in again.
 */
import type { OrderStatus, PickupLocation, PricedLine } from "@/lib/orders-core";

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message);
  }
  /** True when the owner needs to sign in again. */
  get signedOut(): boolean {
    return this.status === 403 || this.status === 0;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/admin/${path}`, { cache: "no-store", credentials: "same-origin", redirect: "manual", ...init });
  } catch {
    throw new AdminError("We couldn't reach the shop. Check your connection and try again.", -1);
  }
  // Access answers a lapsed session with a redirect to its sign-in page.
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new AdminError("Your sign-in has ended.", 0);
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    if (res.ok) throw new AdminError("Something went wrong. Please try again.", res.status);
  }
  if (!res.ok) {
    throw new AdminError(
      typeof body.error === "string" ? body.error : "Something went wrong. Please try again.",
      res.status,
      typeof body.field === "string" ? body.field : undefined,
    );
  }
  return body as T;
}

export const adminGet = <T,>(path: string) => call<T>(path);
export const adminPost = <T,>(path: string, body: unknown = {}) =>
  call<T>(path, {
    method: "POST",
    // x-afp-admin cannot be set by a form on another site; the Worker requires it.
    headers: { "content-type": "application/json", "x-afp-admin": "1" },
    body: JSON.stringify(body),
  });

export interface AdminOrder {
  ref: string;
  status: OrderStatus;
  customerName: string;
  totalCents: number;
  fulfillment: "delivery" | "pickup";
  pickupLocation: string;
  paymentMethod: string | null;
  createdAt: string;
  expiresAt: string;
  proofUploadedAt: string | null;
  paidAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  hasProof: boolean;
  needsLoyverse: boolean;
  /** Set only while the last Mark paid, Reject or Cancel can still be undone. */
  undoUntil: string | null;
  canReopen: boolean;
  /** What she noted arriving in the bank, when it was not the order total. */
  receivedCents: number | null;
  itemCount: number;
}

export interface AdminOrderDetail extends AdminOrder {
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  subtotalCents: number;
  shippingCents: number;
  closedReason: string;
  marketingOptIn: boolean;
  /** Other orders the very same proof file was sent for. */
  sameProofAs: { ref: string; customerName: string }[];
  items: PricedLine[];
  history: { at: string; actor: string; action: string; detail: string | null }[];
}

export interface Summary {
  proofsWaiting: number;
  toDeliver: number;
  heldUnpaid: number;
  needsLoyverse: number;
  /** Paid more than a day ago and still not rung up in Loyverse. */
  loyverseOverdue?: number;
  paidTodayCount: number;
  paidTodayCents: number;
  /** "off": email alerts not set up. "trouble": a recent alert could not be sent. */
  emailAlerts?: "off" | "trouble" | "ok";
}

export interface AdminSettings {
  bank: {
    bank: string;
    accountName: string;
    accountNumberMasked: string;
    branch: string;
    swift: string;
    updatedAt: string | null;
    updatedBy: string | null;
  } | null;
  pickupLocations: PickupLocation[];
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  orderRef: string | null;
  detail: string | null;
}

// --- Small display helpers -------------------------------------------------------

/** "12 min", "3 hr", "2 days": how long ago, in plain words. */
export function ago(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** A date and time as Barbados reads it, e.g. "28 Nov, 11:04 am". */
export function when(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-BB", {
    timeZone: "America/Barbados",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** A wa.me link for a number typed the local way (246 555 0100, 555 0100, +1 246…). */
export function whatsappLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 7) digits = `1246${digits}`;
  else if (digits.length === 10) digits = `1${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** What each log line means, in the owner's words. */
export function describeAction(action: string): string {
  const words: Record<string, string> = {
    order_reserved: "Order placed, items held",
    order_expired: "Ran out of time, items released",
    order_cancelled: "Cancelled",
    order_paid: "Marked paid",
    order_rejected: "Proof rejected",
    order_delivered: "Marked delivered",
    order_recorded_in_loyverse: "Rung up in Loyverse",
    order_undone: "Undone: put back as it was",
    order_reopened: "Reopened, items held again",
    payment_noted: "Amount seen in the bank noted",
    proof_uploaded: "Proof of payment received",
    proof_replaced: "Proof of payment replaced",
    proof_refused: "An upload was refused",
    settings_changed: "Settings changed",
  };
  return words[action] ?? action.replace(/_/g, " ");
}

export const actorName = (actor: string): string =>
  actor === "customer" ? "Customer" : actor === "system" ? "The website" : actor.split("@")[0];
