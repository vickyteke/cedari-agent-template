import { t } from "../../../../../packages/config/src/copy";
import {
  allowsProduct,
  configuredAssortment,
  intersectSearch,
  type ResolvedAssortment,
} from "../policy/assortment";
import { agentConfig } from "../../../../../packages/config/src/public";
import { createHash } from "node:crypto";
import { z } from "zod";
import { boundedMap } from "../bounded-map";
import type { Product } from "../types";
import { cartSchema, CommerceError } from "./commerce";
import { cedariIdentity, cedariProductId, productIdSchema } from "./identity";
import { publicProduct } from "./products";
import { upstreamData } from "./contract";

export type CommerceContext = {
  buyerIp?: string;
  principalId?: string;
  idempotencyKey?: string;
};
type Invoke = (
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<unknown>;
const money = z.object({
  amount_minor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
const variant = z.object({
  id: z.string().min(1).max(128),
  name: z.string(),
  price: money,
  compare_at_price: money.nullable().optional(),
  image_url: z.string().nullable().optional(),
  product_url: z.string().nullable().optional(),
  available: z.boolean().optional(),
  options: z.record(z.string(), z.string()).default({}),
  inventory: z.object({
    status: z.enum(["in_stock", "low_stock", "out_of_stock"]),
    quantity: z.number().int().nullable(),
    precision: z.string().optional(),
  }),
});
const listing = z.object({
  id: z.string().min(1).max(128),
  title: z.string(),
  description: z.string().default(""),
  category: z.string(),
  merchant: z.object({ id: z.string(), name: z.string() }),
  variants: z.array(variant),
  brand: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  product_url: z.string().nullable().optional(),
  updated_at: z.string().default(""),
  variant_count: z.number().int().optional(),
});
const searchSchema = z
  .object({
    query: z.string().max(180).optional(),
    category: z.string().max(80).optional(),
    store: z.string().max(128).optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    availableOnly: z.boolean().default(true),
    limit: z.number().int().min(1).max(30).default(24),
    excludeProductIds: z.array(productIdSchema).max(500).default([]),
    distinctProducts: z.boolean().default(false),
  })
  .strict()
  .refine(
    (input) =>
      input.minPrice == null ||
      input.maxPrice == null ||
      input.minPrice <= input.maxPrice,
    t("backend.fe55f9e7e3"),
  );
const idsSchema = z
  .object({ productIds: z.array(productIdSchema).min(1).max(8) })
  .strict();

export function secureCommerceUrl(value?: string | null) {
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
function digits(currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits!;
}
function amount(value: z.infer<typeof money>) {
  return value.amount_minor / 10 ** digits(value.currency);
}
function productUrl(
  variantUrl: string | null | undefined,
  parentUrl: string | null | undefined,
  variantCount: number,
) {
  const exact = secureCommerceUrl(variantUrl);
  if (exact) return exact;
  const parent = secureCommerceUrl(parentUrl);
  // Search parent links can already point to a different preview variant.
  // Keep a generic product link, but never reuse another variant's selection.
  if (
    parent &&
    variantCount > 1 &&
    [...new URL(parent).searchParams.keys()].some((key) =>
      ["variant", "variant_id", "sku"].includes(key.toLowerCase()),
    )
  )
    return "";
  return parent || "";
}
function budgetMinor(value: number, currency: string, roundUp: boolean) {
  // Decimal arithmetic preserves hard budget boundaries, including fractions of
  // a minor unit. Floating-point epsilons can otherwise admit an over-budget item.
  const [significand, exponent = "0"] = value.toString().split("e");
  const [whole, fraction = ""] = significand.split(".");
  const numerator = BigInt(whole + fraction);
  const shift = digits(currency) + Number(exponent) - fraction.length;
  const divisor = shift < 0 ? 10n ** BigInt(-shift) : 1n;
  const scaled = shift >= 0 ? numerator * 10n ** BigInt(shift) : numerator;
  const result =
    scaled / divisor + (roundUp && scaled % divisor !== 0n ? 1n : 0n);
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CommerceError(t("backend.57008dc548"), 400);
  return Number(result);
}
function productsFromListing(data: z.infer<typeof listing>): Product[] {
  return data.variants.map((v) => ({
    id: cedariProductId(data.id, v.id),
    listing_id: data.id,
    variant_id: v.id,
    merchant_name: data.merchant.name,
    store_key: data.merchant.id,
    shopify_product_id: "",
    shopify_variant_id: "",
    handle: "",
    title: data.title,
    description: data.description,
    product_type: data.category,
    vendor: data.brand || null,
    tags: data.tags,
    price: amount(v.price),
    currency: v.price.currency,
    compare_at_price: v.compare_at_price ? amount(v.compare_at_price) : null,
    available:
      v.available !== false &&
      ["in_stock", "low_stock"].includes(v.inventory.status) &&
      (v.inventory.quantity === null || v.inventory.quantity > 0),
    inventory_quantity: v.inventory.quantity,
    image_url: secureCommerceUrl(v.image_url),
    product_url: productUrl(
      v.product_url,
      data.product_url,
      data.variant_count ?? data.variants.length,
    ),
    variant_title: v.name,
    variant_options: v.options,
    variant_count: data.variant_count ?? data.variants.length,
    updated_at: data.updated_at,
  }));
}
function identity(id: string) {
  const value = cedariIdentity(id);
  if (!value) throw new CommerceError(t("backend.3c86a059dc"), 409);
  return value;
}
async function getSelected(
  ids: string[],
  invoke: Invoke,
  policy: ResolvedAssortment,
  signal?: AbortSignal,
) {
  const identities = ids.flatMap((id) => cedariIdentity(id) || []);
  const groups = await boundedMap(
    [...new Set(identities.map((id) => id.listing_id))],
    async (listing_id) => {
      let raw: unknown;
      try {
        raw = await invoke("get_products", { listing_id }, signal);
      } catch (error) {
        if (error instanceof CommerceError && error.code === "not_found")
          return [];
        throw error;
      }
      const data = upstreamData(z.object({ listing }), raw);
      if (data.listing.id !== listing_id)
        throw new Error(t("backend.c19d8a8950"));
      const products = allowsProduct(policy, {
        category: data.listing.category,
        merchantId: data.listing.merchant.id,
      })
        ? productsFromListing(data.listing)
        : [];
      return products;
    },
  );
  const all = new Map(groups.flat().map((product) => [product.id, product]));
  return ids.flatMap((id) => all.get(id) || []);
}
function diverseProducts(
  groups: Product[][],
  limit: number,
  distinct: boolean,
) {
  const products: Product[] = [];
  const seen = new Set<string>();
  for (
    let index = 0;
    groups.some((group) => index < group.length) && products.length < limit;
    index++
  ) {
    for (const group of groups) {
      const product = group[index];
      if (!product) continue;
      const key = distinct ? product.listing_id! : product.id;
      if (!seen.has(key)) {
        seen.add(key);
        products.push(product);
      }
      if (products.length === limit) break;
    }
  }
  return products;
}
function wire(products: Product[]) {
  return products.map((product) =>
    publicProduct(product, process.env.APP_URL || "https://example.invalid"),
  );
}

export async function callCedariAdapter(
  name: string,
  args: Record<string, unknown>,
  invoke: Invoke,
  signal?: AbortSignal,
  context: CommerceContext = {},
  policy: ResolvedAssortment = configuredAssortment(),
) {
  if (name === "search_products") {
    const input = searchSchema.parse(args);
    const currency =
      input.currency ||
      (input.minPrice !== undefined || input.maxPrice !== undefined
        ? agentConfig.discovery.currency
        : undefined);
    const filters = {
      ...intersectSearch(policy, input),
      ...(currency ? { currency } : {}),
      in_stock: input.availableOnly,
      limit: input.limit,
      ...(input.minPrice !== undefined
        ? { min_price_minor: budgetMinor(input.minPrice, currency!, true) }
        : {}),
      ...(input.maxPrice !== undefined
        ? { max_price_minor: budgetMinor(input.maxPrice, currency!, false) }
        : {}),
      exclude_listing_ids: [
        ...new Set(
          input.excludeProductIds.flatMap(
            (id) => cedariIdentity(id)?.listing_id || [],
          ),
        ),
      ],
    };
    // The old agent uses OR for inspiration. Cedari accepts keyword queries, so
    // preserve those alternatives as bounded searches with identical constraints.
    if (
      "min_price_minor" in filters &&
      "max_price_minor" in filters &&
      filters.min_price_minor! > filters.max_price_minor!
    )
      return { products: [], count: 0 };
    const alternatives = [
      ...new Set(
        input.query
          ?.split(/\s+OR\s+/i)
          .map((query) => query.trim())
          .filter(Boolean) || [],
      ),
    ];
    const queries = alternatives.length ? alternatives : [undefined];
    if (queries.length > 4)
      throw new CommerceError(t("backend.b8957f42da"), 400);
    const groups = await boundedMap(queries, async (query) => {
      const data = upstreamData(
        z.object({ listings: z.array(listing) }),
        await invoke(
          "search_products",
          { ...filters, ...(query ? { query } : {}) },
          signal,
        ),
      );
      const products = data.listings
        .filter((item) =>
          allowsProduct(policy, {
            category: item.category,
            merchantId: item.merchant.id,
          }),
        )
        .flatMap((item) => {
          const products = productsFromListing(item);
          return input.distinctProducts ? products.slice(0, 1) : products;
        });
      const merchants = new Map<string, Product[]>();
      for (const product of products)
        merchants.set(product.store_key, [
          ...(merchants.get(product.store_key) || []),
          product,
        ]);
      return diverseProducts(
        [...merchants.values()],
        input.limit,
        input.distinctProducts,
      );
    });
    const products = diverseProducts(
      groups,
      input.limit,
      input.distinctProducts,
    );
    return { products: wire(products), count: products.length };
  }
  if (name === "get_products" || name === "compare_products") {
    const input = idsSchema.parse(args);
    if (name === "compare_products" && input.productIds.length < 2)
      throw new CommerceError(t("backend.3ae0651159"), 400);
    const products = await getSelected(
      input.productIds,
      invoke,
      policy,
      signal,
    );
    return {
      products: wire(products),
      missingProductIds: input.productIds.filter(
        (id) => !products.some((product) => product.id === id),
      ),
    };
  }
  if (name === "create_cart_link") {
    const { items } = cartSchema.parse(args);
    if (items.length > 25)
      throw new CommerceError(t("backend.8b59cac306"), 400);
    if (new Set(items.map((item) => item.productId)).size !== items.length)
      throw new CommerceError(t("backend.aee916eed9"), 400);
    items.forEach((item) => identity(item.productId));
    if (!context.idempotencyKey || !context.principalId)
      throw new CommerceError(t("backend.81126e67b6"), 400);
    const products = await getSelected(
      items.map((item) => item.productId),
      invoke,
      policy,
      signal,
    );
    if (products.length !== items.length)
      throw new CommerceError(t("backend.7439e7c630"), 409);
    if (new Set(products.map((product) => product.store_key)).size !== 1)
      throw new CommerceError(t("backend.121eaff940"), 400);
    if (new Set(products.map((product) => product.currency)).size !== 1)
      throw new CommerceError(t("backend.9bee96e0d5"), 400);
    // Cedari resolves the stable idempotency key before checking inventory for
    // new sessions. Local stock gating would prevent recovering an existing
    // successful checkout after it reduced inventory and its response was lost.
    const idempotency_key = `${agentConfig.id}_${createHash("sha256")
      .update(
        JSON.stringify([
          context.principalId,
          context.idempotencyKey,
          products[0].store_key,
        ]),
      )
      .digest("hex")}`;
    const selected = items
      .map((item) => ({ ...identity(item.productId), quantity: item.quantity }))
      .sort((a, b) =>
        `${a.listing_id}:${a.variant_id}`.localeCompare(
          `${b.listing_id}:${b.variant_id}`,
        ),
      );
    const mode = z.enum(["demo", "hosted_checkout"]);
    const result = upstreamData(
      z.object({
        checkout: z.object({
          checkout_url: z.string(),
          merchant_id: z.string(),
          currency: z.string(),
          idempotency_key: z.string(),
          purchase_mode: mode,
          provider: z.string(),
          lines: z
            .array(
              z.object({
                listing_id: z.string(),
                variant_id: z.string(),
                quantity: z.number().int().positive(),
              }),
            )
            .min(1)
            .max(25),
        }),
        next_action: z.object({
          type: z.literal("open_url"),
          url: z.string(),
          requires_user_confirmation: z.literal(true),
          purchase_mode: mode,
          provider: z.string(),
        }),
      }),
      await invoke(
        "create_checkout",
        {
          items: selected,
          idempotency_key,
          purchase_mode: "auto",
          ...(context.buyerIp ? { buyer_ip: context.buyerIp } : {}),
        },
        signal,
      ),
    );
    const url = secureCommerceUrl(result.next_action.url);
    const checkout = result.checkout;
    const expected = new Map(
      selected.map((item) => [
        cedariProductId(item.listing_id, item.variant_id),
        item.quantity,
      ]),
    );
    const returned = new Map(
      checkout.lines.map((item) => [
        cedariProductId(item.listing_id, item.variant_id),
        item.quantity,
      ]),
    );
    if (
      !url ||
      secureCommerceUrl(checkout.checkout_url) !== url ||
      checkout.merchant_id !== products[0].store_key ||
      checkout.currency !== products[0].currency ||
      checkout.idempotency_key !== idempotency_key ||
      checkout.purchase_mode !== result.next_action.purchase_mode ||
      checkout.provider !== result.next_action.provider ||
      returned.size !== checkout.lines.length ||
      returned.size !== expected.size ||
      [...expected].some(([id, quantity]) => returned.get(id) !== quantity)
    )
      throw new CommerceError(
        t("backend.472eb76002"),
        503,
        "upstream_invalid_response",
      );
    if (checkout.purchase_mode !== "hosted_checkout")
      throw new CommerceError(t("backend.a70e8d0559"), 409, "feature_disabled");
    return {
      cartUrl: url,
      idempotencyKey: context.idempotencyKey,
      storeKey: products[0].store_key,
      merchant: products[0].merchant_name || products[0].store_key,
    };
  }
  throw new CommerceError(t("backend.8ad175ffc7"), 400);
}

// The app agent keeps its established selection interface. These schemas are
// local adapters, not a claim that Cedari exposes compare_products/cart links.
const idArray = {
  type: "array",
  minItems: 1,
  maxItems: 8,
  items: { type: "string", maxLength: 1024 },
};
export const cedariTools = [
  {
    name: "search_products",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", maxLength: 180 },
        category: { type: "string" },
        store: { type: "string" },
        currency: { type: "string", description: t("backend.3ab3889705") },
        minPrice: { type: "number", minimum: 0 },
        maxPrice: { type: "number", minimum: 0 },
        availableOnly: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 30 },
        distinctProducts: { type: "boolean" },
        excludeProductIds: {
          type: "array",
          maxItems: 500,
          items: { type: "string" },
        },
      },
    },
  },
  {
    name: "get_products",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["productIds"],
      properties: { productIds: idArray },
    },
  },
  {
    name: "compare_products",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["productIds"],
      properties: { productIds: { ...idArray, minItems: 2 } },
    },
  },
  {
    name: "create_cart_link",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          minItems: 1,
          maxItems: 50,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["productId", "quantity"],
            properties: {
              productId: { type: "string", maxLength: 1024 },
              quantity: { type: "integer", minimum: 1, maximum: 20 },
            },
          },
        },
      },
    },
  },
];
