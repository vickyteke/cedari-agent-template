import { expect, it } from 'vitest';
import { checkoutColors, requestedProductColors } from '@/lib/variant-colors';
it.each([
  ['Show me dark wall paintings that look good on grey walls', []],
  ['Art for walls that are grey', []],
  ['A beige curtain for grey walls', ['beige']],
  ['Show me white wall art', ['white']],
  ['A green painting to match my grey sofa', ['green']],
])('distinguishes product colors from room context: %s', (text, expected) => expect(requestedProductColors(text)).toEqual(expected));
it('clears curtain color constraints when moving to wall paintings', () => {
  expect(checkoutColors([{ role: 'user', content: 'Show me beige curtains' }, { role: 'user', content: 'Show me wall paintings for grey walls' }, { role: 'user', content: 'Create checkout for the first one' }])).toEqual([]);
});
it('preserves an explicit variant color through follow-up checkout', () => {
  expect(checkoutColors([{ role: 'user', content: 'Show me beige curtains for grey walls' }, { role: 'user', content: 'Show me more options' }, { role: 'user', content: 'Checkout the first one' }])).toEqual(['beige']);
});
