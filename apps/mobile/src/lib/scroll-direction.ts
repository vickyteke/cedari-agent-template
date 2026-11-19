// Observe only user-controlled vertical scrolling. Ignore layout, streaming and
// bounce offsets so navigation does not flicker or disappear on its own.
export function createScrollDirection() {
  let active = false;
  let previous = 0;
  let distance = 0;
  return {
    start() { active = true; distance = 0; },
    end() { active = false; distance = 0; },
    reset() { active = false; previous = 0; distance = 0; },
    observe(y: number, viewport: number, content: number, animating = false): 'show' | 'hide' | undefined {
      const maximum = Math.max(0, content - viewport);
      const offset = Math.max(0, Math.min(y, maximum));
      const delta = offset - previous; previous = offset;
      if (!active || animating || maximum === 0) { distance = 0; return; }
      if (offset <= 8) { distance = 0; return 'show'; }
      if (Math.abs(delta) < 1) return;
      distance = Math.sign(delta) === Math.sign(distance) ? distance + delta : delta;
      if (distance >= 24) { distance = 0; return 'hide'; }
      if (distance <= -12) { distance = 0; return 'show'; }
    },
  };
}
