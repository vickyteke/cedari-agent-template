import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/lib/catalog", () => ({ getProducts: mocks.database, searchProducts: mocks.database, searchDistinctProducts: mocks.database }));
vi.mock("@/lib/mcp/auth", async original => ({ ...await original<typeof import("@/lib/mcp/auth")>(), mobilePrincipal: async () => ({ id: "customer-a", anonymous: false }), mcpPrincipal: async () => ({ id: "fixture-agent", permissions: ["catalog:read", "checkout:create"], limit: 120 }) }));
vi.mock("@/lib/mobile/http", async original => ({ ...await original<typeof import("@/lib/mobile/http")>(), rateLimit: async () => true }));
vi.mock("@/lib/mcp/admission", () => ({ acquireLease: async () => "lease", releaseLease: async () => {} }));
vi.mock("@/lib/mobile/admission", () => ({ reserveModelTokens: async () => true, admitChat: async () => true }));
vi.mock("@/lib/mobile/images", async original => ({ ...await original<typeof import("@/lib/mobile/images")>(), resolveChatPhotos: async () => ({ index: -1, resolved: new Map() }) }));
import { callArvivaTool, clearMcpMetadataCache, listArvivaTools } from "@/lib/mcp/client";
import { cedariProductId } from "@/lib/mcp/identity";
import { mobileProducts } from "@/lib/mcp/products";
import { GET as catalog } from "@/app/api/mobile/catalog/route";
import { POST as publicMcp } from "./fixtures/legacy-mcp-server";
import { POST as checkout } from "@/app/api/mobile/checkout/route";
import { POST as mobileChat } from "@/app/api/mobile/chat/route";
import { shoppingReply, chatInput } from "@/lib/mobile/assistant";
import { prepareChatCheckout } from "@/lib/mobile/chat-checkout";
import { commerceContext } from "@/lib/mobile/commerce-context";

const id = cedariProductId("lst_curtain", "var_beige");
const item = () => ({
  id: "lst_curtain", title: "Linen curtains", description: "Linen panels", category: "Curtains",
  merchant: { id: "mrc_new_shop", name: "New independent shop" }, variant_count: 12,
  image_url: "https://cdn.example/black.jpg", product_url: "https://shop.example/products/curtain",
  variants: [
    { id: "var_black", name: "Black", available: true, image_url: "https://cdn.example/black.jpg", options: { Color: "Black" }, price: { amount_minor: 4516, currency: "USD" }, inventory: { status: "in_stock", quantity: 8 } },
    { id: "var_beige", name: "Beige", available: true, image_url: null, options: { Color: "Beige" }, price: { amount_minor: 5016, currency: "USD" }, inventory: { status: "in_stock", quantity: 3 } },
  ],
});
type Rpc = { id: string; method: string; params: { name: string; arguments: Record<string, unknown> } };
let requests: Rpc[];
let current: ReturnType<typeof item>;
let mutate: (name: string, args: Record<string, unknown>) => unknown;
function checkoutData(args: Record<string, unknown>, merchantId = current.merchant.id) {
  const lines = args.items as { listing_id: string; variant_id: string; quantity: number }[];
  const currency = current.variants.find(variant => variant.id === lines[0].variant_id)?.price.currency || "USD";
  return {
    checkout: { checkout_url: "https://checkout.shopify.com/session", merchant_id: merchantId, currency, idempotency_key: String(args.idempotency_key), purchase_mode: "hosted_checkout", provider: "shopify", lines },
    next_action: { type: "open_url", url: "https://checkout.shopify.com/session", requires_user_confirmation: true, purchase_mode: "hosted_checkout", provider: "shopify" },
  };
}
function transport(model: unknown[] = []) {
  const merchants = new Map<string, string>();
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url === "https://api.openai.com/v1/responses") return Response.json(model.shift());
    expect(url).toBe("https://cedari.example/mcp");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fixture-cedari-key");
    const rpc = JSON.parse(init.body as string) as Rpc;
    requests.push(rpc);
    let result: unknown;
    if (rpc.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (rpc.method === "initialize") result = { protocolVersion: "2025-06-18", capabilities: { tools: {} } };
    if (rpc.method === "tools/list") result = { tools: ["search_products", "get_products", "create_checkout"].map(name => ({ name, inputSchema: { type: "object" } })) };
    if (rpc.method === "tools/call") {
      const name = rpc.params.name;
      const override = mutate(name, rpc.params.arguments);
      if (override) {
        const listing = (override as { structuredContent?: { listing?: ReturnType<typeof item> } }).structuredContent?.listing;
        if (listing) merchants.set(listing.id, listing.merchant.id);
        result = override;
      }
      else {
        if (name === "get_products") merchants.set(current.id, current.merchant.id);
        const data = name === "search_products" ? { listings: [current], search_id: "srch_test_123" }
          : name === "get_products" ? { listing: current }
          : checkoutData(rpc.params.arguments, merchants.get((rpc.params.arguments.items as { listing_id: string }[])[0].listing_id));
        result = { content: [{ type: "text", text: "Compatibility summary is not the product data." }], structuredContent: data };
      }
    }
    return Response.json({ jsonrpc: "2.0", id: rpc.id, result });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const context = { principalId: "customer-a", idempotencyKey: "attempt-123456", buyerIp: "203.0.113.9" };
beforeEach(() => {
  clearMcpMetadataCache(); vi.clearAllMocks(); requests = []; current = item(); mutate = () => undefined;
  vi.stubEnv("CEDARI_MCP_URL", "https://cedari.example/mcp"); vi.stubEnv("CEDARI_API_KEY", "fixture-cedari-key"); vi.stubEnv("OPENAI_API_KEY", "");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); clearMcpMetadataCache(); });

describe("Cedari adapter over HTTP MCP", () => {
  it.each(["Toys", "Clothing", "Electronics", "Uncategorized", "Curtains accessories for phones"])("blocks non-home category %s across discovery, direct lookup and checkout", async category => {
    transport(); current.category = category;
    expect(mobileProducts(await callArvivaTool("search_products", {}))).toEqual([]);
    const lookup = await callArvivaTool("get_products", { productIds: [id] });
    expect(lookup).toMatchObject({ products: [], missingProductIds: [id] });
    expect(mobileProducts(await callArvivaTool("compare_products", { productIds: [id, cedariProductId("lst_curtain", "var_black")] }))).toEqual([]);
    await expect(callArvivaTool("create_cart_link", { items: [{ productId: id, quantity: 1 }] }, undefined, context)).rejects.toMatchObject({ status: 409 });
    expect(requests.some(rpc => rpc.params?.name === "create_checkout")).toBe(false);
  });
  it("does not send explicit non-home category searches upstream", async () => {
    transport();
    expect(await callArvivaTool("search_products", { category: "Toys" })).toMatchObject({ products: [] });
    expect(requests).toEqual([]);
  });

  it("scopes the All home query upstream before its result limit", async () => {
    transport();
    const result = mobileProducts(await callArvivaTool("search_products", { limit: 24, distinctProducts: true }));
    expect(result).toHaveLength(1);
    expect(requests.find(rpc => rpc.params?.name === "search_products")?.params.arguments).toMatchObject({ categories: expect.arrayContaining(["rugs", "curtains", "lighting"]), limit: 24 });
  });
  it("discovers upstream capabilities and exposes the app's adapted tools", async () => {
    transport();
    const tools = await listArvivaTools();
    expect(tools.tools.map((tool: { name: string }) => tool.name)).toEqual(["search_products", "get_products", "compare_products", "create_cart_link"]);
    expect(requests.map(rpc => rpc.method)).toEqual(["initialize", "notifications/initialized", "tools/list"]);
  });
  it("maps budget, stock, merchant and family exclusions to the new search schema", async () => {
    transport();
    const result = mobileProducts(await callArvivaTool("search_products", { query: "linen", maxPrice: 50.16, minPrice: 1.01, store: "hashtini", distinctProducts: true, excludeProductIds: [id] }));
    expect(requests.at(-1)?.params.arguments).toMatchObject({ query: "linen", min_price_minor: 101, max_price_minor: 5016, currency: "USD", in_stock: true, merchant_ids: ["mrc_arviva_hashtini"], exclude_listing_ids: ["lst_curtain"] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ listing_id: "lst_curtain", variant_id: "var_black", price: 45.16, merchant_name: "New independent shop", variant_count: 12 });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("refreshes one full listing for multiple selected variants, keeping exact images", async () => {
    transport();
    const result = mobileProducts(await callArvivaTool("get_products", { productIds: [id, cedariProductId("lst_curtain", "var_black")] }));
    expect(result.map(p => p.variant_id)).toEqual(["var_beige", "var_black"]);
    expect(result[0].image_url).toBeNull();
    expect(requests.filter(rpc => rpc.params?.name === "get_products")).toHaveLength(1);
  });
  it("preserves zero and three decimal currency exponents", async () => {
    transport(); current.variants[0].price = { amount_minor: 1234, currency: "JPY" }; current.variants[1].price = { amount_minor: 1234, currency: "KWD" };
    const result = mobileProducts(await callArvivaTool("get_products", { productIds: [id, cedariProductId("lst_curtain", "var_black")] }));
    expect(result.map(p => p.price)).toEqual([1.234, 1234]);
  });
  it("splits OR inspiration into bounded searches with the same hard constraints", async () => {
    transport();
    const result = mobileProducts(await callArvivaTool("search_products", { query: "rug OR curtain", maxPrice: 90, distinctProducts: true }));
    expect(result).toHaveLength(1);
    expect(requests.filter(rpc => rpc.params?.name === "search_products").map(rpc => rpc.params.arguments)).toEqual(expect.arrayContaining([expect.objectContaining({ query: "rug", max_price_minor: 9000 }), expect.objectContaining({ query: "curtain", max_price_minor: 9000 })]));
  });
  it("prepares exact checkout with a stable shopper-scoped key and real buyer context", async () => {
    transport(); const args = { items: [{ productId: id, quantity: 2 }] };
    const first = await callArvivaTool("create_cart_link", args, undefined, context);
    await callArvivaTool("create_cart_link", args, undefined, context);
    await callArvivaTool("create_cart_link", args, undefined, { ...context, principalId: "customer-b" });
    const calls = requests.filter(rpc => rpc.params?.name === "create_checkout");
    expect(calls[0].params.arguments).toMatchObject({ items: [{ listing_id: "lst_curtain", variant_id: "var_beige", quantity: 2 }], buyer_ip: context.buyerIp, purchase_mode: "auto" });
    expect(calls[0].params.arguments.idempotency_key).toBe(calls[1].params.arguments.idempotency_key);
    expect(calls[2].params.arguments.idempotency_key).not.toBe(calls[0].params.arguments.idempotency_key);
    expect(first).toMatchObject({ cartUrl: "https://checkout.shopify.com/session", merchant: "New independent shop" });
    expect(requests.some(rpc => rpc.params?.name === "create_cart_link")).toBe(false);
  });
  it("rejects invalid selections locally and preserves final inventory validation from Cedari", async () => {
    transport();
    await expect(callArvivaTool("create_cart_link", { items: [{ productId: "00000000-0000-4000-8000-000000000001", quantity: 1 }] }, undefined, context)).rejects.toMatchObject({ status: 409 });
    mutate = name => name === "create_checkout" ? { isError: true, structuredContent: { error: { code: "out_of_stock" } } } : undefined;
    await expect(callArvivaTool("create_cart_link", { items: [{ productId: id, quantity: 4 }] }, undefined, context)).rejects.toMatchObject({ status: 409 });
    current.variants[1].available = false;
    await expect(callArvivaTool("create_cart_link", { items: [{ productId: id, quantity: 1 }] }, undefined, context)).rejects.toMatchObject({ status: 409 });
    current.variants[1].available = true;
    await expect(callArvivaTool("create_cart_link", { items: [{ productId: id, quantity: 1 }] })).rejects.toMatchObject({ status: 400 });
    expect(requests.filter(rpc => rpc.params?.name === "create_checkout")).toHaveLength(2);
  });
  it("reports uncertain checkout failures without retrying or leaking upstream text", async () => {
    transport();
    mutate = name => name === "create_checkout" ? { isError: true, structuredContent: { error: { code: "provider_unavailable", message: "secret fixture-cedari-key" } }, content: [{ type: "text", text: "secret fixture-cedari-key" }] } : undefined;
    await expect(callArvivaTool("create_cart_link", { items: [{ productId: id, quantity: 1 }] }, undefined, context)).rejects.toThrow("could not complete");
    expect(requests.filter(rpc => rpc.params?.name === "create_checkout")).toHaveLength(1);
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("validates merchant handoff URLs from the authenticated response", async () => {
    transport();
    mutate = (name, args) => {
      if (name !== "create_checkout") return;
      const data = checkoutData(args); data.next_action.url = "javascript:alert(1)";
      return { structuredContent: data };
    };
    await expect(callArvivaTool("create_cart_link", { items: [{ productId: id, quantity: 1 }] }, undefined, context)).rejects.toThrow("could not be verified");
  });
  it("keeps the mobile catalog/checkout API while routing commerce only to Cedari", async () => {
    transport();
    const response = await catalog(new Request(`https://arviva.example/api/mobile/catalog?ids=${encodeURIComponent(id)}`));
    expect(response.status).toBe(200); expect((await response.json()).products[0]).toMatchObject({ id, variant_id: "var_beige", image_url: null });
    const ready = await checkout(new Request("https://arviva.example/api/mobile/checkout", { method: "POST", headers: { "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify({ items: [{ productId: id, quantity: 1 }], idempotencyKey: context.idempotencyKey }) }));
    expect(ready.status).toBe(200); expect(await ready.json()).toMatchObject({ url: "https://checkout.shopify.com/session", merchant: "New independent shop" });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("retains conversational AI and grounds chat in Cedari products", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fixture-model-key");
    transport([
      { status: "completed", output: [{ type: "function_call", name: "get_products", arguments: JSON.stringify({ productIds: [id] }), call_id: "call-one" }] },
      { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ content: "These beige curtains are $50.16 from New independent shop.", productIds: [id] }) }] }] },
    ]);
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "assistant", content: "A curtain", productIds: [id] }, { role: "user", content: "What does it cost?" }] }));
    expect(result).toMatchObject({ mode: "assistant", products: [{ id, price: 50.16, variant_id: "var_beige" }] });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("supports chat checkout at dynamic merchants without constructing a Shopify cart", async () => {
    transport();
    const invoke = (name: string, args: Record<string, unknown>, signal?: AbortSignal) => callArvivaTool(name, args, signal, context);
    const result = await prepareChatCheckout({ items: [{ productId: id, quantity: 1 }] }, new Set([id]), AbortSignal.timeout(1000), ["beige"], new Map(), invoke);
    expect(result.failedMerchants).toEqual([]);
    expect(result.checkoutLinks[0]).toMatchObject({ merchant: "New independent shop", items: [{ productId: id, variant: "Beige", imageUrl: null }] });
  });
  it("forwards validated buyer context and never invents a server address", () => {
    expect(commerceContext(new Request("https://arviva.example"), "a")).not.toHaveProperty("buyerIp");
    expect(commerceContext(new Request("https://arviva.example", { headers: { "x-forwarded-for": "not-an-ip" } }), "a")).not.toHaveProperty("buyerIp");
    expect(commerceContext(new Request("https://arviva.example", { headers: { "x-forwarded-for": "2001:db8::1, 10.0.0.1" } }), "a")).toHaveProperty("buyerIp", "2001:db8::1");
  });
  it("routes the public OAuth MCP facade through Cedari without touching the SQL catalog", async () => {
    transport();
    const response = await publicMcp(new Request("https://arviva.example/api/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: "request-one", method: "tools/call", params: { name: "get_products", arguments: { productIds: [id] } } }) }));
    const rpc = await response.json();
    expect(rpc.result.structuredContent.products[0]).toMatchObject({ id, listingId: "lst_curtain", variantId: "var_beige", storeName: "New independent shop" });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("preserves a successful chat checkout when another Cedari merchant fails", async () => {
    transport();
    const other = { ...item(), id: "lst_other", merchant: { id: "mrc_other_shop", name: "Other shop" } };
    const otherId = cedariProductId("lst_other", "var_beige");
    mutate = (name, args) => {
      if (name === "get_products" && args.listing_id === "lst_other") return { structuredContent: { listing: other } };
      if (name === "create_checkout" && (args.items as { listing_id: string }[])[0].listing_id === "lst_other") return { isError: true, structuredContent: { error: { code: "provider_unavailable" } } };
    };
    const invoke = (name: string, args: Record<string, unknown>, signal?: AbortSignal) => callArvivaTool(name, args, signal, context);
    const result = await prepareChatCheckout({ items: [{ productId: id, quantity: 1 }, { productId: otherId, quantity: 1 }] }, new Set([id, otherId]), AbortSignal.timeout(1000), [], new Map(), invoke);
    expect(result.checkoutLinks).toHaveLength(1);
    expect(result.checkoutLinks[0].merchant).toBe("New independent shop");
    expect(result.failedMerchants).toEqual(["Other shop"]);
  });
  it("interleaves inspiration categories instead of filling the limit from the first query", async () => {
    transport();
    mutate = (name, args) => name === "search_products" ? { structuredContent: { listings: Array.from({ length: 3 }, (_, index) => ({ ...item(), id: `lst_${args.query}_${index}`, title: String(args.query) })) } } : undefined;
    const result = mobileProducts(await callArvivaTool("search_products", { query: "rug OR curtain", distinctProducts: true, limit: 2 }));
    expect(result.map(product => product.title)).toEqual(["rug", "curtain"]);
  });
  it("gives matching merchants space in discovery", async () => {
    transport();
    mutate = name => name === "search_products" ? { structuredContent: { listings: [
      { ...item(), id: "lst_first" }, { ...item(), id: "lst_second" },
      { ...item(), id: "lst_other", merchant: { id: "new-merchant-id", name: "Other shop" } },
    ] } } : undefined;
    const result = mobileProducts(await callArvivaTool("search_products", { distinctProducts: true, limit: 2 }));
    expect(result.map(product => product.store_key)).toEqual(["mrc_new_shop", "new-merchant-id"]);
  });
  it("does not guess a prefix for newly connected merchant IDs", async () => {
    transport();
    await callArvivaTool("search_products", { store: "new-merchant-id" });
    expect(requests.at(-1)?.params.arguments.merchant_ids).toEqual(["new-merchant-id"]);
  });
  it("keeps valid lookups usable when older saved IDs share the same request", async () => {
    transport();
    const legacy = "00000000-0000-4000-8000-000000000001";
    const result = await callArvivaTool("get_products", { productIds: [legacy, id] }) as { missingProductIds: string[] };
    expect(mobileProducts(result)).toHaveLength(1);
    expect(result.missingProductIds).toEqual([legacy]);
    expect(requests.filter(request => request.params?.name === "get_products")).toHaveLength(1);
  });
  it.each([
    { minPrice: 0.29, maxPrice: 0.29, expected: { min_price_minor: 29, max_price_minor: 29 } },
    { minPrice: 1.0000000001, maxPrice: 1.0099999999, expected: { min_price_minor: 101, max_price_minor: 100 } },
    { minPrice: 1e-7, maxPrice: 1e-6, expected: { min_price_minor: 1, max_price_minor: 0 } },
  ])("enforces exact decimal budget bounds without floating-point tolerance", async ({ minPrice, maxPrice, expected }) => {
    transport();
    const result = await callArvivaTool("search_products", { minPrice, maxPrice });
    if (expected.min_price_minor > expected.max_price_minor) {
      expect(mobileProducts(result)).toEqual([]); expect(requests).toEqual([]);
    } else expect(requests.at(-1)?.params.arguments).toMatchObject(expected);
  });
  it("does not override currency inferred from a textual request when no numeric budget is supplied", async () => {
    transport();
    await callArvivaTool("search_products", { query: "curtains under €100" });
    expect(requests.at(-1)?.params.arguments).not.toHaveProperty("currency");
    await callArvivaTool("search_products", { maxPrice: 1.234, currency: "KWD" });
    expect(requests.at(-1)?.params.arguments).toMatchObject({ currency: "KWD", max_price_minor: 1234 });
  });
  it("browses normally for a whitespace-only query and rejects unsafe oversized budgets", async () => {
    transport();
    expect(mobileProducts(await callArvivaTool("search_products", { query: "  " }))).not.toHaveLength(0);
    expect(requests.at(-1)?.params.arguments).not.toHaveProperty("query");
    const previous = requests.length;
    await expect(callArvivaTool("search_products", { maxPrice: 1e20 })).rejects.toMatchObject({ status: 400 });
    expect(requests).toHaveLength(previous);
  });
  it("can resume an uncertain checkout even after the successful attempt reduced stock", async () => {
    transport();
    const selection = { items: [{ productId: id, quantity: 2 }] };
    await callArvivaTool("create_cart_link", selection, undefined, context);
    current.variants[1].available = false; current.variants[1].inventory.quantity = 0;
    expect(await callArvivaTool("create_cart_link", selection, undefined, context)).toMatchObject({ cartUrl: "https://checkout.shopify.com/session" });
    const attempts = requests.filter(request => request.params?.name === "create_checkout");
    expect(attempts).toHaveLength(2);
    expect(attempts[0].params.arguments.idempotency_key).toBe(attempts[1].params.arguments.idempotency_key);
  });
  it("reports a deleted listing as missing without blocking other saved selections", async () => {
    transport();
    const deleted = cedariProductId("lst_deleted", "var_deleted");
    mutate = (name, args) => name === "get_products" && args.listing_id === "lst_deleted" ? { isError: true, structuredContent: { error: { code: "not_found" } } } : undefined;
    const result = await callArvivaTool("get_products", { productIds: [deleted, id] }) as { missingProductIds: string[] };
    expect(mobileProducts(result)[0].id).toBe(id);
    expect(result.missingProductIds).toEqual([deleted]);
  });
  it("returns the explicit expired-session recovery code to mobile clients", async () => {
    transport();
    mutate = name => name === "create_checkout" ? { isError: true, structuredContent: { error: { code: "provider_checkout_not_found", message: "private-provider-details" } } } : undefined;
    const response = await checkout(new Request("https://arviva.example/api/mobile/checkout", { method: "POST", body: JSON.stringify({ items: [{ productId: id, quantity: 1 }], idempotencyKey: context.idempotencyKey }) }));
    expect(response.status).toBe(409);
    const result = await response.json();
    expect(result.code).toBe("provider_checkout_not_found");
    expect(JSON.stringify(result)).not.toContain("private-provider-details");
  });
  it("accepts a realistic large chat history with the longer Cedari IDs", async () => {
    transport();
    const seenProductIds = Array.from({ length: 500 }, (_, index) => cedariProductId(`lst_${String(index).padStart(32, "0")}`, `var_${String(index).padStart(32, "0")}`));
    const messages = Array.from({ length: 12 }, (_, index) => ({ role: index === 11 ? "user" : "assistant", content: index === 11 ? "Find curtains" : "A previous recommendation. ".repeat(60), ...(index === 11 ? {} : { productIds: seenProductIds.slice(index * 24, index * 24 + 24) }) }));
    const body = JSON.stringify({ seenProductIds, messages });
    expect(Buffer.byteLength(body)).toBeGreaterThan(64000);
    const response = await mobileChat(new Request("https://arviva.example/api/mobile/chat", { method: "POST", body }));
    expect(response.status).toBe(200);
    expect((await response.json()).mode).toBe("catalog");
  });
  it("still bounds oversized chat requests before any commerce access", async () => {
    transport();
    const response = await mobileChat(new Request("https://arviva.example/api/mobile/chat", { method: "POST", body: "x".repeat(192001) }));
    expect(response.status).toBe(413);
    expect(requests).toEqual([]);
  });
  it("lets external agents supply validated buyer context without forwarding their own server IP", async () => {
    transport();
    const request = (buyerIp: string) => new Request("https://arviva.example/api/mcp", { method: "POST", headers: { "x-forwarded-for": "203.0.113.20" }, body: JSON.stringify({ jsonrpc: "2.0", id: "request-one", method: "tools/call", params: { name: "create_cart_link", arguments: { items: [{ productId: id, quantity: 1 }], idempotencyKey: context.idempotencyKey, buyerIp } } }) });
    const invalid = await (await publicMcp(request("not-an-ip"))).json();
    expect(invalid.result.isError).toBe(true);
    expect(requests).toEqual([]);
    const response = await (await publicMcp(request("2001:db8::9"))).json();
    expect(response.result.isError).not.toBe(true);
    expect(requests.at(-1)?.params.arguments.buyer_ip).toBe("2001:db8::9");
  });
  it("evicts broken protocol state before the next operation without replaying the failed call", async () => {
    const fetcher = transport();
    await listArvivaTools();
    fetcher.mockImplementationOnce(async (_url, init) => Response.json({ jsonrpc: "2.0", id: JSON.parse(init.body as string).id, error: { message: "Do not expose this" } }));
    await expect(callArvivaTool("get_products", { productIds: [id] })).rejects.toThrow("protocol error");
    expect(requests.filter(request => request.method === "initialize")).toHaveLength(1);
    await callArvivaTool("get_products", { productIds: [id] });
    expect(requests.filter(request => request.method === "initialize")).toHaveLength(2);
  });
  it("preserves missing IDs in the mobile catalog response for saved-item notices", async () => {
    transport();
    const legacy = "00000000-0000-4000-8000-000000000001";
    const response = await catalog(new Request(`https://arviva.example/api/mobile/catalog?ids=${encodeURIComponent(`${id},${legacy}`)}`));
    const result = await response.json();
    expect(result.products).toHaveLength(1);
    expect(result.missingProductIds).toEqual([legacy]);
  });
  it("does not open another variant through a parent product link", async () => {
    transport();
    current.product_url = "https://shop.example/products/curtain?variant=black";
    const product = mobileProducts(await callArvivaTool("get_products", { productIds: [id] }))[0];
    expect(product.product_url).toBe("");
    expect(product.image_url).toBeNull();
  });
  it("bounds checkout concurrency across newly connected merchants while preserving every result", async () => {
    const fetcher = transport();
    mutate = (name, args) => name === "get_products" ? { structuredContent: { listing: { ...item(), id: String(args.listing_id), merchant: { id: `merchant-${args.listing_id}`, name: `Shop ${args.listing_id}` } } } } : undefined;
    const original = fetcher.getMockImplementation()!;
    let active = 0, peak = 0;
    fetcher.mockImplementation(async (url, init) => {
      if (JSON.parse(init.body as string).params?.name !== "create_checkout") return original(url, init);
      active++; peak = Math.max(peak, active);
      try { await new Promise(resolve => setTimeout(resolve, 5)); return await original(url, init); }
      finally { active--; }
    });
    const selected = ["lst_one", "lst_two", "lst_three", "lst_four"].map(listing => cedariProductId(listing, "var_beige"));
    const invoke = (name: string, args: Record<string, unknown>, signal?: AbortSignal) => callArvivaTool(name, args, signal, context);
    const result = await prepareChatCheckout({ items: selected.map(productId => ({ productId, quantity: 1 })) }, new Set(selected), AbortSignal.timeout(1000), [], new Map(), invoke);
    expect(result.failedMerchants).toEqual([]);
    expect(result.checkoutLinks).toHaveLength(4);
    expect(peak).toBe(2);
  });
  it.each(["constructor", "__proto__", "toString"])("treats an unknown error code %s as a safe service failure", async code => {
    transport();
    mutate = () => ({ isError: true, structuredContent: { error: { code, message: "private-details" } } });
    await expect(callArvivaTool("get_products", { productIds: [id] })).rejects.toMatchObject({ status: 503, code: "upstream_error" });
  });
  it("rejects malformed credentials before they can enter an HTTP error message", async () => {
    const fetcher = transport();
    vi.stubEnv("CEDARI_API_KEY", "private-token\nnot-a-valid-bearer");
    await expect(listArvivaTools()).rejects.toThrow(/^MCP service credential is not configured correctly$/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects invalid endpoint configuration without exposing its value", async () => {
    const fetcher = transport();
    vi.stubEnv("CEDARI_MCP_URL", "private-invalid-endpoint");
    await expect(listArvivaTools()).rejects.toThrow(/^MCP endpoint is invalid$/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["merchant", "currency", "attempt", "variant", "quantity", "confirmation"])("refuses a checkout with mismatched %s data", async field => {
    transport();
    mutate = (name, args) => {
      if (name !== "create_checkout") return;
      const data = checkoutData(args);
      if (field === "merchant") data.checkout.merchant_id = "mrc_other";
      if (field === "currency") data.checkout.currency = "EUR";
      if (field === "attempt") data.checkout.idempotency_key = "another-attempt";
      if (field === "variant") data.checkout.lines = [{ ...data.checkout.lines[0], variant_id: "var_black" }];
      if (field === "quantity") data.checkout.lines = [{ ...data.checkout.lines[0], quantity: 2 }];
      if (field === "confirmation") data.next_action.requires_user_confirmation = false;
      return { structuredContent: data };
    };
    await expect(callArvivaTool("create_cart_link", { items: [{ productId: id, quantity: 1 }] }, undefined, context)).rejects.toMatchObject({ status: 503, code: "upstream_invalid_response" });
  });
  it("distinguishes malformed upstream product data from invalid shopper input", async () => {
    transport();
    mutate = () => ({ structuredContent: { listings: [{ id: "broken-listing" }] } });
    const response = await catalog(new Request("https://arviva.example/api/mobile/catalog?query=curtain"));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("shopping service");
  });
  it("never presents a simulated checkout as a merchant purchase", async () => {
    transport();
    mutate = (name, args) => {
      if (name !== "create_checkout") return;
      const data = checkoutData(args); data.checkout.purchase_mode = "demo"; data.next_action.purchase_mode = "demo";
      return { structuredContent: data };
    };
    await expect(callArvivaTool("create_cart_link", { items: [{ productId: id, quantity: 1 }] }, undefined, context)).rejects.toMatchObject({ status: 409, code: "feature_disabled" });
  });
});
