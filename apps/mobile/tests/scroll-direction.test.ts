import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScrollDirection } from '../src/lib/scroll-direction.ts';
test('streaming and programmatic movement cannot hide navigation', () => {
  const direction = createScrollDirection();
  assert.equal(direction.observe(400, 500, 2000), undefined);
  assert.equal(direction.observe(900, 500, 2000), undefined);
});
test('uses separate down/up thresholds and ignores small reversals', () => {
  const direction = createScrollDirection();
  direction.observe(100, 500, 2000); direction.start();
  assert.equal(direction.observe(110, 500, 2000), undefined);
  assert.equal(direction.observe(125, 500, 2000), 'hide');
  assert.equal(direction.observe(120, 500, 2000), undefined);
  assert.equal(direction.observe(112, 500, 2000), 'show');
});
test('clamps bounce and shows bars at the top', () => {
  const direction = createScrollDirection();
  direction.observe(1500, 500, 2000); direction.start();
  assert.equal(direction.observe(1600, 500, 2000), undefined);
  assert.equal(direction.observe(0, 500, 2000), 'show');
  assert.equal(direction.observe(-30, 500, 2000), 'show');
});
test('does not react to layout changes during the bar animation', () => {
  const direction = createScrollDirection(); direction.start();
  assert.equal(direction.observe(100, 500, 2000, true), undefined);
  assert.equal(direction.observe(80, 500, 2000, true), undefined);
  assert.equal(direction.observe(85, 500, 2000), undefined);
});
test('short content stays stable and navigation reset clears gesture state', () => {
  const direction = createScrollDirection(); direction.start();
  assert.equal(direction.observe(100, 600, 300), undefined);
  direction.reset(); assert.equal(direction.observe(500, 500, 2000), undefined);
});
