/**
 * Brand constants — the single source for voice and contact details.
 * The Sheet's Config tab owns runtime config (announcement bar, payment
 * flags); this file owns what is baked into the build.
 */

/** WhatsApp number in wa.me format (country code + number, digits only). */
export const WA_NUMBER = "12462520102";

/** The same number formatted for display. */
export const PHONE_DISPLAY = "+1 (246) 252-0102";

/** Base WhatsApp chat link. */
export const WA = `https://wa.me/${WA_NUMBER}`;

/** WhatsApp link with a prefilled message. */
export const waLink = (text: string) => `${WA}?text=${encodeURIComponent(text)}`;

/** The brand tagline — one voice everywhere. */
export const TAGLINE = "For the life you live";

export const INSTAGRAM_URL = "https://instagram.com/alofitnesspro";
export const INSTAGRAM_HANDLE = "@alofitnesspro";
