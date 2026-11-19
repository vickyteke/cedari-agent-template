import { t } from "../../../../../packages/config/src/copy";
import { boundedMap } from "../bounded-map";
import type { Product } from "../types";
import { requestedColors } from "../variant-colors";
import { z } from "zod";
import { callArvivaTool } from "../mcp/client";
import { cartSchema } from "../mcp/commerce";
import { mobileProducts } from "../mcp/products";
import { getStore } from "../stores";

export class CheckoutSelectionError extends Error {}
export type ChatCheckout = {
  idempotencyKey?: string;
  url: string;
  merchant: string;
  storeKey: string;
  items: {
    productId: string;
    title: string;
    imageUrl: string | null;
    variant: string | null;
    quantity: number;
    price: number;
    currency: string;
  }[];
};
export async function prepareChatCheckout(
  raw: unknown,
  knownIds: Set<string>,
  signal: AbortSignal,
  colors: string[] = [],
  currentProducts: Map<string, Product> = new Map(),
  invoke = callArvivaTool,
) {
  const { items } = cartSchema.parse(raw);
  if (new Set(items.map((item) => item.productId)).size !== items.length)
    throw new Error(t("backend.ffe324167d"));
  if (items.some((item) => !knownIds.has(item.productId)))
    throw new Error(t("backend.665044024b"));
  // Reuse only this turn's verified details. The merchant cart tool still
  // performs its own fresh inventory/variant validation before returning a URL.
  const missing = items.filter((item) => !currentProducts.has(item.productId));
  const batches = Array.from(
    { length: Math.ceil(missing.length / 8) },
    (_, index) =>
      missing.slice(index * 8, index * 8 + 8).map((item) => item.productId),
  );
  const fetched = (
    await boundedMap(batches, async (ids) =>
      mobileProducts(await invoke("get_products", { productIds: ids }, signal)),
    )
  ).flat();
  for (const product of fetched) currentProducts.set(product.id, product);
  const verified = currentProducts;
  const products = items.flatMap((item) =>
    verified.has(item.productId) ? [verified.get(item.productId)!] : [],
  );
  if (products.length !== items.length)
    throw new Error(t("backend.2faa100fb6"));
  if (
    colors.length &&
    products.some((product) => {
      // Shopify merchants use both "Default" and "Default Title" for an
      // unconfigured option. Neither is a color; use the product's identity.
      const identity =
        !product.variant_title?.trim() ||
        /^default(?: title)?$/i.test(product.variant_title.trim())
          ? product.title
          : product.variant_title;
      return !requestedColors(identity).some((color) => colors.includes(color));
    })
  )
    throw new CheckoutSelectionError(t("backend.086e160e8f"));
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const product = products.find((product) => product.id === item.productId)!;
    groups.set(product.store_key, [
      ...(groups.get(product.store_key) || []),
      item,
    ]);
  }
  const results = await boundedMap(
    [...groups],
    async ([storeKey, selection]): Promise<
      PromiseSettledResult<ChatCheckout>
    > => {
      try {
        const store = getStore(storeKey);
        const first = products.find(
          (product) => product.store_key === storeKey,
        )!;
        if (!store && !first.listing_id)
          throw new Error(t("backend.7c4347854c"));
        const result = z
          .object({
            cartUrl: z.string().url(),
            idempotencyKey: z.string().optional(),
          })
          .parse(
            await invoke("create_cart_link", { items: selection }, signal),
          );
        const url = new URL(result.cartUrl);
        if (
          url.protocol !== "https:" ||
          (!first.listing_id && url.hostname !== store!.storefrontDomain) ||
          url.username ||
          url.password ||
          url.port
        )
          throw new Error(t("backend.82b0170c14"));
        return {
          status: "fulfilled",
          value: {
            url: url.toString(),
            idempotencyKey: result.idempotencyKey,
            merchant: first.merchant_name || store?.name || storeKey,
            storeKey,
            items: selection.map((item) => {
              const product = products.find(
                (product) => product.id === item.productId,
              )!;
              return {
                productId: product.id,
                title: product.title,
                imageUrl: product.image_url,
                variant: product.variant_title,
                quantity: item.quantity,
                price: product.price,
                currency: product.currency,
              };
            }),
          },
        };
      } catch (reason) {
        return { status: "rejected", reason };
      }
    },
  );
  return {
    checkoutLinks: results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
    failedMerchants: results.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            products.find(
              (product) => product.store_key === [...groups.keys()][index],
            )?.merchant_name ||
              getStore([...groups.keys()][index])?.name ||
              "Merchant",
          ]
        : [],
    ),
  };
}
