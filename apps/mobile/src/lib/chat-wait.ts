// Home styling notes are inspiration, never claims of progress.
// Keep the existing identifiers stable for callers and analytics.
export const homeRhymes = [
  "Texture adds depth. Consider how linen, wood and woven surfaces sit together in your space.",
  "Lighting sets the mood. Think about where you want a soft glow and where you need a clearer light.",
  "A considered palette leaves room for contrast: a sculptural shape, a subtle pattern or a warmer tone.",
  "Start with a piece you love, then let its colors and proportions guide the details around it.",
] as const;
export function waitRhyme(
  turn: string,
  elapsedMs: number,
  replyStarted: boolean,
) {
  if (replyStarted || elapsedMs < 8000) return undefined;
  const seed = [...turn].reduce(
    (value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0,
    0,
  );
  // At most two notes per turn; no rapidly cycling text or flashing spinner.
  const verse = Math.min(1, Math.floor((elapsedMs - 8000) / 12000));
  return homeRhymes[(seed + verse) % homeRhymes.length];
}
