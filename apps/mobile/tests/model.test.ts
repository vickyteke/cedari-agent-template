import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, groupBag, mergeState, type Product } from '../src/lib/model.ts';
const product = (id: string, store = 'hashtini'): Product => ({ id, store_key: store, title: 'Lamp', description: null, price: 90, currency: 'USD', available: true, image_url: null, product_url: 'https://hashtini.com/products/lamp', variant_title: null, product_type: 'Lighting', shopify_variant_id: '123', updated_at: '' });
test('guest favorites merge with account favorites without reviving removed ones', () => {
  const cloud = emptyState(), guest = emptyState();
  cloud.saved.a = { product: product('a'), active: true, updatedAt: 1 };
  guest.saved.b = { product: product('b'), active: true, updatedAt: 3 };
  guest.saved.a = { product: product('a'), active: false, updatedAt: 2 };
  const result = mergeState(cloud, guest);
  assert.equal(result.saved.a.active, false); assert.equal(result.saved.b.active, true);
});
test('history clearing propagates across devices and cannot resurrect old chats', () => {
  const cloud = emptyState(), local = emptyState();
  cloud.viewed.a = { product: product('a'), updatedAt: 5 };
  cloud.conversations.c = { id: 'c', title: 'Living room', updatedAt: 5, messages: [{ id: 'm', content: 'hello', role: 'user', createdAt: 5 }] };
  local.historyClearedAt = 10;
  const merged = mergeState(cloud, local);
  assert.equal(Object.keys(merged.viewed).length, 0); assert.equal(merged.conversations.c.messages.length, 0); assert.equal(merged.conversations.c.deletedAt, 10);
});
test('concurrent conversation messages survive a sync merge and deduplicate', () => {
  const a = emptyState(), b = emptyState();
  a.conversations.c = { id: 'c', title: 'Room', updatedAt: 2, messages: [{ id: 'one', content: 'lamp', role: 'user', createdAt: 1 }] };
  b.conversations.c = { id: 'c', title: 'Room', updatedAt: 3, messages: [{ id: 'two', content: 'chairs', role: 'user', createdAt: 3 }] };
  const result = mergeState(a, b); assert.deepEqual(result.conversations.c.messages.map(m => m.id), ['one', 'two']); assert.deepEqual(mergeState(result, result), result);
});
test('bags stay separated by merchant and removed items stay removed', () => {
  const state = emptyState();
  state.bag.a = { product: product('a'), quantity: 2, updatedAt: 1 };
  state.bag.b = { product: product('b', 'affirm_effect'), quantity: 1, updatedAt: 1 };
  state.bag.c = { product: product('c'), quantity: 0, updatedAt: 2 };
  const groups = groupBag(state); assert.equal(Object.keys(groups).length, 2); assert.equal(groups.hashtini.length, 1); assert.equal(groups.hashtini[0].quantity, 2);
});

test('dynamic merchant IDs cannot collide with object prototype properties', () => {
  const state = emptyState();
  // Merchant IDs are arbitrary data; product IDs retain their opaque prefix.
  state.bag = Object.fromEntries(['constructor', '__proto__', 'toString'].map(id => [`product-${id}`, { product: product(`product-${id}`, id), quantity: 1, updatedAt: 1 }]));
  const groups = groupBag(state);
  assert.deepEqual(Object.keys(groups).sort(), ['__proto__', 'constructor', 'toString'].sort());
  assert.equal(groups.__proto__.length, 1);
  assert.equal(groups.constructor.length, 1);
});
