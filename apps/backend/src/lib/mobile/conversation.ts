import { t } from "../../../../../packages/config/src/copy";
import { agentConfig } from "../../../../../packages/config/src/public";
import { conversationProvider } from "../providers/current";
import { photoGuidance } from "../photo-workflows/registry";
import { photoSchema, resolveChatPhotos } from "./images";
import { reserveModelTokens } from "./admission";
import { safeProse } from "./prose";
import { wantsMoreResults } from "./shopping-intent";
import { readModelResponse } from "./response-stream";
import { checkoutColors } from "../variant-colors";
import { z } from "zod";
import {
  callArvivaTool,
  listArvivaTools,
  mcpMetadataCached,
} from "../mcp/client";
import { mobileProducts } from "../mcp/products";
import type { Product } from "../types";
import { getStore } from "../stores";
import { productIdSchema } from "../mcp/identity";
import type { CommerceContext } from "../mcp/cedari";
import {
  prepareChatCheckout,
  CheckoutSelectionError,
  type ChatCheckout,
} from "./chat-checkout";

export const chatInput = z.object({
  roomPreview: z.boolean().optional(),
  requestId: z.string().uuid().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(1800),
        productIds: z.array(productIdSchema).max(24).optional(),
        images: z.array(photoSchema).max(2).optional(),
        photoClarification: z.boolean().optional(),
        previewContext: z.string().max(2400).optional(),
      }),
    )
    .min(1)
    .max(12),
  seenProductIds: z.array(productIdSchema).max(500).default([]),
  preferences: z.string().max(1200).default(""),
});
export type ChatInput = z.infer<typeof chatInput>;
const agentTools = [
  "search_products",
  "get_products",
  "compare_products",
  "create_cart_link",
];
const descriptions: Record<string, string> = {
  create_cart_link: t("backend.e8b872d956"),
  search_products: t("backend.74fc412813"),
  get_products: t("backend.dcb1f144bc"),
  compare_products: t("backend.f91a159c59"),
};
function agentInstructions(
  photoWorkflow: string | undefined,
  available: string[],
) {
  return t("dynamic.f79925a75a", {
    value0: String(agentConfig.brand.agentName),
    value1: String(agentConfig.brand.name),
    value2: String(agentConfig.agent.personality),
    value3: String(agentConfig.agent.tone),
    value4: String(agentConfig.agent.guidance),
    value5: String(agentConfig.locale),
    value6: String(photoGuidance(photoWorkflow)),
    value7: String(photoWorkflow || t("backend.6a3438b06f")),
    value8: String(agentConfig.discovery.resultLimit),
    value9: available.join(", "),
  });
}
export const MAX_RECOMMENDATIONS = agentConfig.discovery.resultLimit;
const replySchema = z.object({
  content: z.string().min(1).max(1800),
  productIds: z.array(productIdSchema).max(MAX_RECOMMENDATIONS),
});
export class AIConnectionError extends Error {
  constructor(
    public code: string,
    public status = 503,
  ) {
    super(
      code === "daily_budget_reached"
        ? t("backend.5fed1efbec")
        : t("backend.e658929c9b"),
    );
  }
}

export type ChatProgress = {
  photoWorkflow?: string;
  commerce?: CommerceContext;
  photoOwnerId?: string;
  budgetPool?: "guest" | "customer";
  signal?: AbortSignal;
  onText?: (text: string) => void;
  onStatus?: (status: string, phase?: "image" | "chat") => void;
};
export async function conversationalReply(
  input: ChatInput,
  progress: ChatProgress = {},
) {
  const started = performance.now();
  const timings = {
    model_ms: 0,
    tool_ms: 0,
    setup_ms: 0,
    model_calls: 0,
    tool_calls: 0,
    reused_lookups: 0,
    mcp_metadata_cached: mcpMetadataCached(),
  };
  let firstText: number | undefined;
  const emitText = (text: string) => {
    if (text && firstText === undefined)
      firstText = Math.round(performance.now() - started);
    progress.onText?.(safeProse(text));
  };
  const invoke = async (
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => {
    const start = performance.now();
    timings.tool_calls++;
    try {
      return await callArvivaTool(name, args, signal, progress.commerce);
    } finally {
      timings.tool_ms += Math.round(performance.now() - start);
    }
  };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AIConnectionError("not_configured");
  const model = process.env.OPENAI_MODEL || agentConfig.agent.model;
  const reasoningModel = /^gpt-(?:5|6)(?:[.-]|$)/.test(model);
  const signal = progress.signal
    ? AbortSignal.any([progress.signal, AbortSignal.timeout(45000)])
    : AbortSignal.timeout(45000);
  progress.onStatus?.(t("backend.21c3e0ada3"));
  const setupStart = performance.now();
  const discovery = listArvivaTools(signal);
  const previousIds =
    [...input.messages]
      .reverse()
      .find(
        (message) => message.role === "assistant" && message.productIds?.length,
      )?.productIds || [];
  if (previousIds.length) progress.onStatus?.(t("backend.0d1cdbbc60"));
  const refresh = previousIds.length
    ? Promise.all(
        Array.from({ length: Math.ceil(previousIds.length / 8) }, (_, i) =>
          invoke(
            "get_products",
            { productIds: previousIds.slice(i * 8, i * 8 + 8) },
            signal,
          ).then(mobileProducts),
        ),
      )
        .then((groups) => groups.flat())
        .catch(() => null)
    : Promise.resolve([]);
  const [toolMetadata, previous] = await Promise.all([discovery, refresh]);
  timings.setup_ms = Math.round(performance.now() - setupStart);
  const discovered = z
    .object({
      tools: z.array(
        z.object({
          name: z.string(),
          inputSchema: z.record(z.string(), z.unknown()),
        }),
      ),
    })
    .parse(toolMetadata);
  const tools = discovered.tools
    .filter((tool) => agentTools.includes(tool.name))
    .map((tool) => ({
      type: "function",
      name: tool.name,
      description: descriptions[tool.name],
      parameters: tool.inputSchema,
      strict: false,
    }));
  const allowedTools = new Set(tools.map((tool) => tool.name));
  if (
    !["search_products", "get_products"].every((name) => allowedTools.has(name))
  )
    throw new AIConnectionError("mcp_tools_unavailable");
  if (input.messages.some((message) => message.images?.length))
    progress.onStatus?.(t("backend.0b5c2afe10"));
  const photos = await resolveChatPhotos(input.messages, progress.photoOwnerId);
  const transcript: unknown[] = [
    {
      role: "user",
      content: t("dynamic.85e01b64cf", {
        value0: String(input.preferences || "None yet."),
      }),
    },
    ...input.messages.map((message, index) => {
      const text =
        message.content +
        (message.role === "assistant" && message.productIds?.length
          ? `\n[Previously displayed product IDs, in order: ${message.productIds.join(", ")}]`
          : "");
      const images =
        index === photos.index
          ? (message.images || []).flatMap((photo) =>
              photos.resolved.has(photo.id)
                ? [
                    {
                      type: "input_image",
                      image_url: photos.resolved.get(photo.id)!,
                      detail: "high",
                    },
                  ]
                : [],
            )
          : [];
      return {
        role: message.role,
        content: images.length
          ? [{ type: "input_text", text }, ...images]
          : text,
      };
    }),
  ];
  const requestedColor = checkoutColors(input.messages);
  const products = new Map<string, Product>();
  const checkoutLinks = new Map<string, ChatCheckout>();
  const knownIds = new Set(
    input.messages.flatMap((message) =>
      message.role === "assistant" ? message.productIds || [] : [],
    ),
  );
  const seenIds = [...new Set([...input.seenProductIds, ...knownIds])].slice(
    -500,
  );
  const latest = input.messages.at(-1)?.content || "";
  const moreResults = wantsMoreResults(latest);
  // Refresh the last displayed selection before answering references like
  // "the first one". The model may answer directly rather than request a tool;
  // those answers still need current catalog facts and verified card IDs.
  if (previousIds.length) {
    if (previous) {
      for (const product of previous) products.set(product.id, product);
      const missing = previousIds.filter((id) => !products.has(id));
      if (missing.length)
        transcript.splice(1, 0, {
          role: "user",
          content: t("dynamic.99f7d44e8d", {
            value0: String(missing.join(", ")),
          }),
        });
      transcript.splice(1, 0, {
        role: "user",
        content: t("dynamic.fef17c5358", {
          value0: String(
            JSON.stringify(
              previous.map((product) => ({
                id: product.id,
                title: product.title,
                merchant:
                  product.merchant_name ||
                  getStore(product.store_key)?.name ||
                  product.store_key,
                variant: product.variant_title,
                description: product.description
                  ?.replace(/<[^>]*>/g, " ")
                  .slice(0, 1000),
                price: product.price,
                currency: product.currency,
                available: product.available,
              })),
            ),
          ),
        }),
      });
    } else {
      transcript.splice(1, 0, {
        role: "user",
        content: t("backend.9f19567c5d"),
      });
    }
  }
  for (let round = 0; round < 3; round++) {
    const modelStart = performance.now();
    timings.model_calls++;
    if (Buffer.byteLength(JSON.stringify(transcript), "utf8") > 200000)
      throw new AIConnectionError("conversation_too_large");
    const payload = JSON.stringify({
      model,
      store: false,
      stream: !!progress.onText,
      instructions: agentInstructions(progress.photoWorkflow, [
        ...allowedTools,
      ]),
      input: transcript,
      ...(reasoningModel
        ? {
            reasoning: { effort: "low" },
            include: ["reasoning.encrypted_content"],
          }
        : {}),
      tools,
      parallel_tool_calls: false,
      tool_choice:
        round === 2
          ? "none"
          : round === 0 && moreResults
            ? { type: "function", name: "search_products" }
            : "auto",
      max_output_tokens: reasoningModel ? 4096 : 1200,
      text: {
        format: {
          type: "json_schema",
          name: "arviva_reply",
          strict: true,
          schema: {
            type: "object",
            properties: {
              content: { type: "string" },
              productIds: {
                type: "array",
                items: { type: "string" },
                maxItems: MAX_RECOMMENDATIONS,
              },
            },
            required: ["content", "productIds"],
            additionalProperties: false,
          },
        },
      },
    });
    if (Buffer.byteLength(payload, "utf8") > 250000)
      throw new AIConnectionError("conversation_too_large", 413);
    if (
      !(await reserveModelTokens(
        progress.budgetPool || "customer",
        Buffer.byteLength(payload, "utf8") + photos.resolved.size * 20000,
      ))
    )
      throw new AIConnectionError("daily_budget_reached", 429);
    progress.onStatus?.(
      round > 0
        ? t("backend.a08e121cbf")
        : photos.resolved.size
          ? t("backend.5f06b3e656")
          : t("backend.f9f4b7080b"),
    );
    const response = await conversationProvider.respond(
      JSON.parse(payload),
      signal,
    );
    if (!response.ok) {
      // No provider response body, secret, user message, or preference text enters logs.
      const code =
        response.status === 401
          ? "invalid_api_key"
          : response.status === 429
            ? "quota_or_rate_limit"
            : "provider_error";
      console.error(t("backend.e1ed328c32"), { status: response.status, code });
      throw new AIConnectionError(code);
    }
    let rawResponse: unknown;
    try {
      rawResponse = await readModelResponse(response, emitText);
    } catch {
      signal.throwIfAborted();
      throw new AIConnectionError("invalid_model_response");
    }
    const parsedResponse = z
      .object({
        status: z.string().optional(),
        output: z.array(z.record(z.string(), z.unknown())),
      })
      .safeParse(rawResponse);
    if (!parsedResponse.success)
      throw new AIConnectionError("invalid_model_response");
    const data = parsedResponse.data;
    timings.model_ms += Math.round(performance.now() - modelStart);
    if (data.status && data.status !== "completed")
      throw new AIConnectionError("incomplete_response");
    const calls = data.output.filter((item) => item.type === "function_call");
    if (!calls.length) {
      const text = data.output
        .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
        .filter((item) => item.type === "output_text")
        .map((item) => item.text)
        .join("");
      let rawReply: unknown;
      try {
        rawReply = JSON.parse(text);
      } catch {
        throw new AIConnectionError("invalid_model_response");
      }
      const parsedReply = replySchema.safeParse(rawReply);
      if (!parsedReply.success)
        throw new AIConnectionError("invalid_model_response");
      const reply = parsedReply.data;
      if (reply.productIds.some((id) => !products.has(id)))
        throw new AIConnectionError("ungrounded_product_reference");
      emitText(reply.content);
      return {
        timings: {
          ...timings,
          model,
          server_total_ms: Math.round(performance.now() - started),
          server_first_text_ms:
            firstText ?? Math.round(performance.now() - started),
        },
        mode: "assistant",
        content: safeProse(reply.content),
        products: [...new Set(reply.productIds)].map((id) => products.get(id)!),
        checkoutLinks: [...checkoutLinks.values()],
      };
    }
    if (round === 2 || calls.length > 1)
      throw new AIConnectionError("tool_limit");
    // Preserve every output item, including reasoning, for Responses API continuation.
    emitText("");
    transcript.push(...data.output);
    for (const rawCall of calls) {
      const parsedCall = z
        .object({
          name: z.string(),
          arguments: z.string(),
          call_id: z.string(),
        })
        .safeParse(rawCall);
      if (!parsedCall.success)
        throw new AIConnectionError("invalid_model_response");
      const call = parsedCall.data;
      let output: unknown;
      if (!allowedTools.has(call.name))
        output = { error: t("backend.e441d65b62") };
      else {
        try {
          const args = z
            .record(z.string(), z.unknown())
            .parse(JSON.parse(call.arguments));
          if (call.name === "search_products") {
            args.limit =
              typeof args.limit === "number" && Number.isInteger(args.limit)
                ? Math.min(24, Math.max(1, args.limit))
                : 12;
            args.distinctProducts = true;
            if (moreResults)
              args.excludeProductIds = [
                ...new Set([
                  ...seenIds,
                  ...z
                    .array(productIdSchema)
                    .max(500)
                    .parse(args.excludeProductIds || []),
                ]),
              ].slice(-500);
          }
          progress.onStatus?.(
            call.name === "create_cart_link"
              ? t("backend.85466d4afa")
              : call.name === "compare_products"
                ? t("backend.094ee72c21")
                : call.name === "get_products"
                  ? t("backend.a6b34179eb")
                  : t("backend.10960e8a27"),
          );
          if (call.name === "create_cart_link") {
            const prepared = await prepareChatCheckout(
              args,
              new Set([...knownIds, ...products.keys()]),
              signal,
              requestedColor,
              products,
              invoke,
            );
            for (const checkout of prepared.checkoutLinks)
              checkoutLinks.set(checkout.storeKey, checkout);
            output = { ...prepared, notice: t("backend.6a0fbbf212") };
            transcript.push({
              type: "function_call_output",
              call_id: call.call_id,
              output: JSON.stringify(output),
            });
            continue;
          }
          const ids =
            call.name === "get_products"
              ? z.array(productIdSchema).min(1).max(8).parse(args.productIds)
              : [];
          const reused = ids.length > 0 && ids.every((id) => products.has(id));
          if (reused) timings.reused_lookups++;
          const found = reused
            ? ids.map((id) => products.get(id)!)
            : mobileProducts(await invoke(call.name, args, signal));
          for (const product of found) products.set(product.id, product);
          // Short, factual context; do not send long merchant HTML or internal credentials.
          output = {
            products: found.map((product) => ({
              id: product.id,
              title: product.title,
              merchant:
                product.merchant_name ||
                getStore(product.store_key)?.name ||
                product.store_key,
              productType: product.product_type,
              variant: product.variant_title,
              price: product.price,
              currency: product.currency,
              available: product.available,
              description: product.description
                ?.replace(/<[^>]*>/g, " ")
                .slice(0, 1000),
              updatedAt: product.updated_at,
            })),
          };
        } catch (error) {
          output = {
            error:
              error instanceof CheckoutSelectionError
                ? error.message
                : call.name === "create_cart_link"
                  ? t("backend.a6494c805a")
                  : t("backend.0675ec6d32"),
          };
        }
      }
      transcript.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(output),
      });
    }
  }
  throw new AIConnectionError("tool_limit");
}
