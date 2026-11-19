import {
  agentConfig,
  availableTabs,
} from "../../../../../../../packages/config/src/public";
import { t } from "../../../../../../../packages/config/src/copy";
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
  if (!availableTabs(agentConfig).some((tab) => tab.id === "chat"))
    return json({ error: "Chat is unavailable." }, 403);
  let principal;
  try {
    principal = await mobilePrincipal(request);
  } catch (error) {
    const denied = accessResponse(error);
    return json(await denied.json(), denied.status);
  }
  try {
    if (!(await admitChat(request, principal)))
      return json({ error: t("backend.5cb73ae6a1") }, 429);
    const input = chatInput.parse(await body(request, 192000));
    if (input.messages.at(-1)?.role !== "user")
      return json({ error: t("backend.513eceac1f") }, 400);
    const commerce = commerceContext(
      request,
      principal.id,
      input.requestId ||
        createHash("sha256").update(JSON.stringify(input)).digest("hex"),
    );
    if (!request.headers.get("accept")?.includes("text/event-stream"))
      return json(
        await shoppingReply(input, {
          commerce,
          signal: request.signal,
          photoOwnerId: principal.id,
          budgetPool: principal.anonymous ? "guest" : "customer",
        }),
      );
    const abort = new AbortController();
    const signal = AbortSignal.any([request.signal, abort.signal]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: unknown) => {
          if (!signal.aborted)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
        };
        const heartbeat = setInterval(() => emit({ type: "ping" }), 10000);
        try {
          const result = await shoppingReply(input, {
            commerce,
            signal,
            photoOwnerId: principal.id,
            budgetPool: principal.anonymous ? "guest" : "customer",
            onText: (text) => emit({ type: "text", text }),
            onStatus: (status, phase) =>
              emit({ type: "status", status, phase }),
          });
          emit({ type: "complete", result });
        } catch (error) {
          if (error instanceof AIConnectionError)
            console.error(t("backend.321acfb562"), {
              code: error.code,
              status: error.status,
            });
          emit({
            type: "error",
            error:
              error instanceof AIConnectionError
                ? error.message
                : t("backend.3f345300ff"),
          });
        } finally {
          clearInterval(heartbeat);
          if (!abort.signal.aborted) controller.close();
        }
      },
      cancel() {
        abort.abort();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof BodyReadError)
      return json(
        {
          error:
            error.status === 413
              ? t("backend.be94413c7a")
              : t("backend.254d68a9e6"),
        },
        error.status,
      );
    if (error instanceof AIConnectionError)
      console.error(t("backend.321acfb562"), {
        code: error.code,
        status: error.status,
      });
    return json(
      {
        error:
          error instanceof AIConnectionError
            ? error.message
            : error instanceof z.ZodError || error instanceof SyntaxError
              ? t("backend.c08a870fc2")
              : t("backend.4751192c8f"),
      },
      error instanceof z.ZodError || error instanceof SyntaxError
        ? 400
        : error instanceof AIConnectionError
          ? error.status
          : 503,
    );
  }
}
