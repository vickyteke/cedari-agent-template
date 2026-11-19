import {t} from "../../../../../packages/config/src/copy";
import { imageProvider } from "../providers/current";
import { agentConfig } from "../../../../../packages/config/src/public";
import { createHmac, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { acquireLease, releaseLease } from "../mcp/admission";
import { callArvivaTool } from "../mcp/client";
import { productIdSchema } from "../mcp/identity";
import { mobileProducts } from "../mcp/products";
import { budget } from "./admission";
import type { ChatInput, ChatProgress } from "./conversation";
import { boundedBytes } from "./http";
import type { Product } from "../types";
import { photoSchema, photoUrl, savePhoto, type ChatPhoto } from "./images";

const pendingSchema = z.object({
  owner: z.string(),
  expires: z.number(),
  ids: z.array(productIdSchema).max(5),
  selected: productIdSchema.optional(),
  photo: photoSchema.optional(),
  placement: z.string().max(300).optional(),
  step: z.enum(["product", "photo", "placement"]),
});
type Pending = z.infer<typeof pendingSchema>;

function signature(payload: string, key: string) {
  return createHmac("sha256", key).update("arviva-room-preview:" + payload).digest();
}

function seal(state: Pending, key: string) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return payload + "." + signature(payload, key).toString("base64url");
}

function unseal(token: string | undefined, key: string, owner: string) {
  if (!token) return;
  try {
    const [payload, mac, extra] = token.split(".");
    if (!payload || !mac || extra !== undefined) return;
    const actual = Buffer.from(mac, "base64url");
    const expected = signature(payload, key);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return;
    const state = pendingSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    if (state.owner === owner && state.expires > Date.now()) return state;
  } catch { /* An expired or invalid context cannot authorize a render. */ }
}

export function previewIntent(text: string) {
  const scene = /\b(?:on (?:this|my|the|our) (?:wall|floor)|in (?:this|my|the|our) (?:room|space|home)|(?:in|on) (?:this|my|the|our) (?:(?:attached|uploaded|room) )?(?:photo|picture|image)|(?:room|wall) preview)\b/i;
  if (!scene.test(text)) return false;
  if (/\b(?:preview|visuali[sz]e|mock[ -]?up)\b/i.test(text)) return true;
  // “Show how the product would look” is a preview even without an ordinal.
  if (/\bhow\b.{0,100}\b(?:would|will|might|could)\s+look\b/i.test(text)) return true;
  const reference = /\b(?:first|second|third|fourth|fifth|[1-5](?:st|nd|rd|th)|(?:option|product|item|number)\s*[1-5]|(?:this|that|the) (?:piece|product|item|one|rug|print|artwork|mirror)|it)\b|#[1-5]\b/i;
  return /\b(?:show|look|place|hang|put|see)\b/i.test(text) && reference.test(text);
}

export function selectedResult(text: string, ids: string[]) {
  const ordinals = [...text.matchAll(/\b(first|second|third|fourth|fifth|[1-5](?:st|nd|rd|th)|(?:option|product|item|number)\s*[1-5])\b|#([1-5])\b/gi)];
  const indices = new Set(ordinals.map(match => {
    const word = (match[1] || match[2]).toLowerCase();
    const digit = word.match(/[1-5]/)?.[0];
    return digit ? Number(digit) - 1 : ["first", "second", "third", "fourth", "fifth"].indexOf(word);
  }));
  if (indices.size === 1) return ids[[...indices][0]];
  if (!indices.size && ids.length === 1) return ids[0];
}

function placementReply(text: string) {
  if (/^(?:no\b|don[’']t\b|do not\b|not yet\b)/i.test(text) || /\$|\b(?:budget|checkout|more options|other options|alternatives)\b/i.test(text)) return false;
  return /^(?:yes|sure|go ahead|sounds good|that works|please do|try again|do it|you choose|your choice|okay|ok|perfect|looks good|default)[.!\s]*$/i.test(text)
    || /\b(?:cent(?:er|re)(?:ed)?|middle|above|below|higher|lower|left|right|eye level|over (?:the|my)|next to|near|by (?:the|my)|under|between)\b/i.test(text);
}

async function downloadImage(url: URL | string, signal: AbortSignal) {
  const response = await fetch(url, { signal, redirect: "error", cache: "no-store" });
  if (!response.ok || !response.body || !/^image\/(?:jpeg|png|webp|avif|gif)(?:;|$)/i.test(response.headers.get("content-type") || "")) throw new Error("image_unavailable");
  return Buffer.from(await boundedBytes(response.body, 3_000_000, 8000));
}

function catalogImage(url: string) {
  const source = new URL(url);
  if (source.protocol !== "https:" || source.username || source.password || source.port) throw new Error("image_host");
  const hosts=(process.env.IMAGE_REFERENCE_HOSTS || "cdn.shopify.com").split(",").map(host=>host.trim()).filter(Boolean);
  if (hosts.includes(source.hostname) && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(source.hostname) && !source.hostname.endsWith(".local")) return source;
  throw new Error("image_host");
}

type PreviewReply = { content: string; products: Product[]; checkoutLinks: []; mode: string; previewContext?: string; previewImage?: ChatPhoto };
const reply = (content: string): PreviewReply => ({ content, products: [], checkoutLinks: [], mode: "room-preview" });

export async function roomPreviewReply(input: ChatInput, progress: ChatProgress) {
  const key = process.env.OPENAI_API_KEY;
  const owner = progress.photoOwnerId;
  const enabled = agentConfig.features.roomPreviews && agentConfig.agent.photoWorkflows.includes("room-preview") && process.env.ROOM_PREVIEW_ENABLED === "true";
  const last = input.messages.at(-1)!;
  const previous = input.messages.at(-2);
  const fresh = previewIntent(last.content);
  if (!enabled || !input.roomPreview || !key || !owner) {
    if (!fresh && !previous?.previewContext) return;
    if (enabled && !input.roomPreview) {
      return reply(t("backend.817b0cc946"));
    }
    if (input.roomPreview) {
      return reply(t("backend.ed2fe9e6e8"));
    }
    return;
  }
  const pending = previous?.role === "assistant" ? unseal(previous.previewContext, key, owner) : undefined;
  if (!fresh && !pending) return;
  if (pending && /^(?:no thanks|cancel|never mind|nevermind|skip)[.!\s]*$/i.test(last.content)) return reply(t("backend.38ea7579d7"));

  if (pending?.step === "photo" && !fresh && !last.images?.length) return;
  if (pending?.step === "product" && !fresh && !last.images?.length && !selectedResult(last.content, pending.ids)) return;

  const ids = input.messages.slice(0, -1).findLast(m => m.role === "assistant" && m.productIds?.length)?.productIds?.slice(0, 5) || [];
  const starting = !pending || (fresh && !!selectedResult(last.content, ids));
  const earlierPhotos = starting && !last.images?.length
    ? input.messages.slice(0, -1).findLast(message => message.role === "user" && message.images?.length)?.images
    : undefined;
  const earlierPhoto = earlierPhotos?.length === 1 && earlierPhotos[0].ownerId === owner ? earlierPhotos[0] : undefined;
  const state: Pending = starting
    ? { owner, ids, photo: earlierPhoto, expires: Date.now() + 30 * 60_000, step: "product" }
    : pending;
  const ask = (content: string, step: Pending["step"]) => ({
    ...reply(content), previewContext: seal({ ...state, step }, key),
  });
  if (last.images?.length) {
    if (last.images.length !== 1 || last.images[0].ownerId !== owner) {
      state.photo = undefined;
      return ask(t("backend.05c90f599c"), state.selected ? "photo" : "product");
    }
    state.photo = last.images[0];
  }
  if (!state.ids.length) return reply(t("backend.8a9fa99f00"));
  if (!state.selected) state.selected = selectedResult(last.content, state.ids);
  if (!state.selected) return ask(t("backend.a006108d45"), "product");
  if (!state.photo) return ask(t("backend.0405433792"), "photo");

  // A new photo or product always gets a placement confirmation before a paid edit.
  const confirmed = state === pending && pending.step === "placement" && !last.images?.length && placementReply(last.content);
  if (!confirmed && state === pending && pending.step === "placement" && !fresh && !last.images?.length) return;
  const signal = AbortSignal.any([AbortSignal.timeout(53_000), ...(progress.signal ? [progress.signal] : [])]);
  const productId = state.selected;
  let lease: string | null = null;
  try {
    const products = mobileProducts(await callArvivaTool("get_products", { productIds: [productId] }, signal, progress.commerce));
    const product = products.find(item => item.id === productId);
    if (!product?.image_url) return reply(t("backend.cf22697d1e"));
    const descriptor = product.title + " " + (product.product_type || "");
    const rug = /\b(?:rug|rugs|runner)\b/i.test(descriptor);
    if (!rug && !/\b(?:wall|art|painting|print|canvas|poster|mirror|tapestry)\b/i.test(descriptor)) return reply(t("backend.c5a8688a72"));
    const source = catalogImage(product.image_url);
    const name = product.title.replace(/[\r\n]/g, " ").slice(0, 160);
    if (!confirmed) return ask(
      rug
        ? t("dynamic.ed4fb3e970",{value0: String(name)})
        : t("dynamic.24aba13a41",{value0: String(name)}),
      "placement",
    );
    if (!/^try again[.!\s]*$/i.test(last.content)) state.placement = last.content.slice(0, 300);
    if (input.requestId && !await budget(`room-preview:turn:${owner}:${input.requestId}`, 1, 1800)) return ask(t("backend.fcdd07763d"), "placement");
    if (!await budget(`room-preview:user:${owner}`, 3, 86400)
      || !await budget("room-preview:pool", 30, 86400)) return reply(t("backend.122ec98406"));
    lease = await acquireLease("arviva-public");
    if (!lease) return ask(t("backend.de0aaa6978"), "placement");

    progress.onStatus?.(t("backend.b23bf99fee"), "image");
    const roomUrl = await photoUrl(owner, state.photo.id);
    const [room, reference] = await Promise.all([downloadImage(roomUrl, signal), downloadImage(source, signal)]);
    const normalized = await sharp(reference, { limitInputPixels: 16_000_000 }).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const form = new FormData();
    form.append("image[]", new Blob([new Uint8Array(room)], { type: "image/jpeg" }), "room.jpg");
    form.append("image[]", new Blob([new Uint8Array(normalized)], { type: "image/jpeg" }), "variant.jpg");
    form.set("model", agentConfig.agent.imageModel);
    form.set("quality", "medium");
    form.set("output_format", "jpeg");
    form.set("n", "1");
    form.set("prompt", t("dynamic.960269a9e4",{value0: String(rug ? "rug" : "wall décor"),value1: String(state.placement || t("backend.6e2dc0bb97"))}));
    const response = await imageProvider.edit(form, signal);
    if (!response.ok || !response.body) throw new Error("preview_failed");
    const result = JSON.parse(Buffer.from(await boundedBytes(response.body, 10_000_000, 8000)).toString());
    const encoded = result.data?.[0]?.b64_json;
    if (typeof encoded !== "string" || !encoded) throw new Error("preview_missing");
    const pipeline = sharp(Buffer.from(encoded, "base64"), { limitInputPixels: 16_000_000 }).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true });
    let output = await pipeline.clone().jpeg({ quality: 78 }).toBuffer();
    if (output.length > 262144) output = await pipeline.resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer();
    if (output.length > 262144) throw new Error("preview_size");
    const previewImage = await savePhoto(owner, output);
    return { ...reply(t("dynamic.0c355ec2d7",{value0: String(name)})), previewImage, products: [product] };
  } catch {
    return confirmed
      ? ask(t("backend.0d4a1f542b"), "placement")
      : reply(t("backend.6367ad48a3"));
  } finally {
    if (lease) await releaseLease(lease).catch(() => {});
  }
}
