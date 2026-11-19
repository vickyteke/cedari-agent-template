import { test } from 'node:test';
import assert from 'node:assert/strict';
import { introductionForStorage, introductionFromProfile, introductionPreferences, parseIntroduction } from '../src/lib/onboarding.ts';
import { emptyState, mergeState } from '../src/lib/model.ts';

test('onboarding preferences round-trip through the existing profile without duplicating style lines', () => {
  const draft = { ...introductionFromProfile({ name: 'Alex', preferences: 'Natural wood, no leather.' }), styles: ['Modern Organic'], rooms: ['Bedroom'] };
  const preferences = introductionPreferences(draft);
  const reopened = introductionFromProfile({ name: draft.name, preferences });
  assert.deepEqual(reopened.styles, ['Modern Organic']);
  assert.deepEqual(reopened.rooms, ['Bedroom']);
  assert.equal(reopened.preferences, 'Natural wood, no leather.');
  assert.equal(introductionPreferences(reopened), preferences);
  reopened.styles = [];
  assert.ok(!introductionPreferences(reopened).includes('Modern Organic'));
});
test('partial onboarding survives storage and malformed progress cannot bypass the flow', () => {
  const draft = { ...introductionFromProfile({ name: '', preferences: '' }), step: 2, styles: ['Warm Minimalism'], rooms: ['Living room'] };
  assert.deepEqual(parseIntroduction(JSON.stringify(draft)), draft);
  assert.equal(parseIntroduction('{broken'), null);
  assert.equal(parseIntroduction(JSON.stringify({ ...draft, step: 7 })), null);
  assert.equal(parseIntroduction(JSON.stringify({ ...draft, completed: 'yes' })), null);
});
test('onboarding guest profile sync uses the same timestamp merge as profile edits', () => {
  const guest = emptyState(), account = emptyState();
  guest.profile = { name: 'Alex', preferences: 'Warm neutrals', updatedAt: 20 };
  account.profile = { name: 'Old', preferences: 'Old style', updatedAt: 10 };
  assert.deepEqual(mergeState(account, guest).profile, guest.profile);
});
test('completed onboarding retains only progress, without a duplicate of customer preferences', () => {
  const draft = { ...introductionFromProfile({ name: 'Alex', preferences: 'Natural wood' }), completed: true, styles: ['Modern Organic'], rooms: ['Bedroom'] };
  const stored = introductionForStorage(draft);
  assert.equal(stored.completed, true);
  assert.equal(stored.name, '');
  assert.equal(stored.preferences, '');
  assert.deepEqual(stored.styles, []);
  assert.deepEqual(stored.rooms, []);
  assert.equal(introductionForStorage({ ...draft, completed: false }).name, 'Alex');
});
