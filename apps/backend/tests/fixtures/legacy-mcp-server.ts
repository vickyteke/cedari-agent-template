// Test-only legacy remote MCP fixture. Never exposed by an application route.
import { isIP } from "node:net";
import { callArvivaTool } from "@/lib/mcp/client";
import { usesCedari } from "@/lib/mcp/config";
import { productIdSchema } from "@/lib/mcp/identity";
import { commerceContext } from "@/lib/mobile/commerce-context";
import { acquireLease, releaseLease } from "@/lib/mcp/admission";
import { mcpPrincipal, accessResponse, AccessError } from "@/lib/mcp/auth";
import { z } from "zod";
import { getProducts, searchProducts } from "@/lib/catalog";
import { searchMobileCatalog } from "@/lib/mobile/catalog";
import { body, rateLimit } from "@/lib/mobile/http";
import { stores } from "@/lib/stores";
import { cartSchema, CommerceError, prepareCart } from "@/lib/mcp/commerce";
import { publicProduct } from "@/lib/mcp/products";

export const runtime = "nodejs";
const versions = ["2025-06-18", "2025-03-26", "2025-11-25"];
const rpcSchema = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number()]).optional(), method: z.string(), params: z.record(z.string(), z.unknown()).optional() });
const ids = z.object({ productIds: z.array(productIdSchema).min(1).max(8) }).strict();
const searchSchema = z.object({ query: z.string().max(180).optional(), store: z.string().max(128).refine(key => usesCedari() || stores.some(store => store.key === key)).optional(), category: z.string().max(80).optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), minPrice: z.number().nonnegative().optional(), maxPrice: z.number().nonnegative().optional(), availableOnly: z.boolean().optional(), limit: z.number().int().min(1).max(30).optional(), excludeProductIds: z.array(productIdSchema).max(500).optional(), distinctProducts: z.boolean().optional() }).strict().refine(input => input.minPrice == null || input.maxPrice == null || input.minPrice <= input.maxPrice, "Invalid price range");
const checkoutSchema = cartSchema.extend({ idempotencyKey: z.string().min(8).max(160).optional(), buyerIp: z.string().trim().max(45).refine(value => isIP(value) !== 0, "Invalid buyer IP").optional() });
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const oauth = [{ type: "oauth2", scopes: ["email"] }];
const tools = [
  { name: "search_products", title: "Search the home catalog", description: "Search physical home and decor products. Apply the shopper's constraints. Set distinctProducts=true for discovery across merchants without repeated variants. Identify the source store for every recommendation.", securitySchemes: oauth, annotations,
    inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 180 }, store: { type: "string", description: "Merchant ID from returned products, or a legacy shop key." }, category: { type: "string", maxLength: 80 }, currency: { type: "string", pattern: "^[A-Z]{3}$", description: "Currency for explicit budgets; unqualified dollars default to USD." }, minPrice: { type: "number", minimum: 0 }, maxPrice: { type: "number", minimum: 0 }, availableOnly: { type: "boolean", default: true }, limit: { type: "integer", minimum: 1, maximum: 30 }, excludeProductIds: { type: "array", maxItems: 500, items: { type: "string", maxLength: 1024 }, description: "Previously shown variant IDs to skip. With distinctProducts, skips all variants of those products to retrieve new options." }, distinctProducts: { type: "boolean", default: false } }, additionalProperties: false } },
  { name: "get_products", title: "Get product details", description: "Retrieve one to eight exact catalog variant IDs. Use before displaying saved items or preparing a purchase. IDs come from search_products; never invent IDs.", securitySchemes: oauth, annotations,
    inputSchema: { type: "object", required: ["productIds"], properties: { productIds: { type: "array", minItems: 1, maxItems: 8, items: { type: "string", maxLength: 1024 } } }, additionalProperties: false } },
  { name: "compare_products", title: "Compare products", description: "Retrieve two to eight exact catalog variants for comparison. Report each source merchant and currency separately.", securitySchemes: oauth, annotations,
    inputSchema: { type: "object", required: ["productIds"], properties: { productIds: { type: "array", minItems: 2, maxItems: 8, items: { type: "string", maxLength: 1024 } } }, additionalProperties: false } },
  { name: "create_cart_link", title: "Prepare merchant checkout", description: "Prepare an external merchant checkout URL for one merchant, checking catalog availability and quantity. This does not charge, order or reserve inventory. Split mixed-merchant selections into separate calls. The merchant confirms final price and inventory.", securitySchemes: oauth, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: { type: "object", required: ["items", "idempotencyKey"], properties: { buyerIp: { type: "string", maxLength: 45, description: "Actual buyer IPv4 or IPv6 address. Server-side agents must forward buyer context instead of their own server address." }, idempotencyKey: { type: "string", minLength: 8, maxLength: 160, description: "Stable attempt key; reuse when retrying the same checkout." }, items: { type: "array", minItems: 1, maxItems: 25, items: { type: "object", required: ["productId", "quantity"], properties: { productId: { type: "string", maxLength: 1024 }, quantity: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false } } }, additionalProperties: false } },
];
function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new Set(["https://arviva.space", "https://www.arviva.space", ...(process.env.MCP_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)]);
  return !origin || allowed.has(origin);
}
function headers(request: Request) {
  return { "Cache-Control": "no-store", "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Protocol-Version", Vary: "Origin", ...(request.headers.get("origin") ? { "Access-Control-Allow-Origin": request.headers.get("origin")! } : {}) };
}
function response(request: Request, data: unknown, status = 200) { return Response.json(data, { status, headers: headers(request) }); }
function rpcError(request: Request, id: string | number | null, code: number, message: string, status = 200) { return response(request, { jsonrpc: "2.0", id, error: { code, message } }, status); }
function toolResult(data: unknown) {
  const text = JSON.stringify(data);
  if (Buffer.byteLength(text, "utf8") > 400000) throw new Error("Tool response exceeds safe size");
  return { content: [{ type: "text", text }], structuredContent: data };
}

export async function POST(request: Request) {
  if (request.signal.aborted) return new Response(null, { status: 499 });
  if (!allowedOrigin(request)) return new Response("Origin not allowed", { status: 403 });
  let principal;
  try { principal = await mcpPrincipal(request); } catch (error) { const denied = accessResponse(error, true); return new Response(denied.body, { status: denied.status, headers: { ...headers(request), ...Object.fromEntries(denied.headers) } }); }
  if (!await rateLimit(request, principal.id === "arviva-backend" ? "mcp:customer" : "mcp:agent", principal.limit, principal.id).catch(() => false)) return response(request, { error: "Please try again shortly." }, 429);
  const version = request.headers.get("mcp-protocol-version");
  if (version && !versions.includes(version)) return rpcError(request, null, -32600, "Unsupported protocol version", 400);
  let raw: unknown;
  try {
    raw = await body(request);
  } catch { return rpcError(request, null, -32700, "Parse error", 400); }
  const parsed = rpcSchema.safeParse(raw);
  if (!parsed.success) return rpcError(request, null, -32600, "Invalid Request", 400);
  const rpc = parsed.data;
  if (rpc.id === undefined) {
    if (!rpc.method.startsWith("notifications/")) return new Response(null, { status: 400 });
    return new Response(null, { status: 202, headers: headers(request) });
  }
  const result = (value: unknown) => response(request, { jsonrpc: "2.0", id: rpc.id, result: value });
  if (rpc.method === "initialize") return result({ protocolVersion: versions.includes(String(rpc.params?.protocolVersion)) ? rpc.params!.protocolVersion : versions[0], capabilities: { tools: {} }, serverInfo: { name: "arviva", version: "1.1.0" }, instructions: "Search Arviva's public home catalog. Identify source merchants and currencies. Prices and availability can change. Cart links only prepare merchant-hosted carts; shoppers review and pay there. Never combine merchants into one cart. No customer profiles, conversations or payment credentials are available through this server." });
  if (rpc.method === "ping") return result({});
  if (rpc.method === "tools/list") return result({ tools: tools.filter(tool => principal.permissions.includes(tool.name === "create_cart_link" ? "checkout:create" : "catalog:read")) });
  if (rpc.method !== "tools/call") return rpcError(request, rpc.id, -32601, "Method not found");
  const name = rpc.params?.name;
  if (!tools.some(tool => tool.name === name)) return rpcError(request, rpc.id, -32602, "Unknown tool");
  if (!principal.permissions.includes(name === "create_cart_link" ? "checkout:create" : "catalog:read")) return accessResponse(new AccessError(403, "This integration lacks permission for this tool"), true);
  const args = rpc.params?.arguments ?? {};
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://www.arviva.space";
  const lease = await acquireLease(principal.id).catch(() => null);
  if (!lease) return response(request, { error: "The shopping service is busy. Please try again shortly." }, 429);
  try {
    request.signal.throwIfAborted();
    if (usesCedari()) {
      let input: Record<string, unknown>;
      let idempotencyKey: string | undefined;
      let buyerIp: string | undefined;
      if (name === "search_products") input = searchSchema.parse(args);
      else if (name === "get_products" || name === "compare_products") input = ids.parse(args);
      else {
        const parsed = checkoutSchema.required({ idempotencyKey: true }).parse(args);
        idempotencyKey = parsed.idempotencyKey;
        buyerIp = parsed.buyerIp;
        input = { items: parsed.items };
      }
      const context = commerceContext(request, principal.id, idempotencyKey);
      if (buyerIp) context.buyerIp = buyerIp;
      return result(toolResult(await callArvivaTool(String(name), input, request.signal, context)));
    }
    if (name === "search_products") {
      const input = searchSchema.parse(args);
      const { distinctProducts, ...filters } = input;
      delete filters.currency;
      const products = await (distinctProducts ? searchMobileCatalog(filters) : searchProducts(filters));
      return result(toolResult({ products: products.map(p => publicProduct(p, origin)), count: products.length }));
    }
    if (name === "get_products" || name === "compare_products") {
      const input = (name === "compare_products" ? ids.extend({ productIds: z.array(productIdSchema).min(2).max(8) }) : ids).parse(args);
      const products = await getProducts(input.productIds);
      const ordered = input.productIds.flatMap(id => products.find(p => p.id === id) || []);
      return result(toolResult({ products: ordered.map(p => publicProduct(p, origin)), missingProductIds: input.productIds.filter(id => !products.some(p => p.id === id)) }));
    }
    return result(toolResult(await prepareCart({ items: checkoutSchema.parse(args).items })));
  } catch (error) {
    const message = error instanceof z.ZodError ? "Invalid tool arguments" : error instanceof CommerceError ? error.message : "The catalog service is temporarily unavailable.";
    return result({ ...toolResult({ error: message, status: error instanceof z.ZodError ? 400 : error instanceof CommerceError ? error.status : 503 }), isError: true });
  } finally { await releaseLease(lease).catch(() => {}); }
}
export async function GET() { return new Response("Use JSON-RPC POST. This server does not offer a standalone SSE stream.", { status: 405, headers: { Allow: "POST, OPTIONS" } }); }
export async function DELETE() { return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } }); }
export async function OPTIONS(request: Request) {
  if (!allowedOrigin(request)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { ...headers(request), "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, authorization, mcp-protocol-version, mcp-session-id" } });
}
