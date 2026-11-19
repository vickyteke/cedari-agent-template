import { t } from "../../../../../packages/config/src/copy";
import { z } from "zod";

export function cedariProductId(listingId: string, variantId: string) {
  return `cedari:${encodeURIComponent(listingId)}:${encodeURIComponent(variantId)}`;
}
export function cedariIdentity(id: string) {
  try {
    const parts = id.split(":");
    if (parts.length !== 3 || parts[0] !== "cedari") return null;
    const listing_id = decodeURIComponent(parts[1]),
      variant_id = decodeURIComponent(parts[2]);
    return listing_id &&
      variant_id &&
      listing_id.length <= 128 &&
      variant_id.length <= 128 &&
      cedariProductId(listing_id, variant_id) === id
      ? { listing_id, variant_id }
      : null;
  } catch {
    return null;
  }
}
// Old saved conversations remain readable; legacy UUIDs cannot authorize a
// Cedari checkout and are rejected by the upstream adapter before any mutation.
export const productIdSchema = z
  .string()
  .max(1024)
  .refine(
    (id) => z.uuid().safeParse(id).success || !!cedariIdentity(id),
    t("backend.1029f5b650"),
  );
