import type { ProductSearch } from "../types";

const filler = new Set([
  "find",
  "some",
  "want",
  "need",
  "looking",
  "for",
  "the",
  "with",
  "please",
  "show",
  "help",
  "something",
  "would",
  "like",
  "could",
  "you",
  "can",
  "and",
  "that",
  "room",
  "budget",
]);
const productWords =
  /\b(?:rugs?|carpets?|cushions?|pillows?|throws?|blankets?|curtains?|drapes?|lamps?|lights?|lighting|chandeliers?|pendants?|lanterns?|sofas?|couches|chairs?|tables?|tableware|dinnerware|plates?|bowls?|cups?|glasses|vases?|mirrors?|prints?|posters?|coasters?|bedding|duvets?|sheets?)\b/i;
const modifiers =
  /\b(?:white|ivory|cream|beige|brown|black|blue|green|pink|red|orange|yellow|gray|grey|linen|cotton|velvet|wool|rattan|wood|wooden|ceramic|brass)\b/gi;

export function inspirationKind(text: string) {
  if (productWords.test(text)) return null;
  if (
    /\b(?:cozy|cozier|cosy|cosier|soft|softer)\b/i.test(text) &&
    /\bliving\s+room\b/i.test(text)
  )
    return "soft_furnishings";
  if (/\b(?:glow|ambient|ambience|ambiance|brighter|illuminate)\b/i.test(text))
    return "lighting";
  return null;
}
export function matchesInspiration(
  kind: NonNullable<ReturnType<typeof inspirationKind>>,
  product: { title: string; product_type: string | null },
) {
  // Description text can mention styling accessories that aren't the item sold.
  const identity = `${product.title} ${product.product_type || ""}`;
  return kind === "soft_furnishings"
    ? /\b(?:rugs?|carpets?|cushions?|pillows?|throws?|blankets?|curtains?|drapes?)\b/i.test(
        identity,
      )
    : /\b(?:lamps?|lights?|lighting|chandeliers?|pendants?|sconces?|lanterns?)\b/i.test(
        identity,
      );
}

export function fallbackSearch(text: string): ProductSearch {
  const maxPrice = text.match(
    /(?:under|below|up to|less than)\s*\$?\s*(\d+(?:\.\d+)?)/i,
  )?.[1];
  const request = text.replace(
    /(?:under|below|up to|less than)\s*\$?\s*\d+(?:\.\d+)?/gi,
    " ",
  );
  let query: string | undefined;
  // Mood/room suggestions are shopping intents, not literal product names.
  // Expand only broad inspiration requests; keep explicit product requests intact.
  const kind = inspirationKind(request);
  if (kind) {
    let categories: string[] = [];
    if (kind === "soft_furnishings")
      categories = ["rug", "cushion", "throw", "curtain"];
    else if (kind === "lighting")
      categories = ["lamp", "chandelier", "pendant"];
    if (categories.length) {
      const constraints = [
        ...new Set(
          (request.match(modifiers) || []).map((word) => word.toLowerCase()),
        ),
      ].join(" ");
      query = categories
        .map((category) => [constraints, category].filter(Boolean).join(" "))
        .join(" OR ");
    }
  }
  if (!query)
    query =
      request
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !filler.has(word))
        .slice(0, 8)
        .join(" ") || undefined;
  return {
    query,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    limit: 12,
  };
}

export function wantsMoreResults(text: string) {
  if (/\bmore (?:about|details|information|info)\b/i.test(text)) return false;
  return (
    /^\s*(?:more|next)(?:\s+please)?[.!?]*\s*$/i.test(text) ||
    /\b(?:show|find|see|list|want|have|any)\b.{0,35}\bmore\b|\bmore (?:results|options|pieces|products|curtains|rugs|lamps|cushions)\b|\b(?:alternatives|what else|other (?:options|ones|pieces|products)|next (?:page|batch|results)|another batch)\b/i.test(
      text,
    )
  );
}
