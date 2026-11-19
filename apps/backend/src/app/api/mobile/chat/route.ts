import { createHash } from "node:crypto";
import { commerceContext } from "@/lib/mobile/commerce-context";
import { admitChat } from "@/lib/mobile/admission";
import { mobilePrincipal, accessResponse } from "@/lib/mcp/auth";
import { z } from "zod";
import { AIConnectionError } from "@/lib/mobile/conversation";
import { chatInput, shoppingReply } from "@/lib/mobile/assistant";
import { body, BodyReadError, json, preflight } from "@/lib/mobile/http";
export const OPTIONS = preflight;
export const maxDuration = 60;
export async function POST(request: Request) {
  let principal;
  try { principal = await mobilePrincipal(request); } catch (error) { const denied = accessResponse(error); return json(await denied.json(), denied.status); }
  try {
    if (!await admitChat(request, principal)) return json({ error: "Arviva is busy. Please try again later." }, 429);
    const input = chatInput.parse(await body(request, 192000));
    if (input.messages.at(-1)?.role !== "user") return json({ error: "A shopper message is required." }, 400);
    const commerce = commerceContext(request, principal.id, input.requestId || createHash("sha256").update(JSON.stringify(input)).digest("hex"));
    if (!request.headers.get("accept")?.includes("text/event-stream")) return json(await shoppingReply(input, { commerce, signal: request.signal, photoOwnerId: principal.id, budgetPool: principal.anonymous ? "guest" : "customer" }));
    const abort = new AbortController();
    const signal = AbortSignal.any([request.signal, abort.signal]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: unknown) => { if (!signal.aborted) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); };
        const heartbeat = setInterval(() => emit({ type: "ping" }), 10000);
        try {
          const result = await shoppingReply(input, { commerce, signal, photoOwnerId: principal.id, budgetPool: principal.anonymous ? "guest" : "customer",
            onText: text => emit({ type: "text", text }),
            onStatus: status => emit({ type: "status", status }),
          });
          emit({ type: "complete", result });
        } catch (error) {
          if (error instanceof AIConnectionError) console.error("Arviva AI conversation failed", { code: error.code, status: error.status });
          emit({ type: "error", error: error instanceof AIConnectionError ? error.message : "Arviva couldn’t finish that reply. Please try again." });
        } finally { clearInterval(heartbeat); if (!abort.signal.aborted) controller.close(); }
      },
      cancel() { abort.abort(); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no", "Access-Control-Allow-Origin": process.env.MOBILE_WEB_ORIGIN || "http://localhost:8081" } });
  } catch (error) {
    if (error instanceof BodyReadError) return json({ error: error.status === 413 ? "This conversation is too large. Start a new conversation and try again." : "The message could not be read. Please try again." }, error.status);
    if (error instanceof AIConnectionError) console.error("Arviva AI conversation failed", { code: error.code, status: error.status });
    return json({ error: error instanceof AIConnectionError ? error.message : error instanceof z.ZodError || error instanceof SyntaxError ? "Invalid message." : "Shopping chat is temporarily unavailable. Please try again." }, error instanceof z.ZodError || error instanceof SyntaxError ? 400 : error instanceof AIConnectionError ? error.status : 503);
  }
}
