import {t} from "../../../../../packages/config/src/copy";
import { mobilePrincipal } from "../mcp/auth";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../supabase";
const developmentBuckets = new Map<string, { window: number; requests: number }>();
export class BodyReadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function preflight() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": t("backend.f0163dd8ab") } });
}
export async function boundedBytes(stream: ReadableStream<Uint8Array>, maximum: number, timeout = 10000) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new BodyReadError(t("backend.3877664815"), 408)); void reader.cancel().catch(() => {}); }, timeout); });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), expired]);
      if (timedOut) throw new BodyReadError(t("backend.3877664815"), 408);
      if (done) break;
      total += value.byteLength;
      if (total > maximum) { void reader.cancel().catch(() => {}); throw new BodyReadError(t("backend.66228a295b"), 413); }
      chunks.push(value);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
export async function body(request: Request, maximum = 64000) {
  if (Number(request.headers.get("content-length")) > maximum) {
    void request.body?.cancel().catch(() => {});
    throw new BodyReadError(t("backend.66228a295b"), 413);
  }
  if (!request.body) throw new BodyReadError(t("backend.53cbd48fe3"), 400);
  const bytes = await boundedBytes(request.body, maximum);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new BodyReadError(t("backend.53cbd48fe3"), 400); }
}
export async function rateLimit(request: Request, scope: string, limit: number, identity?: string) {
  // Use the trusted reverse proxy's client IP. Do not expose this server directly.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const bucket = createHash("sha256").update(`${scope}:${identity || ip}`).digest("hex");
  if (process.env.NODE_ENV === "development" && process.env.MOBILE_LOCAL_RATE_LIMIT === "true") {
    const window = Math.floor(Date.now() / 60000);
    const previous = developmentBuckets.get(bucket);
    const entry = { window, requests: previous?.window === window ? previous.requests + 1 : 1 };
    developmentBuckets.set(bucket, entry);
    return entry.requests <= limit;
  }
  const { data, error } = await getSupabaseAdmin().rpc("mobile_rate_limit", { bucket_key: bucket, max_requests: limit });
  if (error) throw new Error(t("backend.3361016afa"));
  return data === true;
}
export async function userFromRequest(request: Request) {
  const principal = await mobilePrincipal(request).catch(() => null);
  if (!principal || principal.anonymous) return null;
  const token = request.headers.get("authorization")!.slice(7);
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}
