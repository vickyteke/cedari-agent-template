import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homeRhymes, waitRhyme } from '../src/lib/chat-wait.ts';
test('keeps short waits quiet, then introduces a verse after eight seconds', () => {
  assert.equal(waitRhyme('turn-a', 7999, false), undefined);
  assert.ok(homeRhymes.includes(waitRhyme('turn-a', 8000, false)!));
});
test('keeps verses stable, changes only once, and never loops rapidly', () => {
  const first = waitRhyme('turn-a', 8000, false);
  assert.equal(waitRhyme('turn-a', 19999, false), first);
  const second = waitRhyme('turn-a', 20000, false);
  assert.notEqual(second, first);
  assert.equal(waitRhyme('turn-a', 60000, false), second);
});
test('stops rhymes permanently after the first reply text', () => {
  assert.equal(waitRhyme('turn-a', 12000, true), undefined);
  assert.equal(waitRhyme('turn-a', 45000, true), undefined);
});
