// A stream must end with an explicit validated completion. Partial replies are
// temporary UI state and must never be persisted as completed conversations.
export async function consumeChatStream<T>(
  body: ReadableStream<Uint8Array>,
  onText?: (text: string) => void,
  onStatus?: (status: string, phase?: "image" | "chat") => void,
): Promise<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        const event = JSON.parse(data);
        if (event.type === "error")
          throw new Error(
            event.error || "Could not finish the reply. Please try again.",
          );
        if (event.type === "text") onText?.(event.text);
        if (event.type === "status") onStatus?.(event.status, event.phase);
        if (event.type === "complete") return event.result as T;
      }
      if (buffer.length > 2000000) throw new Error("Unexpected chat response.");
      if (done)
        throw new Error("The connection was interrupted. Please try again.");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
