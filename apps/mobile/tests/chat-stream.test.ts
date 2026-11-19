import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumeChatStream } from '../src/lib/chat-stream.ts';
const frame = (event: unknown) => `data: ${JSON.stringify(event)}\r\n\r\n`;
function body(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
}
test('reads unicode, status, text and validated completion across arbitrary byte boundaries', async () => {
  const texts: string[] = [], statuses: string[] = [];
  const final = { content: 'Café 😊', products: [] };
  const result = await consumeChatStream(body(frame({ type: 'status', status: 'Finding pieces for you…' }) + frame({ type: 'text', text: 'Café 😊' }) + frame({ type: 'complete', result: final })), text => texts.push(text), status => statuses.push(status));
  assert.deepEqual(result, final); assert.deepEqual(texts, ['Café 😊']); assert.deepEqual(statuses, ['Finding pieces for you…']);
});
test('never accepts a partial message as a completed reply', async () => {
  await assert.rejects(consumeChatStream(body(frame({ type: 'text', text: 'Partial' }))), /interrupted/);
  await assert.rejects(consumeChatStream(body(frame({ type: 'error', error: 'Please try again.' }))), /Please try again/);
});
test('cancels the connection after completion and propagates cancellation errors', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(frame({ type: 'complete', result: { content: 'Done' } }))); }, cancel() { cancelled = true; } });
  await consumeChatStream(stream); assert.equal(cancelled, true);
  await assert.rejects(consumeChatStream(new ReadableStream({ start(controller) { controller.error(new Error('Aborted')); } })), /Aborted/);
});

test('accepts a larger product-card completion split across network chunks', async () => {
  const result = { content: 'More options', products: Array.from({ length: 24 }, (_, index) => ({ id: index, description: 'x'.repeat(5000) })) };
  const bytes = new TextEncoder().encode(frame({ type: 'complete', result }));
  const stream = new ReadableStream<Uint8Array>({ start(controller) { for (let i = 0; i < bytes.length; i += 4096) controller.enqueue(bytes.slice(i, i + 4096)); controller.close(); } });
  assert.deepEqual(await consumeChatStream(stream), result);
});
