import { photoSchema, type ChatPhoto } from "../mobile/images";
import { customPhotoWorkflows } from "../../../../../config/photo-workflows";
import { t } from "../../../../../packages/config/src/copy";
import { z } from "zod";
import {
  agentConfig,
  type FeatureId,
} from "../../../../../packages/config/src/public";
import type { ChatInput, ChatProgress } from "../mobile/conversation";
import { requireFeature } from "../policy/capabilities";
import { callArvivaTool } from "../mcp/client";
import { mobileProducts } from "../mcp/products";
import { productIdSchema } from "../mcp/identity";
import { roomPreviewReply } from "../mobile/room-preview";
export type PhotoResult = {
  previewImage?: ChatPhoto;
  content: string;
  products: ReturnType<typeof mobileProducts>;
  checkoutLinks: never[];
  mode: string;
};
export type PhotoWorkflow = {
  id: string;
  intentGuidance: string;
  requiredFeatures: FeatureId[];
  matches: (text: string) => boolean;
  inputSchema: z.ZodType<ChatInput>;
  outputSchema: z.ZodType<unknown>;
  run: (input: ChatInput, progress: ChatProgress) => Promise<unknown>;
};
const custom = new Map<string, PhotoWorkflow>();
const outputSchema = z.object({
  content: z.string().min(1).max(1800),
  products: z.array(z.object({ id: productIdSchema })).max(8),
  checkoutLinks: z.array(z.never()).max(0),
  previewImage: photoSchema.optional(),
});
export function registerPhotoWorkflow(workflow: PhotoWorkflow) {
  if (
    ["room-preview", "similar", "complementary"].includes(workflow.id) ||
    custom.has(workflow.id)
  )
    throw Error(t("backend.ccf05cbd3a"));
  custom.set(workflow.id, workflow);
}
export function routePhotoWorkflow(
  text: string,
  enabled: string[],
): { id: string } | { clarify: true } {
  const matches = enabled.filter((id) =>
    id === "room-preview"
      ? /\b(?:show|preview|place|mock.?up|look like)\b/i.test(text)
      : id === "similar"
        ? /\b(?:similar|match|like this|identify)\b/i.test(text)
        : id === "complementary"
          ? /\b(?:complement|goes with|pair|coordinate|decorate)\b/i.test(text)
          : custom.get(id)?.matches(text) || false,
  );
  if (matches.length === 1) return { id: matches[0] };
  if (enabled.length === 1) return { id: enabled[0] };
  return { clarify: true };
}
export async function runPhotoWorkflow(
  id: string,
  input: ChatInput,
  progress: ChatProgress,
): Promise<unknown> {
  requireFeature("uploads");
  const photos = input.messages.flatMap((message) => message.images || []);
  if (
    photos.some(
      (photo) =>
        !progress.photoOwnerId || photo.ownerId !== progress.photoOwnerId,
    )
  )
    throw Error("This photo belongs to another session. Attach it again.");
  if (!agentConfig.agent.photoWorkflows.includes(id))
    throw Error(t("backend.5ef0756b13"));
  if (id === "room-preview") {
    requireFeature("roomPreviews");
    return roomPreviewReply(input, progress);
  }
  if (id === "similar" || id === "complementary") return undefined; // Continue through verified conversational shopping.
  const workflow = custom.get(id);
  if (!workflow) throw Error(t("backend.4cb10c98b9"));
  workflow.requiredFeatures.forEach((feature) => requireFeature(feature));
  const validatedInput = workflow.inputSchema.parse(input);
  const raw = outputSchema.parse(
    workflow.outputSchema.parse(await workflow.run(validatedInput, progress)),
  );
  if (raw.previewImage && raw.previewImage.ownerId !== progress.photoOwnerId)
    throw Error("A preview must belong to the current customer.");
  const products = raw.products.length
    ? mobileProducts(
        await callArvivaTool(
          "get_products",
          { productIds: raw.products.map((p) => p.id) },
          progress.signal,
          progress.commerce,
        ),
      )
    : [];
  if (products.length !== raw.products.length)
    throw Error(t("backend.9ac110b621"));
  return { ...raw, products, mode: "photo-" + id };
}
export function photoGuidance(selected?: string) {
  return eligiblePhotoWorkflows()
    .filter((id) => !selected || id === selected)
    .map(
      (id) =>
        custom.get(id)?.intentGuidance ||
        (id === "similar"
          ? t("backend.f4c5f754fd")
          : id === "complementary"
            ? t("backend.e42209cd9e")
            : t("backend.2c554dd333")),
    )
    .join("\n");
}

for (const workflow of customPhotoWorkflows) registerPhotoWorkflow(workflow);

export function eligiblePhotoWorkflows(): string[] {
  return agentConfig.features.uploads
    ? agentConfig.agent.photoWorkflows.filter(
        (id) => id !== "room-preview" || agentConfig.features.roomPreviews,
      )
    : [];
}
export function photoWorkflowLabel(id: string): string {
  return id === "similar"
    ? "find similar products"
    : id === "complementary"
      ? "find complementary products"
      : id === "room-preview"
        ? "create an available product preview"
        : custom.get(id)?.intentGuidance || id;
}
