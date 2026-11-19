vi.mock("@/lib/mobile/images", async original => ({ ...await original<typeof import("@/lib/mobile/images")>(), resolveChatPhotos: async (messages: { images?: { id: string }[] }[]) => { const index = messages.findLastIndex(message => !!message.images?.length); return { index, resolved: new Map((messages[index]?.images || []).map(photo => [photo.id, "https://private-storage.invalid/test-image.jpg?token=fixture"])) }; } }));
vi.mock("@/lib/mobile/admission", () => ({ reserveModelTokens: async () => true }));
vi.mock("@/lib/mcp/admission", () => ({ acquireLease: async () => "test-lease", releaseLease: async () => undefined }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), get: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/catalog", async original => ({ ...await original<typeof import("@/lib/catalog")>(), searchProducts: mocks.search, searchDistinctProducts: mocks.search, getProducts: mocks.get }));
vi.mock("@/lib/mobile/http", async original => ({ ...await original<typeof import("@/lib/mobile/http")>(), rateLimit: mocks.limit }));
import { POST as mcp } from "./fixtures/legacy-mcp-server";
import { shoppingReply, chatInput } from "@/lib/mobile/assistant";
const product = { id: "00000000-0000-4000-8000-000000000001", store_key: "hashtini", shopify_product_id: "10", shopify_variant_id: "20", handle: "rug", title: "Cotton Rug", description: "A blue cotton rug.", vendor: null, product_type: "Rugs", tags: [], price: 80, compare_at_price: null, currency: "USD", available: true, inventory_quantity: 3, image_url: null, product_url: "https://hashtini.com/products/rug", variant_title: "Blue", updated_at: "2026-10-23T00:00:00Z" };
function reply(content: string, productIds: string[] = []) { return { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify({ content, productIds }) }] }] }; }
function call(name: string, args: unknown) { return { status: "completed", output: [{ type: "reasoning", id: "reasoning-test", summary: [], encrypted_content: "opaque-test-context" }, { type: "function_call", name, arguments: JSON.stringify(args), call_id: "call-test", id: "fc-test" }] }; }
function transport(responses: unknown[]) {
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url === "https://api.openai.com/v1/responses") { requests.push(JSON.parse(init.body as string)); const result = responses.shift(); if (result instanceof Response) return result; if (!result) throw new Error("Unexpected AI call"); return Response.json(result); }
    return mcp(new Request(url, init));
  }));
  return requests;
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("MCP_INTERNAL_TOKEN", "test-internal-credential-at-least-32-characters"); vi.stubEnv("OPENAI_MODEL", "gpt-6.1-sol"); vi.stubEnv("OPENAI_API_KEY", "test-key-not-a-real-credential"); vi.stubEnv("ARVIVA_MCP_URL", "http://localhost/api/mcp"); mocks.limit.mockResolvedValue(true); mocks.search.mockImplementation(async input => input.store === "hashtini" ? [product] : []); mocks.get.mockResolvedValue([product]); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("conversational Arviva", () => {
  it.each([
    { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "not JSON" }] }] },
    { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ content: "A reply", productIds: ["not-a-product-id"] }) }] }] },
    { status: "completed", output: [{ type: "function_call", name: "get_products" }] },
  ])("classifies malformed provider output as an AI service failure", async response => {
    transport([response]);
    await expect(shoppingReply(chatInput.parse({ messages: [{ role: "user", content: "Show me curtains" }] }))).rejects.toMatchObject({ code: "invalid_model_response", status: 503 });
  });
  it("greets and asks a question without forcing a catalog search", async () => {
    const requests = transport([reply("Hi! What part of your home are you thinking about?")]);
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "user", content: "Hi Arviva" }] }));
    expect(result).toMatchObject({ mode: "assistant", products: [] }); expect(result.content).toContain("Hi!"); expect(mocks.search).not.toHaveBeenCalled(); expect(requests[0].store).toBe(false);
    expect(requests[0]).toMatchObject({ model: "gpt-6.1-sol", reasoning: { effort: "low" }, include: ["reasoning.encrypted_content"], max_output_tokens: 4096 });
  });
  it("executes an AI-selected search through MCP and grounds the final reply in its products", async () => {
    const requests = transport([call("search_products", { query: "blue rug", maxPrice: 100, limit: 30 }), reply("This blue cotton rug from Hashtini is $80, within your $100 budget. Would you prefer a different material?", [product.id])]);
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "user", content: "I need a rug under $100" }, { role: "assistant", content: "What color would you like?" }, { role: "user", content: "Blue" }] }));
    expect(result.mode).toBe("assistant"); expect(result.products[0].id).toBe(product.id);
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ query: "blue rug", maxPrice: 100 }));
    expect(JSON.stringify(requests[0].input)).toContain("under $100");
    expect(requests[1].input).toEqual(expect.arrayContaining([expect.objectContaining({ type: "reasoning", encrypted_content: "opaque-test-context" }), expect.objectContaining({ type: "function_call_output", call_id: "call-test" })]));
    expect(JSON.stringify(requests[1].input)).toContain("Cotton Rug");
  });
  it("supplies previously shown IDs so follow-ups can retrieve the right product", async () => {
    const requests = transport([call("get_products", { productIds: [product.id] }), reply("The Hashtini rug is cotton. Its listing doesn't confirm machine washing, so I'd check with the shop before purchasing.", [product.id])]);
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "assistant", content: "Here is a blue rug.", productIds: [product.id] }, { role: "user", content: "Is that one washable?" }] }));
    expect(JSON.stringify(requests[0].input)).toContain(product.id); expect(mocks.get).toHaveBeenCalledWith([product.id]); expect(result.products[0].title).toBe("Cotton Rug"); expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ timings: { reused_lookups: 1, model_calls: 2 } });
  });
  it("refreshes prior recommendations even when the model answers a follow-up without calling a tool", async () => {
    const requests = transport([reply("The first curtain is a cotton-linen blend.", [product.id])]);
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "assistant", content: "Here is a curtain.", productIds: [product.id] }, { role: "user", content: "What is the first one made from?" }] }));
    expect(mocks.get).toHaveBeenCalledWith([product.id]); expect(result.products[0].id).toBe(product.id); expect(JSON.stringify(requests[0].input)).toContain("Current catalog details");
  });
  it("refreshes larger historical selections while recommending at most five pieces", async () => {
    const selection = Array.from({ length: 12 }, (_, index) => ({ ...product, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, shopify_product_id: String(index + 1) }));
    mocks.get.mockImplementation(async ids => selection.filter(p => ids.includes(p.id)));
    transport([reply("Here are five pieces to focus on.", selection.slice(0, 5).map(p => p.id))]);
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "assistant", content: "Twelve options", productIds: selection.map(p => p.id) }, { role: "user", content: "What are these made from?" }] }));
    expect(result.products).toHaveLength(5);
    expect(mocks.get.mock.calls.map(([ids]) => ids.length)).toEqual([8, 4]);
  });
  it("fetches genuinely new results when asked for more and preserves the requested larger limit", async () => {
    const oldId = "00000000-0000-4000-8000-000000000099";
    const requests = transport([call("search_products", { query: "beige curtain", limit: 24 }), reply("Here are more beige options.", [product.id])]);
    const result = await shoppingReply(chatInput.parse({ seenProductIds: [oldId], messages: [{ role: "user", content: "Show me more beige curtains" }] }));
    expect(requests[0].tool_choice).toEqual({ type: "function", name: "search_products" });
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ query: "beige curtain", limit: 24, excludeProductIds: [oldId] }));
    expect(result.products[0].id).toBe(product.id);
  });
  it("caps fallback recommendations without changing their relevance order", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const selection = Array.from({ length: 12 }, (_, index) => ({ ...product, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, shopify_product_id: String(index + 1) }));
    mocks.search.mockImplementation(async input => input.store === "hashtini" ? selection : []);
    mocks.get.mockImplementation(async ids => selection.filter(p => ids.includes(p.id)));
    transport([]);
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "user", content: "Find blue rugs" }] }));
    expect(result.products.map(p => p.id)).toEqual(selection.slice(0, 5).map(p => p.id));
  });
  it("rejects provider output exceeding the five recommendation limit", async () => {
    const selection = Array.from({ length: 6 }, (_, index) => ({ ...product, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` }));
    mocks.get.mockResolvedValue(selection);
    const requests = transport([reply("Too many choices", selection.map(p => p.id))]);
    await expect(shoppingReply(chatInput.parse({ messages: [{ role: "assistant", content: "Earlier selection", productIds: selection.map(p => p.id) }, { role: "user", content: "Show all of these" }] }))).rejects.toMatchObject({ code: "invalid_model_response" });
    expect(requests[0].text).toMatchObject({ format: { schema: { properties: { productIds: { maxItems: 5 } } } } });
  });
  it("does not attach invented product cards", async () => {
    transport([reply("Here's another option.", ["00000000-0000-4000-8000-000000000099"])]);
    await expect(shoppingReply(chatInput.parse({ messages: [{ role: "user", content: "Show me a rug" }] }))).rejects.toMatchObject({ code: "ungrounded_product_reference" });
  });
  it("streams conversational text while validating final cards before returning", async () => {
    const text = '{"content":"Hello there!","productIds":[]}';
    const completed = reply("Hello there!");
    const events = [ { type: "response.output_text.delta", delta: text.slice(0, 17) }, { type: "response.output_text.delta", delta: text.slice(17) }, { type: "response.completed", response: completed } ];
    const requests = transport([new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } })]);
    const texts: string[] = [];
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "user", content: "Hello" }] }), { onText: text => texts.push(text) });
    expect(requests[0].stream).toBe(true);
    expect(texts[0]).toBe("Hello");
    expect(result.content).toBe("Hello there!");
    expect(result).toMatchObject({ timings: { model: "gpt-6.1-sol", model_calls: 1, tool_calls: 0 } });
  });
  it("reports authentication problems rather than silently falling back to canned chat", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    transport([new Response("Do not log provider bodies", { status: 401 })]);
    await expect(shoppingReply(chatInput.parse({ messages: [{ role: "user", content: "Show me rugs" }] }))).rejects.toMatchObject({ code: "invalid_api_key" });
    expect(mocks.search).not.toHaveBeenCalled(); expect(JSON.stringify(logged.mock.calls)).not.toContain("test-key-not-a-real-credential"); expect(JSON.stringify(logged.mock.calls)).not.toContain("provider bodies");
  });
  it("prepares a verified merchant checkout when the shopper requests it", async () => {
    const requests = transport([call("create_cart_link", { items: [{ productId: product.id, quantity: 2 }] }), reply("Your checkout for two blue rugs is ready. Review and pay at Hashtini.")]);
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "assistant", content: "Here is a blue rug.", productIds: [product.id] }, { role: "user", content: "Create a checkout for two of that rug" }] }));
    expect((requests[0].tools as { name: string }[]).map(tool => tool.name)).toContain("create_cart_link");
    expect(mocks.get).toHaveBeenCalledTimes(2); // one refresh plus independent fresh merchant checkout validation
    expect(result.checkoutLinks).toHaveLength(1); expect(result.checkoutLinks[0]).toMatchObject({ url: "https://hashtini.com/cart/20:2", merchant: "Hashtini", items: [{ productId: product.id, quantity: 2 }] });
  });
  it("creates the exact Wildflower variant checkout when grey describes the shopper's walls", async () => {
    const painting = { ...product, id: "6f7ea11d-9518-40f1-8c89-f63904faf5d4", store_key: "affirm_effect", title: "Moody Wildflower Meadow Framed Canvas Print, 12 x 16", variant_title: "White Wildflowers", shopify_variant_id: "67735735926938", product_url: "https://affirmeffect.com/products/moody-wildflower-meadow-framed-canvas-print-12-x-16?variant=67735735926938" };
    mocks.get.mockResolvedValue([painting]);
    transport([call("create_cart_link", { items: [{ productId: painting.id, quantity: 1 }] }), reply("Your checkout is ready. Review and pay at Affirm Effect.")]);
    const result = await shoppingReply(chatInput.parse({ messages: [
      { role: "user", content: "Show me some dark color wall paintings that will look good on grey walls" },
      { role: "assistant", content: "The Moody Wildflower print has white flowers against a dark background.", productIds: [painting.id] },
      { role: "user", content: "Alright let's add it to the cart" },
    ] }));
    expect(result.checkoutLinks).toHaveLength(1);
    expect(result.checkoutLinks[0]).toMatchObject({ url: "https://affirmeffect.com/cart/67735735926938:1", items: [{ productId: painting.id, variant: "White Wildflowers" }] });
  });
  it("sends attached photos as vision inputs and grounds complementary recommendations in MCP products", async () => {
    const requests = transport([call("search_products", { query: "rug OR lamp", limit: 12 }), reply("This blue cotton rug would complement the warm tones in your room.", [product.id])]);
    const result = await shoppingReply(chatInput.parse({ messages: [{ role: "user", content: "Suggest complementary pieces from different shops.", images: [{ id: "00000000-0000-4000-8000-000000000005", ownerId: "00000000-0000-4000-8000-000000000006" }] }] }));
    const transcript = requests[0].input as { content: unknown }[];
    expect(transcript[1].content).toEqual([{ type: "input_text", text: "Suggest complementary pieces from different shops." }, { type: "input_image", image_url: expect.stringContaining("https://private-storage.invalid/"), detail: "high" }]);
    expect(result.products[0].id).toBe(product.id);
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ store: "hashtini" }));
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ store: "affirm_effect" }));
  });
  it("still excludes charging or order-placement tools", async () => {
    const requests = transport([call("charge_card", {}), reply("You can review and pay on the merchant's website.")]);
    await shoppingReply(chatInput.parse({ messages: [{ role: "user", content: "Pay for me" }] }));
    expect((requests[0].tools as { name: string }[]).map(tool => tool.name)).not.toContain("charge_card");
    expect(mocks.get).not.toHaveBeenCalled(); expect(JSON.stringify(requests[1].input)).toContain("That action is not available");
  });
});
