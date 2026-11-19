import {t} from "../../../../../packages/config/src/copy";
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
  catch { throw new Error(t("backend.0fe186e926")); }
  if (url.username || url.password || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) throw new Error(t("backend.092ebd76e0"));
  if (!credential || credential.length > 16000 || /\s/.test(credential) || (!usesCedari() && credential.length < 32)) throw new Error(t("backend.51468a21df"));
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
      headers: { Authorization: t("dynamic.8523de2c94",{value0: String(credential)}), "Content-Type": "application/json", Accept: t("backend.cfb1f5add0"), "MCP-Protocol-Version": protocol, ...(connection.session ? { "Mcp-Session-Id": connection.session } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", ...(!notification ? { id } : {}), method, ...(params ? { params } : {}) }),
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      metadata.delete(key);
      if (usesCedari()) throw new CommerceError(response.status === 429 ? t("backend.b154014c9f") : t("backend.98e995feb4"), response.status === 429 ? 429 : 503, response.status === 429 ? "rate_limited" : "upstream_unavailable");
      throw new Error(t("dynamic.5ff593ab90",{value0: String(response.status)}));
    }
    connection.session = response.headers.get("mcp-session-id") || connection.session;
    if (notification) { void response.body?.cancel().catch(() => {}); if (response.status !== 202) throw new Error(t("backend.36f0185957")); return; }
    try { return await readMcpResponse(response, id, requestSignal); }
    catch (error) { metadata.delete(key); throw error; }
  }
  // Only protocol metadata is shared. Every operation still sends the credential
  // and is authenticated/authorized by the MCP server. No product or auth result
  // survives a turn. Shared discovery has its own timeout, not a shopper's signal.
  if (!connection.initialized) connection.initialized = (async () => {
    const discoverySignal = AbortSignal.timeout(10000);
    const initialized = z.object({ protocolVersion: z.literal(protocol), capabilities: z.object({ tools: z.record(z.string(), z.unknown()) }) }).safeParse(await send("initialize", { protocolVersion: protocol, capabilities: {}, clientInfo: { name: "cedari-agent-template", version: "0.1.0" } }, false, discoverySignal));
    if (!initialized.success) throw new Error(t("backend.2f6fd91e69"));
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
      not_found: [404, t("backend.1b9d877632")],
      conflict: [409, t("backend.e79f1c2d95")],
      invalid_request: [400, t("backend.d86c694dcd")],
      invalid_arguments: [400, t("backend.d86c694dcd")],
      buyer_context_required: [409, t("backend.ec840fed47")],
      out_of_stock: [409, t("backend.7439e7c630")],
      insufficient_inventory: [409, t("backend.ac156d33bc")],
      idempotency_conflict: [409, t("backend.61c9917666")],
      rate_limited: [429, t("backend.b154014c9f")],
      allowance_exhausted: [429, t("backend.75d73ebdb8")],
      quota_exceeded: [429, t("backend.75d73ebdb8")],
      provider_checkout_not_found: [409, t("backend.4980d4d567")],
    };
    if (usesCedari()) {
      const recognized = Object.hasOwn(known, code);
      const safe: [number, string] = recognized ? known[code] : [503, t("backend.29c64369f8")];
      throw new CommerceError(safe[1], safe[0], recognized ? code : "upstream_error");
    }
    throw new CommerceError(result.content?.find(c => c.type === "text")?.text || t("backend.bcfe494201"), typeof status === "number" && [400, 404, 409, 429].includes(status) ? status : 503);
  }
  if (!result?.structuredContent) throw new Error(t("backend.e278f29bf2"));
  return result.structuredContent;
}
