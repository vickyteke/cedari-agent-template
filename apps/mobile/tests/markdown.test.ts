import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatMarkdown, safeChatLink } from '../src/lib/markdown.ts';
test('recognizes formatted headings, nested emphasis, numbered and bulleted lists', () => {
  const result = chatMarkdown('## Your space\n\n**Warm _linen_** curtains.\n\n1. First\n2. Second\n\n- Cotton\n- Velvet');
  assert.equal(result[0].kind, 'heading');
  assert.equal(result[1].content?.[0].kind, 'strong');
  assert.equal(result[1].content?.[0].children?.[1].kind, 'em');
  assert.equal(result[2].kind, 'list'); assert.equal(result[2].ordered, true);
  assert.equal(result[2].items?.length, 2); assert.equal(result[3].ordered, false);
});
test('handles streaming prefixes, code, quotes and comparison tables', () => {
  const message = '**Soft** linen\n\n> A lovely choice\n\n`cotton`\n\n| Piece | Material |\n| --- | --- |\n| Curtain | Linen |';
  for (let index = 0; index <= message.length; index++) assert.doesNotThrow(() => chatMarkdown(message.slice(0, index)));
  assert.ok(chatMarkdown(message).some(block => block.kind === 'table'));
});
test('does not execute HTML, load images, or activate unsafe URLs', () => {
  assert.equal(safeChatLink('javascript:alert(1)'), undefined);
  assert.equal(safeChatLink('file:///etc/passwd'), undefined);
  assert.equal(safeChatLink('https://user:password@example.com'), undefined);
  assert.equal(safeChatLink('https://hashtini.com/products/rug'), undefined);
  const text = JSON.stringify(chatMarkdown('![Photo](https://tracker.example/pixel)\n\n<script>alert(1)</script>'));
  assert.ok(!text.includes('tracker.example')); assert.ok(text.includes('<script>'));
});
