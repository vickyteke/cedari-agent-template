export async function refreshSavedProducts<T extends { id: string }>(
  ids: string[],
  read: (ids: string[]) => Promise<T[]>,
): Promise<{ products: T[]; missingIds: string[] }> {
  const products = new Map<string, T>();
  const unique = [...new Set(ids)];
  for (let index = 0; index < unique.length; index += 8) {
    const batch = unique.slice(index, index + 8);
    const found = await read(batch);
    for (const product of found)
      if (batch.includes(product.id)) products.set(product.id, product);
  }
  return {
    products: unique.flatMap((id) => products.get(id) || []),
    missingIds: unique.filter((id) => !products.has(id)),
  };
}
