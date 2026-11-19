import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../supabase";

export async function budget(key: string, limit: number, seconds: number) {
  const { data, error } = await getSupabaseAdmin().rpc("security_budget", {
    bucket_key: createHash("sha256").update(key).digest("hex"), max_requests: limit, window_seconds: seconds,
  });
  if (error) return false; // A missing or unavailable budget never opens the AI endpoint.
  return data === true;
}
export async function admitChat(request: Request, principal: { id: string; anonymous: boolean }) {
  const pool = principal.anonymous ? "guest" : "customer";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const keys = [`chat:ip:${pool}:${ip}`, `chat:user:${principal.id}`, `chat:pool:${pool}`, `chat:burst:${pool}`, `chat:minute:${principal.id}`]
    .map(key => createHash("sha256").update(key).digest("hex"));
  const { data, error } = await getSupabaseAdmin().rpc("admit_chat_with_limits", { pool_name: pool, bucket_keys: keys });
  return !error && data === true; // Missing settings/storage fail closed.
}

function tokenCeiling(pool: "guest" | "customer") {
  const raw = process.env[pool === "guest" ? "CHAT_GUEST_TOKEN_CEILING" : "CHAT_CUSTOMER_TOKEN_CEILING"];
  const value = raw === undefined ? (pool === "guest" ? 10000000 : 30000000) : Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= 100000000 ? value : 0;
}
export async function reserveModelTokens(pool: "guest" | "customer", bytes: number) {
  const ceiling = tokenCeiling(pool);
  if (!ceiling || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error("model_budget_configuration_unavailable");
  const { data, error } = await getSupabaseAdmin().rpc("reserve_model_tokens", { pool_name: pool, reserved_tokens: bytes + 8192, token_ceiling: ceiling });
  if (error || typeof data !== "boolean") throw new Error("model_budget_storage_unavailable");
  return data;
}
