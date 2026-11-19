import {t} from "../../../../../../../packages/config/src/copy";
import { mobilePrincipal, accessResponse } from "@/lib/mcp/auth";
import { z } from "zod";
import { productIdSchema } from "@/lib/mcp/identity";
import { CommerceError } from "@/lib/mcp/commerce";
import { upstreamData } from "@/lib/mcp/contract";
import { callArvivaTool } from "@/lib/mcp/client";
import { mobileProducts } from "@/lib/mcp/products";
import { json, preflight, rateLimit } from "@/lib/mobile/http";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  let principal;
  try { principal = await mobilePrincipal(request); } catch (error) { const denied = accessResponse(error); return json(await denied.json(), denied.status); }
  try {
    if (!await rateLimit(request, "catalog", 120, principal.id)) return json({ error: t("backend.b154014c9f") }, 429);
    const params = new URL(request.url).searchParams;
    if (params.has("ids")) {
      const ids = z.array(productIdSchema).max(8).parse(params.get("ids")!.split(","));
      const result = await callArvivaTool("get_products", { productIds: ids }, request.signal);
      const { missingProductIds } = upstreamData(z.object({ missingProductIds: z.array(productIdSchema).default([]) }), result);
      return json({ products: mobileProducts(result), missingProductIds });
    }
    const input = z.object({ query: z.string().max(180).optional(), store: z.string().max(60).optional(), category: z.string().max(80).optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), maxPrice: z.coerce.number().nonnegative().optional(), limit: z.coerce.number().int().min(1).max(30).default(24) }).parse(Object.fromEntries(params));
    return json({ products: mobileProducts(await callArvivaTool("search_products", { ...input, distinctProducts: true }, request.signal)) });
  } catch (error) {
    return json({ error: error instanceof z.ZodError ? t("backend.4977c9bbca") : error instanceof CommerceError ? error.message : t("backend.1ab7aa5950") }, error instanceof z.ZodError ? 400 : error instanceof CommerceError ? error.status : 503);
  }
}
