export async function boundedMap<T, R>(items: readonly T[], operation: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(2, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await operation(items[index]); }
  }));
  return results;
}
