import {t} from "../../../../../packages/config/src/copy";
import { requireFeature, availableTools } from "../policy/capabilities";
import { usesCedari } from "./config";
import { mcpRequest, callUpstreamTool } from "./transport";
import { callCedariAdapter, cedariTools, type CommerceContext } from "./cedari";
import { z } from "zod";
import { upstreamData } from "./contract";
export { clearMcpMetadataCache, mcpMetadataCached } from "./transport";

export async function listArvivaTools(signal?: AbortSignal) {
  const result = upstreamData(z.object({ tools: z.array(z.object({ name: z.string(), inputSchema: z.record(z.string(), z.unknown()) }).passthrough()) }), await mcpRequest("tools/list", undefined, signal));
  if (!usesCedari()) return result;
  const names = new Set((result?.tools || []).map((tool: { name: string }) => tool.name));
  if (!["search_products", "get_products"].every(name => names.has(name))) throw new Error(t("backend.cbf729b5f2"));
  return { tools: availableTools(cedariTools).filter(tool=>tool.name!=="create_cart_link"||names.has("create_checkout")) };
}

export async function callArvivaTool(name: string, args: Record<string, unknown>, signal?: AbortSignal, context: CommerceContext = {}): Promise<unknown> {
  if(name === "create_cart_link") requireFeature("checkout");
  if(name === "compare_products") requireFeature("comparison");
  return callCedariAdapter(name, args, callUpstreamTool, signal, context);
}
