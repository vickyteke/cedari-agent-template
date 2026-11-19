import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "../supabase";

export const mcpResource = () => process.env.MCP_RESOURCE_URL || "https://www.arviva.space/api/mcp";
export const authIssuer = () => `${process.env.SUPABASE_URL?.replace(/\/$/, "")}/auth/v1`;
export const metadataUrl = () => { const url = new URL(mcpResource()); return `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`; };
export class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function bearer(request: Request) {
  const match = /^Bearer ([^\s,]+)$/i.exec(request.headers.get("authorization") || "");
  if (!match || match[1].length > 16000) throw new AccessError(401, "Authentication required");
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
  } catch { throw new AccessError(401, "Invalid or expired access token"); }
}
const digest = (value: string) => createHash("sha256").update(value).digest();
export async function mcpPrincipal(request: Request) {
  const token = bearer(request);
  const internal = process.env.MCP_INTERNAL_TOKEN;
  if (internal && internal.length >= 32 && timingSafeEqual(digest(token), digest(internal))) return { id: "arviva-backend", permissions: ["catalog:read", "checkout:create"], limit: 900 };
  const claims = await verifiedClaims(token);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(mcpResource()) || typeof claims.client_id !== "string" || claims.is_anonymous) throw new AccessError(401, "An MCP OAuth access token is required");
  // No cache: removing approval or reducing permissions takes effect immediately.
  const { data, error } = await getSupabaseAdmin().from("mcp_oauth_clients").select("permissions,requests_per_minute,enabled").eq("client_id", claims.client_id).maybeSingle();
  if (error) throw new AccessError(503, "Authorization service unavailable");
  if (!data?.enabled) throw new AccessError(403, "This integration is not approved");
  const granted = Array.isArray(claims.mcp_permissions) ? claims.mcp_permissions : [];
  return { id: claims.client_id, permissions: (data.permissions as string[]).filter(p => granted.includes(p)), limit: data.requests_per_minute as number };
}
export async function mobilePrincipal(request: Request) {
  const claims = await verifiedClaims(bearer(request));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.client_id || !audience.includes("authenticated")) throw new AccessError(403, "Agent tokens cannot access customer APIs");
  return { id: claims.sub!, anonymous: claims.is_anonymous === true };
}
export function accessResponse(error: unknown, mcp = false) {
  const status = error instanceof AccessError ? error.status : 503;
  return Response.json({ error: error instanceof AccessError ? error.message : "Authorization service unavailable" }, { status, headers: { "Cache-Control": "no-store", ...(mcp && status === 401 ? { "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl()}"` } : {}) } });
}
