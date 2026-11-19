import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutAttempts, prepareCheckoutAttempt } from '../src/lib/checkout-attempt.ts';
import { ApiError } from '../src/lib/api-error.ts';

test('concurrent requests and restarts reuse a persisted uncertain checkout key', async () => {
  const values = new Map<string, string>(); let next = 0;
  const storage = { getItem: async (key: string) => values.get(key) || null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } };
  const make = () => checkoutAttempts(storage, () => `attempt-${++next}`);
  const first = make();
  assert.deepEqual(await Promise.all([first.get('selection-a'), first.get('selection-a')]), ['attempt-1', 'attempt-1']);
  const restarted = make();
  assert.equal(await restarted.get('selection-a'), 'attempt-1');
  assert.equal(await restarted.get('selection-b'), 'attempt-2');
  await restarted.complete('selection-a', 'attempt-1');
  assert.equal(await restarted.get('selection-a'), 'attempt-3');
});

test('a late completion cannot remove the next uncertain checkout attempt', async () => {
  const values = new Map<string, string>(); let next = 0;
  const storage = { getItem: async (key: string) => values.get(key) || null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } };
  const attempts = checkoutAttempts(storage, () => `attempt-${++next}`);
  const original = await attempts.get('selection');
  await attempts.complete('selection', original);
  const fresh = await attempts.get('selection');
  await attempts.complete('selection', original);
  assert.equal(await attempts.get('selection'), fresh);
  assert.equal(values.get('selection'), 'attempt-2');
});

test('completion and a new request serialize their storage mutations', async () => {
  const values = new Map<string, string>(); let next = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const storage = { getItem: async (key: string) => values.get(key) || null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { await gate; values.delete(key); } };
  const attempts = checkoutAttempts(storage, () => `attempt-${++next}`);
  const original = await attempts.get('selection');
  const completed = attempts.complete('selection', original);
  const fresh = attempts.get('selection');
  release();
  await completed;
  assert.equal(await fresh, 'attempt-2');
});

test('storage failures prevent checkout from receiving an unpersisted attempt key', async () => {
  const attempts = checkoutAttempts({ getItem: async () => null, setItem: async () => { throw new Error('Storage full'); }, removeItem: async () => {} }, () => 'attempt-a');
  await assert.rejects(attempts.get('selection'), /Storage full/);
  await assert.rejects(attempts.get('selection'), /Storage full/);
});

test('network failures and malformed successful responses preserve the attempt for retry', async () => {
  const values = new Map<string, string>(); let next = 0;
  const storage = { getItem: async (key: string) => values.get(key) || null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } };
  const attempts = checkoutAttempts(storage, () => `attempt-${++next}`);
  const seen: string[] = [];
  await assert.rejects(prepareCheckoutAttempt(attempts, 'selection', async key => { seen.push(key); throw new Error('Network timeout'); }), /timeout/);
  await assert.rejects(prepareCheckoutAttempt(attempts, 'selection', async key => { seen.push(key); return {}; }), /could not be verified/);
  await prepareCheckoutAttempt(attempts, 'selection', async key => { seen.push(key); return { url: 'https://shop.example/checkout', merchant: 'Shop' }; });
  assert.deepEqual(seen, ['attempt-1', 'attempt-1', 'attempt-1']);
  assert.equal(values.size, 0);
});

test('only a definitive expired-session response releases an unsuccessful attempt', async () => {
  const values = new Map<string, string>(); let next = 0;
  const storage = { getItem: async (key: string) => values.get(key) || null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } };
  const attempts = checkoutAttempts(storage, () => `attempt-${++next}`);
  await assert.rejects(prepareCheckoutAttempt(attempts, 'selection', async () => { throw new ApiError('Try later', 'upstream_error'); }));
  assert.equal(await attempts.get('selection'), 'attempt-1');
  await assert.rejects(prepareCheckoutAttempt(attempts, 'selection', async () => { throw new ApiError('Expired', 'provider_checkout_not_found'); }));
  assert.equal(await attempts.get('selection'), 'attempt-2');
});
