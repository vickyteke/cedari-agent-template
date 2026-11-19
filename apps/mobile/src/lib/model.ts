export type Product = {
  id: string; store_key: string; title: string; description: string | null;
  price: number; currency: string; available: boolean; image_url: string | null;
  product_url: string | null; variant_title: string | null; product_type: string | null;
  shopify_variant_id?: string; updated_at: string;
  listing_id?: string; variant_id?: string; merchant_name?: string;
  variant_options?: Record<string, string>; variant_count?: number;
};
export const stores = [
  { key: 'affirm_effect', name: 'Affirm Effect' }, { key: 'hashtini', name: 'Hashtini' },
  { key: 'chaos_by_order', name: 'Chaos by Order' }, { key: 'maison_couvert', name: 'Maison Couvert' },
  { key: 'dusk_and_drape', name: 'Dusk & Drape' },
];
export const storeName = (key: string) => stores.find(s => s.key === key)?.name || key;
export const merchantName = (product: Product) => product.merchant_name || storeName(product.store_key);
export const price = (p: Product) => new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency }).format(Number(p.price));
export type CheckoutLink = { url: string; merchant: string; storeKey: string; items: { productId: string; title: string; imageUrl?: string | null; variant: string | null; quantity: number; price: number; currency: string }[] };
export type ChatPhoto = { id: string; ownerId: string };
export type Message = { id: string; role: 'user' | 'assistant'; content: string; images?: ChatPhoto[]; previewImage?: ChatPhoto; previewContext?: string; products?: Product[]; checkoutLinks?: CheckoutLink[]; mode?: string; createdAt: number };
export type Conversation = { id: string; title: string; messages: Message[]; updatedAt: number; deletedAt?: number };
type Saved = { product: Product; active: boolean; updatedAt: number };
type BagItem = { product: Product; quantity: number; updatedAt: number };
export type ShopperState = {
  schema: 1; historyClearedAt: number; profile: { name: string; preferences: string; updatedAt: number };
  saved: Record<string, Saved>; bag: Record<string, BagItem>;
  conversations: Record<string, Conversation>; viewed: Record<string, { product: Product; updatedAt: number }>;
};
export const emptyState = (): ShopperState => ({ schema: 1, historyClearedAt: 0, profile: { name: '', preferences: '', updatedAt: 0 }, saved: {}, bag: {}, conversations: {}, viewed: {} });
function mergeTimed<T extends { updatedAt: number }>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
  const result = { ...a };
  for (const [key, value] of Object.entries(b)) if (!result[key] || value.updatedAt >= result[key].updatedAt) result[key] = value;
  return result;
}
export function mergeState(a: ShopperState, b: ShopperState): ShopperState {
  const historyClearedAt = Math.max(a.historyClearedAt || 0, b.historyClearedAt || 0);
  const conversations = mergeTimed(a.conversations, b.conversations);
  for (const key of Object.keys(conversations)) {
    const left = a.conversations[key], right = b.conversations[key];
    if (left && right) {
      const messages = new Map([...left.messages, ...right.messages].map(m => [m.id, m]));
      conversations[key] = { ...conversations[key], messages: [...messages.values()].sort((x, y) => x.createdAt - y.createdAt), deletedAt: Math.max(left.deletedAt || 0, right.deletedAt || 0) || undefined };
    }
    if (conversations[key].deletedAt || conversations[key].updatedAt <= historyClearedAt) conversations[key] = { ...conversations[key], deletedAt: conversations[key].deletedAt || historyClearedAt, messages: [] };
  }
  return { schema: 1, historyClearedAt, profile: b.profile.updatedAt >= a.profile.updatedAt ? b.profile : a.profile,
    saved: mergeTimed(a.saved, b.saved), bag: mergeTimed(a.bag, b.bag),
    viewed: Object.fromEntries(Object.entries(mergeTimed(a.viewed, b.viewed)).filter(([, v]) => v.updatedAt > historyClearedAt).sort(([, x], [, y]) => y.updatedAt - x.updatedAt).slice(0, 80)), conversations };
}
export function parseState(raw: unknown): ShopperState {
  const value = raw as ShopperState;
  if (!value || value.schema !== 1 || !value.profile || !value.saved || !value.bag || !value.conversations || !value.viewed) throw new Error('Unrecognized saved data');
  return value;
}
export function groupBag(state: ShopperState) {
  const result: Record<string, BagItem[]> = Object.create(null);
  for (const item of Object.values(state.bag)) if (item.quantity > 0) (result[item.product.store_key] ||= []).push(item);
  return result;
}
