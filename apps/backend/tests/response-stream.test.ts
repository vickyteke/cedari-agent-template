import { describe, it, expect } from "vitest";
import {
  partialContent,
  readModelResponse,
} from "@/lib/mobile/response-stream";
const frame = (event: unknown) => `data: ${JSON.stringify(event)}\r\n\r\n`;
function response(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}
describe("model reply streaming", () => {
  it("decodes partial JSON strings without leaking syntax or incomplete escapes", () => {
    expect(partialContent('{"content":"Hello \\u')).toBe("Hello ");
    expect(partialContent('{"content":"Hello \\uD83D')).toBe("Hello ");
    expect(
      partialContent(
        '{"content":"Hello \\uD83D\\uDE0A\\n\\"friend\\"", "productIds":[]}',
      ),
    ).toBe('Hello 😊\n"friend"');
  });
  it("emits text before the provider completes and preserves final output", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let emitted!: () => void;
    const first = new Promise<void>((resolve) => {
      emitted = resolve;
    });
    const final = { status: "completed", output: [] };
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            frame({
              type: "response.output_text.delta",
              delta: '{"content":"Hi there',
            }),
          ),
        );
        await gate;
        controller.enqueue(
          new TextEncoder().encode(
            frame({ type: "response.completed", response: final }),
          ),
        );
        controller.close();
      },
    });
    const result = readModelResponse(
      new Response(stream, {
        headers: { "content-type": "text/event-stream" },
      }),
      (text) => {
        expect(text).toBe("Hi there");
        emitted();
      },
    );
    await first;
    finish();
    expect(await result).toEqual(final);
  });
  it("handles byte boundaries, unicode and CRLF", async () => {
    const text: string[] = [];
    await readModelResponse(
      response(
        frame({
          type: "response.output_text.delta",
          delta: '{"content":"Café 😊"}',
        }) + frame({ type: "response.completed", response: { output: [] } }),
      ),
      (value) => text.push(value),
    );
    expect(text).toEqual(["Café 😊"]);
  });
  it("fails closed on interrupted and failed responses", async () => {
    await expect(
      readModelResponse(
        response(
          frame({
            type: "response.output_text.delta",
            delta: '{"content":"Hi',
          }),
        ),
      ),
    ).rejects.toThrow("interrupted");
    await expect(
      readModelResponse(response(frame({ type: "response.failed" }))),
    ).rejects.toThrow("failed");
  });
});
