import { secureUrl } from "./cedari.ts";

export function checkoutResult(raw: unknown): {
  url: string;
  merchant: string;
} {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("url" in raw) ||
    typeof raw.url !== "string" ||
    !("merchant" in raw) ||
    typeof raw.merchant !== "string"
  )
    throw new Error("Checkout could not be verified. Please try again.");
  const url = secureUrl(raw.url);
  if (!url || !raw.merchant.trim())
    throw new Error("Checkout could not be verified. Please try again.");
  return { url, merchant: raw.merchant };
}
