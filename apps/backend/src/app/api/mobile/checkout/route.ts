import {t} from "../../../../../../../packages/config/src/copy";
import { agentConfig } from "../../../../../../../packages/config/src/public";
import { commerceContext } from "@/lib/mobile/commerce-context";
import { mobilePrincipal, accessResponse } from "@/lib/mcp/auth";
import { z } from "zod";
import { callArvivaTool } from "@/lib/mcp/client";
import { cartSchema, CommerceError } from "@/lib/mcp/commerce";
import { upstreamData } from "@/lib/mcp/contract";
import { body, BodyReadError, json, preflight, rateLimit } from "@/lib/mobile/http";
export const OPTIONS = preflight;
export async function POST(request: Request) {
  if (!agentConfig.features.checkout) return Response.json({ error: t("backend.3e747eb226") }, { status: 403 });
  let principal;
  try { principal = await mobilePrincipal(request); } catch (error) { const denied = accessResponse(error); return json(await denied.json(), denied.status); }
  try {
    if (!await rateLimit(request, "checkout", 30, principal.id)) return json({ error: t("backend.b154014c9f") }, 429);
    const { idempotencyKey, ...input } = cartSchema.extend({ idempotencyKey: z.string().min(8).max(160).optional() }).parse(await body(request));
    const result = upstreamData(z.object({ cartUrl: z.string().url(), merchant: z.string() }), await callArvivaTool("create_cart_link", input, request.signal, commerceContext(request, principal.id, idempotencyKey)));
    return json({ url: result.cartUrl, merchant: result.merchant });
  } catch (error) {
    if (error instanceof BodyReadError) return json({ error: t("backend.06d6971781") }, error.status);
    return json({ error: error instanceof z.ZodError ? "Invalid bag." : error instanceof CommerceError ? error.message : t("backend.8dd18b364e"), ...(error instanceof CommerceError && error.code ? { code: error.code } : {}) }, error instanceof z.ZodError ? 400 : error instanceof CommerceError ? error.status : 503);
  }
}
