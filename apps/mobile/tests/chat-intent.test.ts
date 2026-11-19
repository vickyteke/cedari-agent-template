import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chatRequestId} from '../src/lib/chat-intent.ts';
test('uncertain_chat_retry_reuses_original_request_id',()=>{
 const previous={id:'original',content:'Buy the third one',images:[{id:'photo'}]};
 assert.equal(chatRequestId(previous,'Buy the third one',['photo'],()=> 'new'),'original');
 assert.equal(chatRequestId(previous,'Buy the second one',['photo'],()=> 'new'),'new');
 assert.equal(chatRequestId(previous,'Buy the third one',[],()=> 'new'),'new');
});
