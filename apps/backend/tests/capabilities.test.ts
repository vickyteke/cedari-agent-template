import { it, expect } from "vitest";
import { requireFeature, availableTools } from "../src/lib/policy/capabilities";
it("disabled_checkout_removes_tools_and_actions", () => {
  expect(() => requireFeature("checkout", { checkout: false })).toThrow();
  expect(
    availableTools([{ name: "get_products" }, { name: "create_cart_link" }], {
      checkout: false,
      comparison: false,
    }),
  ).toEqual([{ name: "get_products" }]);
});
it("disabled_comparison_clears_entry_points", () =>
  expect(
    availableTools([{ name: "compare_products" }], { comparison: false }),
  ).toEqual([]));
