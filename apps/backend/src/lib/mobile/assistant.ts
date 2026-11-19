import { roomPreviewReply } from "./room-preview";
import { callArvivaTool } from "../mcp/client";
import { mobileProducts } from "../mcp/products";
import { wantsMoreResults, fallbackSearch, inspirationKind, matchesInspiration } from "./shopping-intent";
import { conversationalReply, MAX_RECOMMENDATIONS, type ChatInput, type ChatProgress } from "./conversation";
export { chatInput } from "./conversation";

export async function shoppingReply(input: ChatInput, progress: ChatProgress = {}) {
  const preview = await roomPreviewReply(input, progress);
  if (preview) return preview;
  // A configured AI connection must actually work; do not silently disguise
  // authentication/billing failures as successful conversational responses.
  if (process.env.OPENAI_API_KEY) return conversationalReply(input, progress);
  if (input.messages.some(message => message.images?.length)) throw new Error("Photo recommendations need the AI connection. Please try again shortly.");
  const latest = [...input.messages].reverse().find(m => m.role === "user")!.content;
  const more = wantsMoreResults(latest);
  const context = more ? [...input.messages].reverse().find(message => message.role === "user" && !wantsMoreResults(message.content))?.content || latest : latest;
  const filters = fallbackSearch(context);
  const seen = [...new Set([...input.seenProductIds, ...input.messages.flatMap(message => message.productIds || [])])].slice(-500);
  const inspiration = inspirationKind(context);
  const candidates = mobileProducts(await callArvivaTool("search_products", { ...filters, limit: inspiration ? 18 : filters.limit, distinctProducts: true, ...(more ? { excludeProductIds: seen } : {}) }, progress.signal, progress.commerce));
  const products = (inspiration ? candidates.filter(product => matchesInspiration(inspiration, product)) : candidates).slice(0, MAX_RECOMMENDATIONS);
  return {
    mode: "catalog",
    checkoutLinks: [],
    content: `Let’s find something that feels right for your home.\n\n${products.length ? "These pieces might be a lovely place to start. Tap one for a closer look." : "I haven’t found the right match yet. Could you tell me a little more about the piece you have in mind, or try a wider budget?"}`,
    products,
  };
}
