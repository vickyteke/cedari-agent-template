import { agentConfig } from "../../../../../packages/config/src/public";
export function supportedPreviewKind(product: {
  title: string;
  product_type: string | null;
}): "wall" | "rug" | null {
  const category = product.product_type?.normalize("NFKC").trim().toLowerCase();
  if (!category) return null;
  const reviewed = agentConfig.agent.previewCategories;
  if (reviewed.rugs.some((value) => value.toLowerCase() === category))
    return "rug";
  if (reviewed.wall.some((value) => value.toLowerCase() === category))
    return "wall";
  return null;
}
