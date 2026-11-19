export const stores: { key: string; name: string; storefrontDomain: string }[] = [];
export function getStore(key: string) { return stores.find(store => store.key === key); }
