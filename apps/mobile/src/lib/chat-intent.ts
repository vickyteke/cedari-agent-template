export function chatRequestId(
  previous:
    { id: string; content: string; images?: { id: string }[] } | undefined,
  content: string,
  imageIds: string[],
  randomId: () => string,
): string {
  if (
    previous &&
    previous.content === content &&
    JSON.stringify(previous.images?.map((p) => p.id) || []) ===
      JSON.stringify(imageIds)
  )
    return previous.id;
  return randomId();
}
