vi.mock("@/lib/mcp/admission", () => ({ acquireLease: async () => "test-lease", releaseLease: async () => undefined }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/catalog", async original => ({ ...await original<typeof import("@/lib/catalog")>(), getProducts: mocks.get }));
vi.mock("@/lib/mobile/http", async original => ({ ...await original<typeof import("@/lib/mobile/http")>(), rateLimit: mocks.limit }));
import { POST as mcp } from "./fixtures/legacy-mcp-server";
import { prepareChatCheckout } from "@/lib/mobile/chat-checkout";
const a = { id: "00000000-0000-4000-8000-000000000001", store_key: "hashtini", shopify_product_id: "10", shopify_variant_id: "20", handle: "rug", title: "Cotton Rug", description: null, vendor: null, product_type: "Rugs", tags: [], price: 80, compare_at_price: null, currency: "USD", available: true, inventory_quantity: 3, image_url: null, product_url: "https://hashtini.com/products/rug", variant_title: "Blue", updated_at: "2026-10-23T00:00:00Z" };
const b = { ...a, id: "00000000-0000-4000-8000-000000000002", store_key: "affirm_effect", shopify_variant_id: "30", product_url: "https://affirmeffect.com/products/print", title: "Framed Print" };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("MCP_INTERNAL_TOKEN", "test-internal-credential-at-least-32-characters"); mocks.limit.mockResolvedValue(true); vi.stubEnv("ARVIVA_MCP_URL", "http://localhost/api/mcp"); vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => mcp(new Request(url, init)))); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("chat checkout selections", () => {
  it("splits merchants and preserves the selected quantities", async () => {
    mocks.get.mockImplementation(async ids => [a, b].filter(product => ids.includes(product.id)));
    const result = await prepareChatCheckout({ items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }] }, new Set([a.id, b.id]), AbortSignal.timeout(1000));
    expect(result.failedMerchants).toEqual([]); expect(result.checkoutLinks).toHaveLength(2);
    expect(result.checkoutLinks.map(link => link.url)).toEqual(["https://hashtini.com/cart/20:2", "https://affirmeffect.com/cart/30:1"]);
    expect(result.checkoutLinks[0].items[0]).toMatchObject({ quantity: 2, title: "Cotton Rug", variant: "Blue" });
  });
  it("rejects invented selections before any product access", async () => {
    await expect(prepareChatCheckout({ items: [{ productId: b.id, quantity: 1 }] }, new Set([a.id]), AbortSignal.timeout(1000))).rejects.toThrow(/already shown/);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("keeps successful merchants when another merchant is unavailable", async () => {
    mocks.get.mockImplementation(async ids => [a, { ...b, available: false }].filter(product => ids.includes(product.id)));
    const result = await prepareChatCheckout({ items: [{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 1 }] }, new Set([a.id, b.id]), AbortSignal.timeout(1000));
    expect(result.checkoutLinks).toHaveLength(1); expect(result.checkoutLinks[0].merchant).toBe("Hashtini"); expect(result.failedMerchants).toEqual(["Affirm Effect"]);
  });
  it("blocks a green variant when the shopper requested beige", async () => {
    mocks.get.mockResolvedValue([{ ...a, variant_title: "Deep Green / 150 x 250 cm" }]);
    await expect(prepareChatCheckout({ items: [{ productId: a.id, quantity: 1 }] }, new Set([a.id]), AbortSignal.timeout(1000), ["beige"])).rejects.toThrow(/requested color/);
  });
  it.each(["Default", "Default Title", " default ", null])("checks the product name for generic variant label %s", async variant => {
    mocks.get.mockResolvedValue([{ ...b, title: "Pink Magnolia Blossom Watercolor Framed Metal Print, 8 x 8", variant_title: variant, shopify_variant_id: "67737395822746" }]);
    const result = await prepareChatCheckout({ items: [{ productId: b.id, quantity: 1 }] }, new Set([b.id]), AbortSignal.timeout(1000), ["pink"]);
    expect(result.failedMerchants).toEqual([]);
    expect(result.checkoutLinks[0].url).toBe("https://affirmeffect.com/cart/67737395822746:1");
    expect(result.checkoutLinks[0].items[0].title).toContain("Pink Magnolia");
  });
  it("still rejects a conflicting named color even when the product name contains pink", async () => {
    mocks.get.mockResolvedValue([{ ...b, title: "Pink Magnolia Print", variant_title: "Deep Green" }]);
    await expect(prepareChatCheckout({ items: [{ productId: b.id, quantity: 1 }] }, new Set([b.id]), AbortSignal.timeout(1000), ["pink"])).rejects.toThrow(/requested color/);
  });
  it("keeps the beige variant, image and cart ID together", async () => {
    mocks.get.mockResolvedValue([{ ...a, variant_title: "Beige / 150 x 250 cm", image_url: "https://cdn.shopify.com/beige.jpg" }]);
    const result = await prepareChatCheckout({ items: [{ productId: a.id, quantity: 1 }] }, new Set([a.id]), AbortSignal.timeout(1000), ["beige"]);
    expect(result.checkoutLinks[0].url).toBe("https://hashtini.com/cart/20:1");
    expect(result.checkoutLinks[0].items[0]).toMatchObject({productId: a.id, variant: "Beige / 150 x 250 cm"});
    expect(result.checkoutLinks[0].items[0].imageUrl).toContain("?v=");
  });

});
