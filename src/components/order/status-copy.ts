import type { OrderStatus } from "@/lib/orders-core";

export type Stage = "pay" | "upload";

/** Which checkout step (0-based) an order is at. */
export function stepFor(status: OrderStatus, stage: Stage): number {
  if (status === "reserved") return stage === "upload" ? 2 : 1;
  return 3;
}

/** Plain-words heading and explanation for each of the seven statuses. */
export const STATUS_COPY: Record<OrderStatus, { title: string; body: (ref: string, pickup: boolean) => string }> = {
  reserved: {
    title: "Waiting for your payment.",
    body: () => "Your items are held for you. Pay, then send your proof of payment before the time runs out.",
  },
  proof_uploaded: {
    title: "We're checking your payment.",
    body: () =>
      "Thank you. We have your proof and are checking it against our bank record. Your items stay held while we do. We'll message you once your order is confirmed.",
  },
  paid: {
    title: "Payment confirmed.",
    body: (_ref, pickup) =>
      pickup
        ? "We've confirmed your payment and are getting your order ready. We'll message you to arrange pickup."
        : "We've confirmed your payment and are getting your order ready. We'll message you to arrange delivery.",
  },
  delivered: {
    title: "Order complete.",
    body: (_ref, pickup) => (pickup ? "Your order has been collected. Thank you." : "Your order has been delivered. Thank you."),
  },
  expired: {
    title: "This order ran out of time.",
    body: (ref) =>
      `The 60 minutes passed without proof of payment, so the items went back on sale. If you have already paid, message us on WhatsApp with your reference ${ref} and we'll sort it out.`,
  },
  rejected: {
    title: "We couldn't confirm your payment.",
    body: (ref) =>
      `We checked and could not match a payment to this order, so the items went back on sale. If you believe this is a mistake, message us on WhatsApp with your reference ${ref}.`,
  },
  cancelled: {
    title: "Order cancelled.",
    body: () => "This order was cancelled and the items are back on sale. Nothing further is needed from you.",
  },
};
