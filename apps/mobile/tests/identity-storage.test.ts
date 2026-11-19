import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerStateKey,onboardingKey,guestTransfer,mergeEditedAnswers} from '../src/lib/customer-storage.ts';
test('independent_guest_and_account_drafts_never_share_keys',()=>{
 assert.notEqual(customerStateKey('brand','guest-a'),customerStateKey('brand','guest-b'));
 assert.notEqual(onboardingKey('brand','user-a'),onboardingKey('brand','user-b'));
 assert.notEqual(onboardingKey('first','user-a'),onboardingKey('second','user-a'));
});
test('only_the_transitioning_guest_can_transfer_to_named_account',()=>{
 assert.equal(guestTransfer({id:'A',anonymous:false},{id:'B',anonymous:false}),null);
 assert.equal(guestTransfer({id:'guest-a',anonymous:true},{id:'guest-b',anonymous:true}),null);
 assert.equal(guestTransfer({id:'guest-a',anonymous:true},{id:'customer',anonymous:false}),'guest-a');
});
test('profile_save_preserves_answers_hydrated_after_editor_mount',()=>{
 assert.deepEqual(mergeEditedAnswers({style:['minimal'],size:'M'},{style:['classic']}),{style:['classic'],size:'M'});
});
test('deletion_purges_the_actual_customer_and_onboarding_keys',async()=>{
 const {removeCustomerData}=await import('../src/lib/customer-storage.ts');
 const removed:string[]=[];
 await removeCustomerData({removeItem:async key=>{removed.push(key);}},'brand','user-a');
 assert.deepEqual(removed,[customerStateKey('brand','user-a'),onboardingKey('brand','user-a')]);
});
