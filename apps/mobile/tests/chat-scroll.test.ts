import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatScrollFollow } from '../src/lib/chat-scroll.ts';
test('a tap pauses through later layout and programmatic scroll events', () => {
  const follow = createChatScrollFollow();
  assert.equal(follow.shouldFollow(), true);
  follow.touchStart(); follow.scroll(500, 500, 1000); follow.touchEnd();
  assert.equal(follow.shouldFollow(), false);
  follow.scroll(700, 500, 1200);
  assert.equal(follow.shouldFollow(), false);
});
test('reading earlier stays paused through dragging and momentum', () => {
  const follow = createChatScrollFollow();
  follow.touchStart(); follow.dragStart(); follow.scroll(100, 500, 1500);
  follow.dragEnd(100, 500, 1500); follow.momentumStart(); follow.scroll(50, 500, 1500);
  follow.momentumEnd(50, 500, 1500);
  assert.equal(follow.shouldFollow(), false);
});
test('returning to the bottom resumes only after the gesture finishes', () => {
  const follow = createChatScrollFollow();
  follow.touchStart(); follow.dragStart(); follow.scroll(500, 500, 1500); follow.scroll(1000, 500, 1500);
  assert.equal(follow.shouldFollow(), false);
  follow.dragEnd(1000, 500, 1500); follow.momentumStart();
  assert.equal(follow.shouldFollow(), false);
  follow.momentumEnd(1000, 500, 1500);
  assert.equal(follow.shouldFollow(), true);
});
test('Latest or a new message explicitly resumes following after a pause', () => {
  const follow = createChatScrollFollow();
  follow.touchStart(); follow.touchEnd(); follow.resume();
  assert.equal(follow.shouldFollow(), true);
});

test('touching during momentum cancels following even if a delayed end event arrives', () => {
  const follow = createChatScrollFollow();
  follow.dragStart(); follow.dragEnd(1000, 500, 1500); follow.momentumStart();
  follow.touchStart(); follow.touchEnd(); follow.momentumEnd(1000, 500, 1500);
  assert.equal(follow.shouldFollow(), false);
});

test('a tap and late drag-end at the old bottom cannot resume following', () => {
  const follow = createChatScrollFollow();
  follow.touchStart(); follow.dragStart(); follow.dragEnd(1000, 500, 1500);
  follow.momentumStart(); follow.momentumEnd(1000, 500, 1500);
  assert.equal(follow.shouldFollow(), false);
});
