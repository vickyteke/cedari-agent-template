import { createHash } from "node:crypto";
import { z } from "zod";
import type { Product } from "../types";
import { getStore } from "../stores";
import { productIdSchema } from "./identity";
import { upstreamData } from "./contract";

export function publicProduct(product: Product, origin: string) {
  return {
    id: product.id,
    storeKey: product.store_key,
    storeName:
      product.merchant_name ||
      getStore(product.store_key)?.name ||
      product.store_key,
    ...(product.listing_id
      ? {
          listingId: product.listing_id,
          variantId: product.variant_id,
          variantOptions: product.variant_options,
          variantCount: product.variant_count,
        }
      : {}),
    truncatedFields: [
      product.title.length > 240 ? "title" : null,
      (product.description?.length || 0) > 2000 ? "description" : null,
      product.tags.length > 32 || product.tags.some((tag) => tag.length > 80)
        ? "tags"
        : null,
    ].filter(Boolean),
    sourceProductId: product.shopify_product_id,
    sourceVariantId: product.shopify_variant_id,
    title: product.title.slice(0, 240),
    description: product.description?.slice(0, 2000) ?? null,
    vendor: product.vendor?.slice(0, 240) ?? null,
    productType: product.product_type?.slice(0, 240) ?? null,
    tags: product.tags.slice(0, 32).map((tag) => tag.slice(0, 80)),
    price: product.price,
    compareAtPrice: product.compare_at_price,
    currency: product.currency,
    available: product.available,
    inventoryQuantity: product.inventory_quantity,
    imageUrl: product.listing_id
      ? product.image_url
      : product.image_url
        ? `${origin}/api/product-image/${encodeURIComponent(product.id)}?v=${createHash("sha256").update(product.image_url).digest("hex").slice(0, 16)}`
        : null,
    productUrl: product.product_url,
    variantTitle: product.variant_title,
    updatedAt: product.updated_at,
  };
}
const productSchema = z.object({
  id: productIdSchema,
  storeKey: z.string(),
  storeName: z.string().optional(),
  sourceProductId: z.string(),
  sourceVariantId: z.string(),
  listingId: z.string().optional(),
  variantId: z.string().optional(),
  variantOptions: z.record(z.string(), z.string()).optional(),
  variantCount: z.number().int().optional(),
  title: z.string(),
  description: z.string().nullable(),
  vendor: z.string().nullable(),
  productType: z.string().nullable(),
  tags: z.array(z.string()),
  price: z.coerce.number().nonnegative(),
  compareAtPrice: z.coerce.number().nullable(),
  currency: z.string(),
  available: z.boolean(),
  inventoryQuantity: z.number().nullable(),
  imageUrl: z.string().url().nullable(),
  productUrl: z.union([z.string().url(), z.literal("")]),
  variantTitle: z.string().nullable(),
  updatedAt: z.string(),
});
export function mobileProducts(data: unknown): Product[] {
  return upstreamData(
    z.object({ products: z.array(productSchema) }),
    data,
  ).products.map((p) => ({
    id: p.id,
    store_key: p.storeKey,
    shopify_product_id: p.sourceProductId,
    shopify_variant_id: p.sourceVariantId,
    handle: p.productUrl
      ? new URL(p.productUrl).pathname.split("/").at(-1) || ""
      : "",
    title: p.title,
    description: p.description,
    vendor: p.vendor,
    product_type: p.productType,
    tags: p.tags,
    price: p.price,
    compare_at_price: p.compareAtPrice,
    currency: p.currency,
    available: p.available,
    inventory_quantity: p.inventoryQuantity,
    image_url: p.imageUrl,
    product_url: p.productUrl,
    variant_title: p.variantTitle,
    updated_at: p.updatedAt,
    ...(p.listingId
      ? {
          listing_id: p.listingId,
          variant_id: p.variantId,
          merchant_name: p.storeName,
          variant_options: p.variantOptions,
          variant_count: p.variantCount,
        }
      : {}),
  }));
}
