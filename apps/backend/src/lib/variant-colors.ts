import {t} from "../../../../packages/config/src/copy.ts";
// Only known literal colors enter the database filter, never arbitrary query text.
const colors = ['beige','ivory','cream','white','black','green','blue','red','pink','yellow','orange','brown','gray','grey','purple','teal','taupe','burgundy','navy'] as const;
export function requestedColors(query: string = '') {
  const positive = query.toLowerCase().replace(/(?:\bnot\s+|-)(?:dark\s+|light\s+|deep\s+)?\w+/g, '');
  return colors.filter(color => new RegExp(`\\b${color}\\b`).test(positive));
}
export function variantColorFilter(query: string) {
  return requestedColors(query).flatMap(color => [
    `variant_title.ilike.%${color}%`,
    t("dynamic.048588d267",{value0: String(color)}),
  ]).join(',');
}

/** Room context is not a product variant constraint ("art for grey walls"). */
export function requestedProductColors(text: string) {
  const color = `(?:${colors.join('|')})`;
  const roomContext = text.toLowerCase()
    .replace(new RegExp(`\\b${color}\\s+(?:painted\\s+)?walls?\\b(?!\\s+(?:art|paintings?|prints?|hangings?)\\b)`, 'g'), '')
    .replace(new RegExp(`\\bwalls?\\s+(?:(?:that\\s+)?(?:are|is|painted)\\s+){0,2}(?:dark\\s+|light\\s+)?${color}\\b`, 'g'), '')
    .replace(/\b(?:to match|to go with|that (?:will )?(?:look|looks) good (?:on|against)|against my)\b[^.!?]*/g, '');
  return requestedColors(roomContext);
}
export function checkoutColors(messages: readonly { role: string; content: string }[]) {
  let selected: string[] = [];
  for (const message of messages) {
    if (message.role !== 'user') continue;
    const explicit = requestedProductColors(message.content);
    if (explicit.length) selected = explicit;
    else if (!/\b(?:checkout|cart|buy|order)\b/i.test(message.content)
      && /\b(?:show|find|looking|shop|want|need)\b/i.test(message.content)
      && /\b(?:curtains?|rugs?|cushions?|sofas?|lamps?|paintings?|prints?|wall art|tableware|bedding|chairs?|tables?)\b/i.test(message.content)) selected = [];
  }
  return selected;
}
