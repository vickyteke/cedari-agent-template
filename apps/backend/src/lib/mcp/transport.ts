import { createHash, randomUUID } from "node:crypto";
import { CommerceError } from "./commerce";
import { mcpConnection, usesCedari } from "./config";
import { readMcpResponse } from "./response";
import { z } from "zod";
import { upstreamData } from "./contract";

const protocol = "2025-06-18";
// Deliberately server-side: no user credentials or conversation history are sent
// to MCP. Only the named catalog operation and its validated arguments travel.
const metadata = new Map<string, { expires: number; session: string | null; initialized?: Promise<void>; tools?: Promise<unknown> }>();
export function clearMcpMetadataCache() { metadata.clear(); }
export function mcpMetadataCached() {
  const entry = metadata.get(cacheKey());
  return !!entry?.tools && entry.expires > Date.now();
}
function cacheKey() {
  return createHash("sha256").update(`${mcpConnection().endpoint}:${mcpConnection().credential || ""}`).digest("hex");
}
async function metadataForCaller<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let cancel!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    cancel = () => reject(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
  });
  try { return await Promise.race([promise, aborted]); }
  finally { signal.removeEventListener("abort", cancel); }
}
export async function mcpRequest(method: string, params?: Record<string, unknown>, parentSignal?: AbortSignal) {
  parentSignal?.throwIfAborted();
  const { endpoint, credential } = mcpConnection();
  let url: URL;
  try { url = new URL(endpoint); }
  catch { throw new Error("MCP endpoint is invalid"); }
  if (url.username || url.password || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) throw new Error("MCP requires HTTPS outside localhost");
  if (!credential || credential.length > 16000 || /\s/.test(credential) || (!usesCedari() && credential.length < 32)) throw new Error("MCP service credential is not configured correctly");
  const key = cacheKey();
  let entry = metadata.get(key);
  if (!entry || entry.expires <= Date.now()) {
    if (metadata.size >= 8) metadata.delete(metadata.keys().next().value!);
    entry = { expires: Date.now() + 60000, session: null };
    metadata.set(key, entry);
  }
  const connection = entry;
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000);
  async function send(method: string, params?: unknown, notification = false, requestSignal = signal) {
    const id = randomUUID();
    const response = await fetch(endpoint, { method: "POST", redirect: "error", signal: requestSignal,
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": protocol, ...(connection.session ? { "Mcp-Session-Id": connection.session } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", ...(!notification ? { id } : {}), method, ...(params ? { params } : {}) }),
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      metadata.delete(key);
      if (usesCedari()) throw new CommerceError(response.status === 429 ? "Please try again shortly." : "The shopping service is temporarily unavailable.", response.status === 429 ? 429 : 503, response.status === 429 ? "rate_limited" : "upstream_unavailable");
      throw new Error(`Shopping MCP request failed (${response.status})`);
    }
    connection.session = response.headers.get("mcp-session-id") || connection.session;
    if (notification) { void response.body?.cancel().catch(() => {}); if (response.status !== 202) throw new Error("Invalid MCP notification response"); return; }
    try { return await readMcpResponse(response, id, requestSignal); }
    catch (error) { metadata.delete(key); throw error; }
  }
  // Only protocol metadata is shared. Every operation still sends the credential
  // and is authenticated/authorized by the MCP server. No product or auth result
  // survives a turn. Shared discovery has its own timeout, not a shopper's signal.
  if (!connection.initialized) connection.initialized = (async () => {
    const discoverySignal = AbortSignal.timeout(10000);
    const initialized = z.object({ protocolVersion: z.literal(protocol), capabilities: z.object({ tools: z.record(z.string(), z.unknown()) }) }).safeParse(await send("initialize", { protocolVersion: protocol, capabilities: {}, clientInfo: { name: "arviva-space-mobile-backend", version: "0.1.0" } }, false, discoverySignal));
    if (!initialized.success) throw new Error("Incompatible Shopping MCP server");
    await send("notifications/initialized", undefined, true, discoverySignal);
  })().catch(error => { metadata.delete(key); throw error; });
  await metadataForCaller(connection.initialized, signal);
  signal.throwIfAborted();
  if (method === "tools/list") {
    connection.tools ??= send(method, params, false, AbortSignal.timeout(10000)).catch(error => { metadata.delete(key); throw error; });
    return metadataForCaller(connection.tools, signal);
  }
  return send(method, params);
}

export async function callUpstreamTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  const result = upstreamData(z.object({
    isError: z.boolean().optional(), structuredContent: z.record(z.string(), z.unknown()).optional(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  }), await mcpRequest("tools/call", { name, arguments: args }, signal));
  if (result?.isError) {
    const detail = z.object({ code: z.string() }).safeParse(result.structuredContent?.error);
    const code = detail.success ? detail.data.code : "tool_failed";
    const status = result.structuredContent?.status;
    const known: Record<string, [number, string]> = {
      not_found: [404, "This piece is no longer in the current catalog. Please search again."],
      conflict: [409, "The selected pieces or checkout have changed. Please review your selection."],
      invalid_request: [400, "The shopping request is invalid. Please review your selection."],
      invalid_arguments: [400, "The shopping request is invalid. Please review your selection."],
      buyer_context_required: [409, "Checkout needs your network address. Please retry from the app."],
      out_of_stock: [409, "Some selected pieces are no longer available."],
      insufficient_inventory: [409, "The requested quantity is unavailable."],
      idempotency_conflict: [409, "This checkout attempt has different items. Please review your selection."],
      rate_limited: [429, "Please try again shortly."],
      allowance_exhausted: [429, "The shopping allowance has been reached. Please try again later."],
      quota_exceeded: [429, "The shopping allowance has been reached. Please try again later."],
      provider_checkout_not_found: [409, "This checkout session is no longer available. Please try again to prepare a fresh checkout."],
    };
    if (usesCedari()) {
      const recognized = Object.hasOwn(known, code);
      const safe: [number, string] = recognized ? known[code] : [503, "The shopping service could not complete this operation. Please try again."];
      throw new CommerceError(safe[1], safe[0], recognized ? code : "upstream_error");
    }
    throw new CommerceError(result.content?.find(c => c.type === "text")?.text || "Catalog tool failed", typeof status === "number" && [400, 404, 409, 429].includes(status) ? status : 503);
  }
  if (!result?.structuredContent) throw new Error("Shopping MCP did not return structured data");
  return result.structuredContent;
}
