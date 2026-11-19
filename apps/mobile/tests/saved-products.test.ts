import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refreshSavedProducts} from '../src/lib/saved-products.ts';
test('saved_cards_use_fresh_scoped_results_and_exclude_disallowed_ids',async()=>{
 const calls:string[][]=[];
 const result=await refreshSavedProducts(['allowed','removed'],async ids=>{calls.push(ids);return [{id:'allowed',price:20}];});
 assert.deepEqual(result.products,[{id:'allowed',price:20}]);
 assert.deepEqual(result.missingIds,['removed']);
 assert.equal(calls.length,1);
});
test('large_saved_collections_use_bounded_lookup_batches',async()=>{
 const calls:string[][]=[];
 await refreshSavedProducts(Array.from({length:20},(_,i)=>String(i)),async ids=>{calls.push(ids);return ids.map(id=>({id}));});
 assert.deepEqual(calls.map(ids=>ids.length),[8,8,4]);
});
