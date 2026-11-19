import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migratePreferences, validateAnswers, preferenceContext } from '../src/preferences.ts';
import { defaultConfig } from '../src/defaults.ts';
test('unknown_answers_survive_roundtrip',()=>{
 const p=migratePreferences({name:'A',preferences:'Likes blue',answers:{retired:'old',style:['minimal']}},defaultConfig);
 assert.equal(p.answers.retired,'old');
 assert.equal(p.name,'A');
 assert.match(preferenceContext(p,defaultConfig),/Likes blue/);
});
test('new_required_field_does_not_erase_completed_profile',()=>{
 const p=migratePreferences({name:'A',preferences:'Blue',answers:{size:'M'}},defaultConfig);
 assert.equal(p.answers.size,'M');
 assert.equal(p.preferences,'Blue');
});
test('required_and_changed_options_validate_without_destroying_answers',()=>{
 const fields=[{id:'size',label:'Size',type:'single' as const,required:true,options:[{id:'M',label:'Medium'}]}];
 assert.equal(validateAnswers({},fields).valid,false);
 assert.equal(validateAnswers({size:'M'},fields).valid,true);
 assert.equal(validateAnswers({size:'L'},fields).valid,false);
});
