// Only a deliberate user scroll back to the bottom (or Latest) resumes following.
// Layout changes and programmatic scroll events cannot override a reader's pause.
export function createChatScrollFollow() {
  let following = true;
  let touching = false;
  let dragging = false;
  let momentum = false;
  let userGesture = false;
  let browsedEarlier = false;
  const nearBottom = (offset: number, viewport: number, content: number) => content - viewport - offset <= 48;
  return {
    shouldFollow: () => following && !touching && !dragging && !momentum,
    paused: () => !following,
    touchStart() { touching = true; following = false; dragging = false; momentum = false; userGesture = false; browsedEarlier = false; },
    touchEnd() { touching = false; },
    dragStart() { dragging = true; userGesture = true; following = false; },
    dragEnd(offset: number, viewport: number, content: number) {
      dragging = false; touching = false;
      if (userGesture && !nearBottom(offset, viewport, content)) browsedEarlier = true;
      if (userGesture && browsedEarlier) following = nearBottom(offset, viewport, content);
    },
    momentumStart() { if (userGesture) momentum = true; },
    momentumEnd(offset: number, viewport: number, content: number) {
      if (userGesture && momentum && browsedEarlier) following = nearBottom(offset, viewport, content);
      momentum = false; userGesture = false;
    },
    scroll(offset: number, viewport: number, content: number) {
      if (dragging || momentum) {
        if (!nearBottom(offset, viewport, content)) browsedEarlier = true;
        if (browsedEarlier) following = nearBottom(offset, viewport, content);
      }
    },
    resume() { following = true; touching = false; dragging = false; momentum = false; userGesture = false; browsedEarlier = false; },
  };
}
