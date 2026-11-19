import type { Product } from "./model.ts";

// Shared wire mapping for the server adapter and mobile catalog responses.
// Search previews contain at most three variants; detail must use get_products.
export type CedariMoney = { amount_minor: number; currency: string };
export type CedariVariant = {
  id: string;
  name: string;
  price: CedariMoney;
  options?: Record<string, string>;
  image_url?: string | null;
  product_url?: string | null;
  available?: boolean;
  inventory: {
    status: "in_stock" | "low_stock" | "out_of_stock";
    quantity: number | null;
    precision?: "exact" | "availability" | "unknown";
  };
};
export type CedariListing = {
  id: string;
  title: string;
  description: string;
  category: string;
  merchant: { id: string; name: string };
  variants: CedariVariant[];
  image_url?: string | null;
  product_url?: string | null;
  variant_count?: number;
  updated_at?: string;
};

export function productId(listingId: string, variantId: string): string {
  if (!listingId || !variantId)
    throw new Error("A listing and exact variant are required.");
  return `cedari:${encodeURIComponent(listingId)}:${encodeURIComponent(variantId)}`;
}

export function productIdentity(id: string): {
  listing_id: string;
  variant_id: string;
} {
  const parts = id.split(":");
  if (parts.length !== 3 || parts[0] !== "cedari")
    throw new Error("Please find this piece again in the current catalog.");
  const listing_id = decodeURIComponent(parts[1]),
    variant_id = decodeURIComponent(parts[2]);
  if (
    !listing_id ||
    !variant_id ||
    listing_id.length > 128 ||
    variant_id.length > 128 ||
    productId(listing_id, variant_id) !== id
  )
    throw new Error("Invalid product selection.");
  return { listing_id, variant_id };
}

export function currencyDigits(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency))
    throw new Error("Invalid product currency.");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits!;
}

export function majorAmount(money: CedariMoney): number {
  if (!Number.isSafeInteger(money.amount_minor) || money.amount_minor < 0)
    throw new Error("Invalid product price.");
  return money.amount_minor / 10 ** currencyDigits(money.currency);
}

export function secureUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function productUrl(
  variantUrl: string | null | undefined,
  parentUrl: string | null | undefined,
  variantCount: number,
) {
  const exact = secureUrl(variantUrl);
  if (exact) return exact;
  const parent = secureUrl(parentUrl);
  if (
    parent &&
    variantCount > 1 &&
    [...new URL(parent).searchParams.keys()].some((key) =>
      ["variant", "variant_id", "sku"].includes(key.toLowerCase()),
    )
  )
    return null;
  return parent;
}

export function listingProducts(listing: CedariListing): Product[] {
  return listing.variants.map((variant) => ({
    id: productId(listing.id, variant.id),
    listing_id: listing.id,
    variant_id: variant.id,
    store_key: listing.merchant.id,
    merchant_name: listing.merchant.name,
    title: listing.title,
    description: listing.description || null,
    price: majorAmount(variant.price),
    currency: variant.price.currency,
    available:
      variant.available !== false &&
      ["in_stock", "low_stock"].includes(variant.inventory.status) &&
      (variant.inventory.quantity === null || variant.inventory.quantity > 0),
    // A missing variant photo must never become a different color's hero image.
    image_url: secureUrl(variant.image_url),
    product_url: productUrl(
      variant.product_url,
      listing.product_url,
      listing.variant_count ?? listing.variants.length,
    ),
    variant_title: variant.name || null,
    product_type: listing.category || null,
    variant_options: variant.options || {},
    variant_count: listing.variant_count ?? listing.variants.length,
    updated_at: listing.updated_at || "",
  }));
}

export function catalogProducts(
  payload: {
    products?: Product[];
    listings?: CedariListing[];
    listing?: CedariListing;
  },
  selectedIds?: string[],
): Product[] {
  let products: Product[];
  if (Array.isArray(payload.listings))
    products = payload.listings.flatMap(listingProducts);
  else if (payload.listing) products = listingProducts(payload.listing);
  else if (Array.isArray(payload.products)) products = payload.products;
  else throw new Error("The catalog returned an unexpected response.");
  if (!selectedIds) return products;
  const selected = new Set(selectedIds);
  return products.filter((product) => selected.has(product.id));
}
