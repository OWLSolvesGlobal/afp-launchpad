import type { Fulfillment } from "@/lib/pricing";

export interface DetailFields {
  name: string;
  phone: string;
  email: string;
  address: string;
}
export type DetailErrors = Partial<Record<keyof DetailFields, string>>;

/**
 * The same checks the server makes (parseOrderInput), run in the browser so a
 * mistake is caught before anything is sent. The server's answer is final.
 */
export function validateDetails(f: DetailFields, fulfillment: Fulfillment): DetailErrors {
  const errors: DetailErrors = {};
  if (f.name.trim().length < 2) errors.name = "Please enter your name.";
  const digits = f.phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15 || !/^[+\d][\d\s().-]*$/.test(f.phone.trim())) {
    errors.phone = "Please enter a phone number we can reach you on.";
  }
  if (!f.email.trim()) errors.email = "Please enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) {
    errors.email = "That email address doesn't look right.";
  }
  if (fulfillment === "delivery" && f.address.trim().length < 8) {
    errors.address = "Please enter the delivery address.";
  }
  return errors;
}
