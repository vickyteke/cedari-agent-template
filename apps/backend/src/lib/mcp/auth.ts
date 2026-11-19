import {t} from "../../../../../packages/config/src/copy";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export const authIssuer = () => `${process.env.SUPABASE_URL?.replace(/\/$/, "")}/auth/v1`;
export class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function bearer(request: Request) {
  const match = /^Bearer ([^\s,]+)$/i.exec(request.headers.get("authorization") || "");
  if (!match || match[1].length > 16000) throw new AccessError(401, t("backend.0fcfb12dfa"));
  return match[1];
}
let keySet: ReturnType<typeof createRemoteJWKSet> | undefined;
let keyIssuer: string | undefined;
export async function verifiedClaims(token: string): Promise<JWTPayload> {
  try {
    const issuer = authIssuer();
    if (!keySet || keyIssuer !== issuer) {
      keySet = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { timeoutDuration: 3000, cooldownDuration: 60000, cacheMaxAge: 600000 });
      keyIssuer = issuer;
    }
    // Asymmetric signatures only: never fall back to the remote Auth user endpoint.
    const { payload: claims } = await jwtVerify(token, keySet, { issuer, algorithms: ["ES256", "RS256"], requiredClaims: ["sub", "exp", "role"] });
    if (!claims.sub || claims.iss !== issuer || claims.role !== "authenticated" || !claims.exp || claims.exp <= Date.now() / 1000) throw new Error("Invalid role");
    return claims;
  } catch { throw new AccessError(401, t("backend.7269346080")); }
}
export async function mobilePrincipal(request: Request) {
  const claims = await verifiedClaims(bearer(request));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.client_id || !audience.includes("authenticated")) throw new AccessError(403, t("backend.14aa5beeb9"));
  return { id: claims.sub!, anonymous: claims.is_anonymous === true };
}
export function accessResponse(error: unknown) {
  const status = error instanceof AccessError ? error.status : 503;
  return Response.json({ error: error instanceof AccessError ? error.message : "Authorization service unavailable" }, { status, headers: { "Cache-Control": "no-store" } });
}
