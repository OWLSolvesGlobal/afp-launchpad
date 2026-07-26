/**
 * Order pricing — pure functions, no React, no network.
 *
 * This lives outside the Checkout component for two reasons:
 *
 *  1. It can be unit tested. Money math embedded in a component can only be
 *     verified by rendering the whole page with a mocked Supabase client.
 *
 *  2. When a payment processor is wired in, the server must recompute the
 *     amount rather than trusting whatever the browser posts. Both sides need
 *     to agree exactly, so the rules belong in one place that both can import.
 *
 * All amounts are integer cents (BBD). Never use floats for money.
 */

export type Fulfillment = "delivery" | "pickup";

/** Orders at or above this subtotal ship free. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 30_000; // BBD $300

/** Flat island-wide delivery fee below the free-shipping threshold. */
export const FLAT_SHIPPING_CENTS = 1_500; // BBD $15

/** Barbados VAT. */
export const VAT_RATE = 0.175;

/** Store credit may cover at most this share of the subtotal. */
export const MAX_CREDIT_SHARE_OF_SUBTOTAL = 0.5;

export function shippingCents(
  subtotalCents: number,
  fulfillment: Fulfillment,
): number {
  if (fulfillment === "pickup") return 0;
  if (subtotalCents === 0) return 0;
  return subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
}

export function taxCents(subtotalCents: number): number {
  return Math.round(subtotalCents * VAT_RATE);
}

/**
 * The ceiling on store credit for this order: whichever is smaller, the
 * customer's balance or half the subtotal. Floored so we never redeem a
 * fraction of a cent.
 */
export function maxRedeemableCents(
  creditBalanceCents: number,
  subtotalCents: number,
): number {
  return Math.min(
    creditBalanceCents,
    Math.floor(subtotalCents * MAX_CREDIT_SHARE_OF_SUBTOTAL),
  );
}

/**
 * How much credit to actually apply, given free-text dollar input from the
 * customer. Clamped to [0, maxRedeemable]; unparseable input redeems nothing.
 */
export function redeemCents(
  redeemDollarsInput: string,
  creditBalanceCents: number,
  subtotalCents: number,
): number {
  const ceiling = maxRedeemableCents(creditBalanceCents, subtotalCents);
  const requested = Math.round((parseFloat(redeemDollarsInput) || 0) * 100);
  return Math.max(0, Math.min(ceiling, requested));
}

export interface OrderTotalInput {
  subtotalCents: number;
  fulfillment: Fulfillment;
  creditBalanceCents?: number;
  redeemDollarsInput?: string;
}

export interface OrderTotal {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  redeemedCents: number;
  totalCents: number;
}

/**
 * The authoritative order breakdown. This is the function a payment processor
 * integration should call server-side to decide what amount to charge.
 */
export function calculateOrderTotal({
  subtotalCents,
  fulfillment,
  creditBalanceCents = 0,
  redeemDollarsInput = "",
}: OrderTotalInput): OrderTotal {
  const shipping = shippingCents(subtotalCents, fulfillment);
  const tax = taxCents(subtotalCents);
  const redeemed = redeemCents(
    redeemDollarsInput,
    creditBalanceCents,
    subtotalCents,
  );

  return {
    subtotalCents,
    shippingCents: shipping,
    taxCents: tax,
    redeemedCents: redeemed,
    // Guard against a negative charge if the rules are ever loosened.
    totalCents: Math.max(0, subtotalCents + shipping + tax - redeemed),
  };
}
