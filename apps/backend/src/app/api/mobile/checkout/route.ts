import { commerceContext } from "@/lib/mobile/commerce-context";
import { mobilePrincipal, accessResponse } from "@/lib/mcp/auth";
import { z } from "zod";
import { callArvivaTool } from "@/lib/mcp/client";
import { cartSchema, CommerceError } from "@/lib/mcp/commerce";
import { upstreamData } from "@/lib/mcp/contract";
import { body, BodyReadError, json, preflight, rateLimit } from "@/lib/mobile/http";
export const OPTIONS = preflight;
export async function POST(request: Request) {
  let principal;
  try { principal = await mobilePrincipal(request); } catch (error) { const denied = accessResponse(error); return json(await denied.json(), denied.status); }
  try {
    if (!await rateLimit(request, "checkout", 30, principal.id)) return json({ error: "Please try again shortly." }, 429);
    const { idempotencyKey, ...input } = cartSchema.extend({ idempotencyKey: z.string().min(8).max(160).optional() }).parse(await body(request));
    const result = upstreamData(z.object({ cartUrl: z.string().url(), merchant: z.string() }), await callArvivaTool("create_cart_link", input, request.signal, commerceContext(request, principal.id, idempotencyKey)));
    return json({ url: result.cartUrl, merchant: result.merchant });
  } catch (error) {
    if (error instanceof BodyReadError) return json({ error: "The bag request could not be read. Please review your selection." }, error.status);
    return json({ error: error instanceof z.ZodError ? "Invalid bag." : error instanceof CommerceError ? error.message : "Checkout could not be prepared. Please try again.", ...(error instanceof CommerceError && error.code ? { code: error.code } : {}) }, error instanceof z.ZodError ? 400 : error instanceof CommerceError ? error.status : 503);
  }
}
