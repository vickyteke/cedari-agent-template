import { describe, expect, it, vi } from "vitest";
import { readMcpResponse } from "@/lib/mcp/response";

describe("MCP response framing", () => {
  it("returns the matching SSE result without waiting for the server to close", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"jsonrpc":"2.0","method":"notifications/progress"}\n\ndata: {"jsonrpc":"2.0","id":"wanted","result":{"ok":true}}\n\n'));
    }, cancel });
    expect(await readMcpResponse(new Response(stream, { headers: { "content-type": "text/event-stream" } }), "wanted", AbortSignal.timeout(200))).toEqual({ ok: true });
    expect(cancel).toHaveBeenCalled();
  });
  it("preserves UTF-8 and CRLF framing across arbitrary byte boundaries", async () => {
    const data = ': ping\r\n\r\ndata: {"jsonrpc":"2.0","id":"other","result":{}}\r\n\r\ndata: {"jsonrpc":"2.0","id":"wanted",\r\ndata: "result":{"title":"Café 🌿"}}\r\n\r\n';
    const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of new TextEncoder().encode(data)) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
    expect(await readMcpResponse(new Response(stream, { headers: { "content-type": "text/event-stream" } }), "wanted", AbortSignal.timeout(1000))).toEqual({ title: "Café 🌿" });
  });
  it("does not await an unresponsive stream cancellation", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"jsonrpc":"2.0","id":"wanted","result":{}}\n\n')); }, cancel() { return new Promise(() => {}); } });
    expect(await readMcpResponse(new Response(stream, { headers: { "content-type": "text/event-stream" } }), "wanted", AbortSignal.timeout(100))).toEqual({});
  });
  it("cancels a stalled body when its caller aborts", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); }, cancel });
    const abort = new AbortController();
    const result = readMcpResponse(new Response(stream), "wanted", abort.signal);
    abort.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalled();
  });
  it("bounds a chunked response and cancels the remaining body", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(4_000_001)); }, cancel });
    await expect(readMcpResponse(new Response(stream), "wanted", AbortSignal.timeout(1000))).rejects.toThrow("size limit");
    expect(cancel).toHaveBeenCalled();
  });
  it("rejects an advertised oversized response before reading it", async () => {
    const pull = vi.fn(), cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
    await expect(readMcpResponse(new Response(stream, { headers: { "content-length": "5000000" } }), "wanted", AbortSignal.timeout(1000))).rejects.toThrow("response size");
    expect(pull).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalled();
  });
  it.each([
    { jsonrpc: "2.0", id: "other", result: {} },
    { jsonrpc: "1.0", id: "wanted", result: {} },
    { jsonrpc: "2.0", id: "wanted", error: { message: "Do not expose this body" } },
    { jsonrpc: "2.0", id: "wanted" },
  ])("rejects incomplete or invalid JSON-RPC envelopes", async envelope => {
    await expect(readMcpResponse(Response.json(envelope), "wanted", AbortSignal.timeout(1000))).rejects.toThrow(/Shopping MCP/);
  });
  it("does not copy malformed provider data into error messages", async () => {
    await expect(readMcpResponse(new Response('private-provider-token is not JSON'), "wanted", AbortSignal.timeout(1000))).rejects.toThrow(/^Shopping MCP returned invalid JSON$/);
  });
});
