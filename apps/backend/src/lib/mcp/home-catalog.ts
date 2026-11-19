import {t} from "../../../../../packages/config/src/copy";
// Arviva's assortment policy is independent of Cedari's multi-category catalog.
// Match reviewed categories, never product titles/descriptions or model output.
export const HOME_CATEGORIES = [
  'home', t("backend.1ab5c4f5c7"), t("backend.a7c68f4077"), 'home decor', 'home décor', 'home & décor',
  'furniture', 'lighting', 'lamps', 'table lamp', 'table lamps', 'floor lamps', t("backend.316dad2855"),
  t("backend.b31f98e041"), t("backend.c981f0dfd3"), 'floor lamp', t("backend.39266a087e"), 'chandelier', 'chandeliers',
  'wall lamp', 'wall lamps', 'wall sconce', 'wall sconces',
  'wall art', 'art', 'artwork', 'paintings', 'prints', 'wall decor', 'wall décor',
  t("backend.1a6d40205d"), 'wall accents', 'sculptures', t("backend.031622b86b"),
  'vases', 'mirrors', 'clocks', 'candles', t("backend.77e6d90261"), t("backend.8cb8d0111b"),
  'rugs', 'carpets', 'curtains', 'drapes', 'blinds', 'cushions', t("backend.90d15fd46b"),
  'pillows', t("backend.a0587e5ae0"), 'throws', 'blankets', 'bedding', 'bed linen', 'linens',
  t("backend.6b00211126"), 'textiles', 'bath', t("backend.3593945c01"), 'towels',
  'kitchen', t("backend.914ae1c6e6"), t("backend.d32cb7bbbd"), 'kitchenware', 'dining',
  'tableware', 'dinnerware', 'serveware', 'drinkware', 'glassware', 'cutlery',
  'table linen', 'table linens', t("backend.d1e5dd9bd7"), 'placemats', 'coasters',
  t("backend.5ecfef0d7f"), t("backend.464bd53049"), 'baskets', 'planters',
] as const;
const homeCategories = new Set<string>(HOME_CATEGORIES);
export function isHomeCategory(category: string) {
  const root = category.normalize('NFKC').toLowerCase().split(/\s*>\s*/)[0].replace(/\s+/g, ' ').trim();
  return homeCategories.has(root);
}
