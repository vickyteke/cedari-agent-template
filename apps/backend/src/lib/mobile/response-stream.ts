import { t } from "../../../../../packages/config/src/copy";
// Read only the conversational string from partial structured output. Never
// display JSON, unfinished escape sequences, or unvalidated product/card data.
export function partialContent(json: string): string {
  const match = /(?:^\s*\{|,)\s*"content"\s*:\s*"/.exec(json);
  if (!match) return "";
  const start = match.index + match[0].length;
  let end = start;
  while (end < json.length) {
    if (json[end] === '"') break;
    if (json[end] === "\\") {
      const size = json[end + 1] === "u" ? 6 : 2;
      if (end + size > json.length) break;
      end += size;
    } else end++;
  }
  try {
    const value: string = JSON.parse(`"${json.slice(start, end)}"`);
    return /[\uD800-\uDBFF]$/.test(value) ? value.slice(0, -1) : value;
  } catch {
    return "";
  }
}

export async function readModelResponse(
  response: Response,
  onText?: (text: string) => void,
) {
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    return response.json();
  if (!response.body) throw new Error(t("backend.d5ca88631a"));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "",
    output = "";
  let completed: unknown;
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
        if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data);
        if (event.type === "response.output_text.delta") {
          output += event.delta;
          const text = partialContent(output);
          if (text) onText?.(text);
        }
        if (
          ["response.failed", "response.incomplete", "error"].includes(
            event.type,
          )
        )
          throw new Error(t("backend.cde4853aed"));
        if (event.type === "response.completed") completed = event.response;
      }
      if (done) break;
    }
    if (!completed) throw new Error(t("backend.abb9391521"));
    return completed;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
