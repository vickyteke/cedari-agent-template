// Arviva's assortment policy is independent of Cedari's multi-category catalog.
// Match reviewed categories, never product titles/descriptions or model output.
export const HOME_CATEGORIES = [
  'home', 'home & garden', 'home and garden', 'home decor', 'home décor', 'home & décor',
  'furniture', 'lighting', 'lamps', 'table lamp', 'table lamps', 'floor lamps', 'pendant lights',
  'ceiling light', 'ceiling lights', 'floor lamp', 'pendant light', 'chandelier', 'chandeliers',
  'wall lamp', 'wall lamps', 'wall sconce', 'wall sconces',
  'wall art', 'art', 'artwork', 'paintings', 'prints', 'wall decor', 'wall décor',
  'wall sculptures and accents', 'wall accents', 'sculptures', 'decorative objects',
  'vases', 'mirrors', 'clocks', 'candles', 'candle holders', 'home fragrance',
  'rugs', 'carpets', 'curtains', 'drapes', 'blinds', 'cushions', 'cushion covers',
  'pillows', 'throw pillows', 'throws', 'blankets', 'bedding', 'bed linen', 'linens',
  'home textiles', 'textiles', 'bath', 'bathroom accessories', 'towels',
  'kitchen', 'kitchen & dining', 'kitchen and dining', 'kitchenware', 'dining',
  'tableware', 'dinnerware', 'serveware', 'drinkware', 'glassware', 'cutlery',
  'table linen', 'table linens', 'table runners', 'placemats', 'coasters',
  'storage & organization', 'storage and organization', 'baskets', 'planters',
] as const;
const homeCategories = new Set<string>(HOME_CATEGORIES);
export function isHomeCategory(category: string) {
  const root = category.normalize('NFKC').toLowerCase().split(/\s*>\s*/)[0].replace(/\s+/g, ' ').trim();
  return homeCategories.has(root);
}
