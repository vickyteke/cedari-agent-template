import {t} from "../../../../../packages/config/src/copy";
import { agentConfig } from "../../../../../packages/config/src/public";
import { routePhotoWorkflow, runPhotoWorkflow } from "../photo-workflows/registry";
import { assertRequestCapabilities } from "../policy/capabilities";
import { roomPreviewReply } from "./room-preview";
import { callArvivaTool } from "../mcp/client";
import { mobileProducts } from "../mcp/products";
import { wantsMoreResults, fallbackSearch, matchesInspiration } from "./shopping-intent";
import { conversationalReply, MAX_RECOMMENDATIONS, type ChatInput, type ChatProgress } from "./conversation";
export { chatInput } from "./conversation";

export async function shoppingReply(input: ChatInput, progress: ChatProgress = {}) {
  assertRequestCapabilities(input);
  const last=input.messages.at(-1)!;
  const previous=input.messages.at(-2);
  let preview;
  if(previous?.previewContext) preview=await roomPreviewReply(input,progress);
  else if(last.images?.length) {
    const intent=routePhotoWorkflow(last.content,agentConfig.agent.photoWorkflows);
    if('clarify' in intent) return {content:t("backend.72b8d9c969"),products:[],checkoutLinks:[],mode:"photo-clarification"};
    progress={...progress,photoWorkflow:intent.id};
    preview=await runPhotoWorkflow(intent.id,input,progress);
  } else preview=await roomPreviewReply(input,progress);
  if (preview) return preview as Awaited<ReturnType<typeof roomPreviewReply>> & {};
  // A configured AI connection must actually work; do not silently disguise
  // authentication/billing failures as successful conversational responses.
  if (process.env.OPENAI_API_KEY) return conversationalReply(input, progress);
  if (input.messages.some(message => message.images?.length)) throw new Error(t("backend.7cdbe1669e"));
  const latest = [...input.messages].reverse().find(m => m.role === "user")!.content;
  const more = wantsMoreResults(latest);
  const context = more ? [...input.messages].reverse().find(message => message.role === "user" && !wantsMoreResults(message.content))?.content || latest : latest;
  const filters = fallbackSearch(context);
  const seen = [...new Set([...input.seenProductIds, ...input.messages.flatMap(message => message.productIds || [])])].slice(-500);
  const inspiration = null;
  const candidates = mobileProducts(await callArvivaTool("search_products", { ...filters, limit: inspiration ? 18 : filters.limit, distinctProducts: true, ...(more ? { excludeProductIds: seen } : {}) }, progress.signal, progress.commerce));
  const products = (inspiration ? candidates.filter(product => matchesInspiration(inspiration, product)) : candidates).slice(0, MAX_RECOMMENDATIONS);
  return {
    mode: "catalog",
    checkoutLinks: [],
    content: t("dynamic.230b4ac7fc",{value0: String(products.length ? t("backend.0de959d23b") : t("backend.0be500a074"))}),
    products,
  };
}
