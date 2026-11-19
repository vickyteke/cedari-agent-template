import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutResult } from '../src/lib/checkout-result.ts';

test('a checkout attempt only completes after receiving a valid merchant handoff', () => {
  assert.deepEqual(checkoutResult({ url: 'https://shop.example/checkout', merchant: 'A shop' }), { url: 'https://shop.example/checkout', merchant: 'A shop' });
  for (const raw of [null, {}, { error: 'Temporary failure' }, { url: 'javascript:alert(1)', merchant: 'Shop' }, { url: 'https://user:secret@shop.example', merchant: 'Shop' }, { url: 'http://shop.example', merchant: 'Shop' }, { url: 'https://shop.example', merchant: '' }]) {
    assert.throws(() => checkoutResult(raw), /could not be verified/);
  }
});
