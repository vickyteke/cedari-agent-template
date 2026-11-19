import {t} from "../../../../../packages/config/src/copy";
const maximumBytes = 4_000_000;

function matchingResult(value: unknown, id: string): { result: unknown } | undefined {
  if (!value || typeof value !== "object" || !("id" in value) || value.id !== id) return;
  if (!("jsonrpc" in value) || value.jsonrpc !== "2.0" || "error" in value || !("result" in value)) throw new Error(t("backend.e121952551"));
  return { result: value.result };
}
function parse(text: string): unknown {
  try { return JSON.parse(text); }
  catch { throw new Error(t("backend.89ffdb63c4")); }
}

export async function readMcpResponse(response: Response, id: string, signal: AbortSignal): Promise<unknown> {
  if (!response.body || Number(response.headers.get("content-length")) > maximumBytes) {
    void response.body?.cancel().catch(() => {});
    throw new Error(t("backend.bda8205ddb"));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const streaming = response.headers.get("content-type")?.includes("text/event-stream");
  let text = "", bytes = 0;
  const event = (block: string) => {
    const data = block.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    return data ? matchingResult(parse(data), id) : undefined;
  };
  try {
    while (true) {
      signal.throwIfAborted();
      let cancel!: () => void;
      const aborted = new Promise<never>((_, reject) => {
        cancel = () => reject(signal.reason);
        signal.addEventListener("abort", cancel, { once: true });
      });
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try { chunk = await Promise.race([reader.read(), aborted]); }
      finally { signal.removeEventListener("abort", cancel); }
      if (chunk.value) {
        bytes += chunk.value.byteLength;
        if (bytes > maximumBytes) throw new Error(t("backend.4868ca6761"));
      }
      text += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
      if (streaming) {
        text = text.replace(/\r\n/g, "\n");
        let boundary: number;
        while ((boundary = text.indexOf("\n\n")) !== -1) {
          const found = event(text.slice(0, boundary));
          text = text.slice(boundary + 2);
          if (found) return found.result;
        }
        if (chunk.done && text.trim()) {
          const found = event(text);
          if (found) return found.result;
        }
      }
      if (chunk.done) {
        if (!streaming) {
          const found = matchingResult(parse(text), id);
          if (found) return found.result;
        }
        throw new Error(t("backend.f6c6607629"));
      }
    }
  } finally {
    // SSE hosts may keep the connection open after replying. Do not wait for
    // their final close or an unresponsive cancellation before returning data.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
