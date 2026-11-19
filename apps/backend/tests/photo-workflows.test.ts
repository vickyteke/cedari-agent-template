import {z} from 'zod';
import {chatInput} from '../src/lib/mobile/conversation';
import {it,expect,vi} from 'vitest';
import {routePhotoWorkflow, registerPhotoWorkflow, runPhotoWorkflow} from '../src/lib/photo-workflows/registry';
import {agentConfig} from '../../../packages/config/src/public';
it('ambiguous_intent_asks_without_paid_edit',()=>{
 expect(routePhotoWorkflow('Help with this photo',['complementary','similar'])).toEqual({clarify:true});
 expect(routePhotoWorkflow('Find similar products',['complementary','similar'])).toEqual({id:'similar'});
});
it('uploads_disabled_rejects_payload_before_provider',async()=>{
 const prior=agentConfig.features.uploads;
 agentConfig.features.uploads=false;
 await expect(runPhotoWorkflow('similar',{messages:[{role:'user',content:'Find similar',images:[{id:'00000000-0000-4000-8000-000000000001',ownerId:'00000000-0000-4000-8000-000000000002'}]}],preferences:'',seenProductIds:[]},{})).rejects.toThrow();
 agentConfig.features.uploads=prior;
});
it('custom_workflow_cannot_return_unscoped_products',async()=>{
 const run=vi.fn(async()=>({content:'Result',products:[{id:'made-up'}],checkoutLinks:[]}));
 registerPhotoWorkflow({id:'test-custom',intentGuidance:'A test',requiredFeatures:['uploads'],matches:text=>text==='Test',inputSchema:chatInput,outputSchema:z.unknown(),run});
 agentConfig.agent.photoWorkflows.push('test-custom');
 await expect(runPhotoWorkflow('test-custom',{messages:[{role:'user',content:'Test'}],preferences:'',seenProductIds:[]},{})).rejects.toThrow();
 agentConfig.agent.photoWorkflows=agentConfig.agent.photoWorkflows.filter(id=>id!=='test-custom');
});
