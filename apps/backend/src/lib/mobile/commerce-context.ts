import { isIP } from "node:net";
import type { CommerceContext } from "../mcp/cedari";

export function commerceContext(
  request: Request,
  principalId: string,
  idempotencyKey?: string,
): CommerceContext {
  // Same trusted proxy boundary as the existing mobile rate limiter. Production
  // ingress must replace x-forwarded-for; never expose this server directly.
  const candidate = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return {
    principalId,
    idempotencyKey,
    ...(candidate && isIP(candidate) ? { buyerIp: candidate } : {}),
  };
}
