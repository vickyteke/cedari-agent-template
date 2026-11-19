import {test} from 'node:test';
import assert from 'node:assert/strict';
import single from '../../../examples/single-merchant/config.ts';
import multi from '../../../examples/multi-category/config.ts';
import {availableTabs} from '../src/schema.ts';
import {t} from '../src/copy.ts';
test('two_distinct_examples_validate_without_screen_changes',()=>{
 assert.equal(single.assortment.merchants.mode,'allowlist');
 assert.equal(multi.assortment.categories.mode,'allowlist');
 assert.notEqual(single.brand.name,multi.brand.name);
 assert.equal(availableTabs(single).length,5);
});
test('message_interpolation_preserves_values',()=>assert.match(t('permission.photos'),/Arviva/));
