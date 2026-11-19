import { describe, it, expect, vi } from "vitest";
import {
  resolveAssortment,
  allowsProduct,
  intersectSearch,
} from "../src/lib/policy/assortment";
import { callCedariAdapter } from "../src/lib/mcp/cedari";
import { defaultConfig } from "../../../packages/config/src/defaults";
const metadata = {
  categories: [
    { id: "Shoes", label: "Shoes" },
    { id: "Rugs", label: "Rugs" },
  ],
  merchants: [
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
  ],
};
const policy = {
  categories: { mode: "allowlist", ids: ["Shoes"] },
  merchants: { mode: "allowlist", ids: ["one"] },
} as const;
describe("assortment", () => {
  it("all_categories_keeps_non_home_products", () =>
    expect(
      allowsProduct(resolveAssortment(defaultConfig.assortment, metadata), {
        category: "Shoes",
        merchantId: "two",
      }),
    ).toBe(true));
  it("category_and_merchant_rules_intersect", () => {
    const p = resolveAssortment(JSON.parse(JSON.stringify(policy)), metadata);
    expect(allowsProduct(p, { category: "Shoes", merchantId: "one" })).toBe(
      true,
    );
    expect(allowsProduct(p, { category: "Shoes", merchantId: "two" })).toBe(
      false,
    );
    expect(allowsProduct(p, { category: "Rugs", merchantId: "one" })).toBe(
      false,
    );
  });
  it("single_merchant_cannot_be_overridden", () => {
    const p = resolveAssortment(JSON.parse(JSON.stringify(policy)), metadata);
    expect(() => intersectSearch(p, { store: "two" })).toThrow();
  });
  it("empty_or_unknown_selection_fails", () => {
    expect(() =>
      resolveAssortment(
        {
          categories: { mode: "allowlist", ids: [] },
          merchants: { mode: "all" },
        },
        metadata,
      ),
    ).toThrow();
    expect(() =>
      resolveAssortment(
        {
          categories: { mode: "all" },
          merchants: { mode: "allowlist", ids: ["missing"] },
        },
        metadata,
      ),
    ).toThrow();
  });
  it("direct_detail_and_saved_checkout_revalidate_policy", async () => {
    const invoke = vi.fn(async (...args: unknown[]) => {
      void args;
      return {
        listing: {
          id: "lst_shoe",
          title: "Boots",
          description: "",
          category: "Shoes",
          merchant: { id: "two", name: "Two" },
          variants: [
            {
              id: "var_one",
              name: "Brown",
              price: { amount_minor: 2000, currency: "USD" },
              inventory: { status: "in_stock", quantity: 5 },
              image_url: "https://example.com/boot.jpg",
              product_url: "https://example.com/boot",
            },
          ],
        },
      };
    });
    const p = resolveAssortment(JSON.parse(JSON.stringify(policy)), metadata);
    const id = "cedari:lst_shoe:var_one";
    const detail = await callCedariAdapter(
      "get_products",
      { productIds: [id] },
      invoke,
      undefined,
      {},
      p,
    );
    expect(detail && "products" in detail ? detail.products : []).toHaveLength(
      0,
    );
    await expect(
      callCedariAdapter(
        "create_cart_link",
        { items: [{ productId: id, quantity: 1 }] },
        invoke,
        undefined,
        { principalId: "user", idempotencyKey: "attempt" },
        p,
      ),
    ).rejects.toThrow();
    expect(
      invoke.mock.calls.every(
        (c) => c.length === 0 || c[0] !== "create_checkout",
      ),
    ).toBe(true);
  });
});
