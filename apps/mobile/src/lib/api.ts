import { checkoutResult } from "./checkout-result";
import { agentConfig } from "../../../../packages/config/src/public.ts";
import { Platform } from "react-native";
import { fetch as streamingFetch } from "expo/fetch";
import { consumeChatStream } from "./chat-stream";
import { shoppingAccessToken, supabase } from "./auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { checkoutAttempts, prepareCheckoutAttempt } from "./checkout-attempt";
import { apiError } from "./api-error";
import type { Message, Product, CheckoutLink, ChatPhoto } from "./model";
import { catalogProducts, type CedariListing } from "./cedari";
const localWebApi =
  __DEV__ && Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_ARVIVA_WEB_PILOT_API_URL
    : undefined;
export const apiOrigin = (
  localWebApi ||
  process.env.EXPO_PUBLIC_API_URL ||
  ""
).replace(/\/$/, "");
export async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 30000,
): Promise<T> {
  if (!apiOrigin)
    throw new Error("Configure EXPO_PUBLIC_API_URL to connect shopping.");
  const token = await shoppingAccessToken();
  const response = await fetch(`${apiOrigin}/api/mobile${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response
    .json()
    .catch(() => ({
      error:
        "The service returned an unexpected response. The mobile API may need deployment.",
    }));
  if (!response.ok)
    throw apiError(payload, "Could not connect. Please try again.");
  return payload;
}
export async function catalog(filters: Record<string, string> = {}) {
  const payload = await request<{
    products?: Product[];
    listings?: CedariListing[];
    listing?: CedariListing;
    missingProductIds?: string[];
  }>(`/catalog?${new URLSearchParams(filters)}`);
  // get_products returns all variants of a listing; keep the selected variants
  // when opening a detail page or comparing saved pieces.
  return {
    products: catalogProducts(
      payload,
      filters.ids ? filters.ids.split(",") : undefined,
    ),
    missingProductIds: payload.missingProductIds || [],
  };
}
export type ChatReply = {
  content: string;
  previewImage?: ChatPhoto;
  previewContext?: string;
  photoClarification?: boolean;
  products: Product[];
  checkoutLinks?: CheckoutLink[];
  mode: string;
  timings?: Record<string, string | number | boolean>;
};
export async function chat(
  messages: Message[],
  preferences: string,
  progress: {
    onText?: (text: string) => void;
    onStatus?: (status: string, phase?: "image" | "chat") => void;
    signal?: AbortSignal;
  } = {},
): Promise<ChatReply> {
  if (!apiOrigin)
    throw new Error("Configure EXPO_PUBLIC_API_URL to connect shopping.");
  const token = await shoppingAccessToken();
  const signal = progress.signal
    ? AbortSignal.any([progress.signal, AbortSignal.timeout(65000)])
    : AbortSignal.timeout(65000);
  const response = await streamingFetch(`${apiOrigin}/api/mobile/chat`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      roomPreview: agentConfig.features.roomPreviews,
      requestId: messages.at(-1)?.id,
      seenProductIds: [
        ...new Set(
          messages.flatMap((message) => [
            ...(message.products || []).map((product) => product.id),
            ...(message.checkoutLinks || []).flatMap((link) =>
              link.items.map((item) => item.productId),
            ),
          ]),
        ),
      ].slice(-500),
      messages: messages
        .slice(-12)
        .map(
          ({
            role,
            content,
            products,
            checkoutLinks,
            images,
            previewContext,
            previewImage,
            photoClarification,
          }) => {
            const ids = [
              ...new Set([
                ...(products || []).map((product) => product.id),
                ...(checkoutLinks || []).flatMap((link) =>
                  link.items.map((item) => item.productId),
                ),
              ]),
            ].slice(0, 24);
            return {
              role,
              content,
              ...(role === "assistant" && photoClarification
                ? { photoClarification: true }
                : {}),
              ...(agentConfig.features.roomPreviews &&
              role === "assistant" &&
              previewContext
                ? { previewContext }
                : {}),
              ...(agentConfig.features.uploads &&
              role === "user" &&
              images?.length
                ? { images: images.map(({ id, ownerId }) => ({ id, ownerId })) }
                : {}),
              ...(role === "assistant" && !previewImage && ids.length
                ? { productIds: ids }
                : {}),
            };
          },
        ),
      preferences,
    }),
  });
  // Older deployments still return JSON; never repeat a request automatically,
  // since the turn may already have prepared a checkout.
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/event-stream")
  ) {
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error || "Could not send your message.");
    return payload;
  }
  if (!response.body) throw new Error("Could not open the conversation.");
  return consumeChatStream<ChatReply>(
    response.body,
    progress.onText,
    progress.onStatus,
  );
}

const attempts = checkoutAttempts(AsyncStorage, () => Crypto.randomUUID());
export async function checkout(
  items: { productId: string; quantity: number }[],
  intentKey?: string,
) {
  await shoppingAccessToken();
  const session = await supabase!.auth.getSession();
  if (!session.data.session)
    throw new Error("Please reconnect before checking out.");
  if (intentKey)
    return checkoutResult(
      await request("/checkout", {
        method: "POST",
        body: JSON.stringify({ items, idempotencyKey: intentKey }),
      }),
    );
  const selection = items
    .map((item) => ({ ...item }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
  const fingerprint = JSON.stringify([
    apiOrigin,
    session.data.session.user.id,
    selection,
  ]);
  const key = `${agentConfig.id}.checkout.${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fingerprint)}`;
  return prepareCheckoutAttempt(attempts, key, (idempotencyKey) =>
    request<unknown>("/checkout", {
      method: "POST",
      body: JSON.stringify({ items, idempotencyKey }),
    }),
  );
}
