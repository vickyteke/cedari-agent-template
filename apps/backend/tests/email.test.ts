import {agentConfig} from "../../../packages/config/src/public";
import { beforeEach,describe,expect,it,vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { editUrl,html,messageContent,safeUrl,tokenFor,validToken,validWebhookSignature } from '../src/lib/email/content';
import type { Product } from '../src/lib/types';
const mocks=vi.hoisted(()=>({admin:vi.fn(),tool:vi.fn(),user:vi.fn(),rate:vi.fn()}));
vi.mock('../src/lib/supabase',()=>({getSupabaseAdmin:mocks.admin}));
vi.mock('../src/lib/mcp/client',()=>({callArvivaTool:mocks.tool}));
vi.mock('../src/lib/mcp/products',()=>({mobileProducts:(value:unknown)=>value}));
vi.mock('../src/lib/mobile/http',async importOriginal=>({...await importOriginal<typeof import('../src/lib/mobile/http')>(),userFromRequest:mocks.user,rateLimit:mocks.rate}));
import { dispatchEmail,weeklyQuery,matchesEmailPreferences } from '../src/lib/email/service';
import { POST as emailEdit } from '../src/app/api/mobile/email-edit/route';
import { POST as webhook } from '../src/app/api/email/webhook/route';
const user='11111111-1111-4111-8111-111111111111',job='22222222-2222-4222-8222-222222222222';
const product=(id='33333333-3333-4333-8333-333333333333'):Product=>({id,store_key:'merchant',shopify_product_id:id,shopify_variant_id:'1',handle:'curtain',title:'Beige curtain',description:null,vendor:'A shop',product_type:'Curtains',tags:[],price:125,compare_at_price:null,currency:'USD',available:true,inventory_quantity:3,image_url:'https://cdn.example.com/beige.jpg',product_url:'https://shop.example.com/beige',variant_title:'Beige',updated_at:''});
let status:string,claimCount:number,updates:Record<string,unknown>[],pref:{welcome_enabled:boolean;weekly_enabled:boolean;suppressed:boolean};
beforeEach(()=>{
 agentConfig.features.email=true;
 vi.clearAllMocks();vi.unstubAllEnvs();vi.stubEnv('EMAIL_ENABLED','true');vi.stubEnv('EMAIL_TOKEN_SECRET','t'.repeat(48));vi.stubEnv('EMAIL_POSTAL_ADDRESS','123 Example Avenue');vi.stubEnv('MAILGUN_API_KEY','test-api-key');vi.stubEnv('MAILGUN_DOMAIN','mg.example.com');vi.stubEnv('MAILGUN_FROM','Agent <hello@agent.example>');vi.stubEnv('MAILGUN_WEBHOOK_SIGNING_KEY','test-signing-key');
 status='pending';claimCount=0;updates=[];pref={welcome_enabled:true,weekly_enabled:true,suppressed:false};
 mocks.user.mockResolvedValue({id:user,email_confirmed_at:'2026-01-01'});mocks.rate.mockResolvedValue(true);mocks.tool.mockResolvedValue([product()]);
 mocks.admin.mockImplementation(()=>({auth:{admin:{getUserById:vi.fn().mockResolvedValue({data:{user:{id:user,email:'owner@example.com',email_confirmed_at:'2026-01-01',is_anonymous:false}},error:null})}},rpc:vi.fn(async name=>{if(name==='claim_customer_email'){claimCount++;if(status!=='pending')return {data:[],error:null};status='processing';return {data:[{id:job,user_id:user,kind:'edit',payload:{productIds:[product().id]},status}],error:null};}return {data:null,error:null};}),from:(table:string)=>{
 let update:Record<string,unknown>|undefined;
 const result=()=>{if(update){updates.push(update);if(table==='customer_email_jobs'&&update.status)status=String(update.status);return {data:null,error:null};}return {data:table==='shopper_state'?{state:{profile:{name:'Alex',preferences:''},saved:{},viewed:{}}}:table==='customer_email_preferences'?pref:{status},error:null};};
 const chain={select:()=>chain,eq:()=>chain,in:()=>chain,upsert:()=>chain,update:(value:Record<string,unknown>)=>{update=value;return chain;},single:async()=>result(),maybeSingle:async()=>result(),then:(resolve:(value:ReturnType<typeof result>)=>unknown)=>Promise.resolve(result()).then(resolve)};return chain;
 }}));
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({id:'mailgun-message'})));
});
describe('email privacy and links',()=>{
 it('escapes content and rejects unsafe schemes or local URLs',()=>{expect(html('<script>"')).toBe('&lt;script&gt;&quot;');for(const url of ['javascript:alert(1)','http://shop.example.com','https://localhost/a','https://127.0.0.1','https://user:pass@shop.example.com'])expect(safeUrl(url)).toBeNull();});
 it('signs links for a single purpose and identifier',()=>{const token=tokenFor('edit',job);expect(validToken('edit',job,token)).toBe(true);expect(validToken('unsubscribe',job,token)).toBe(false);expect(validToken('edit',user,token)).toBe(false);expect(validToken('edit',job,token.slice(1))).toBe(false);expect(editUrl(job)).toContain('https://agent.example/email/open?');});
 it('caps product cards, keeps the exact variant, and escapes merchant text',()=>{const p={...product(),title:'<img src=x onerror=alert(1)>',merchant_name:'<script>shop</script>'};const content=messageContent('edit','<Alex>',Array(8).fill(p),job,user);expect(content.html.match(/<article/g)).toHaveLength(5);expect(content.html).toContain('Beige');expect(content.html).toContain('beige.jpg');expect(content.html).not.toContain('<script>shop');expect(content.html).toContain('&lt;Alex&gt;');});
 it('does not send a generic weekly edit with no preferences or activity',()=>{expect(weeklyQuery({profile:{name:'Alex',preferences:''}})).toBeNull();expect(weeklyQuery({profile:{preferences:'Natural wood'},saved:{x:{active:true,updatedAt:2,product:{id:'x',title:'Lamp',product_type:'Lighting'}}}})).toBe('Lighting');});
});
describe('email authorization and delivery',()=>{
 it('rejects anonymous requests before touching the email service',async()=>{mocks.user.mockResolvedValue(null);expect((await emailEdit(new Request('http://localhost/api/mobile/email-edit',{method:'POST',body:'{}'}))).status).toBe(401);expect(mocks.tool).not.toHaveBeenCalled();});
 it('rejects client-supplied recipients and product details',async()=>{const response=await emailEdit(new Request('http://localhost/api/mobile/email-edit',{method:'POST',body:JSON.stringify({productIds:[product().id],requestId:job,to:'other@example.com'})}));expect(response.status).toBe(400);expect(mocks.tool).not.toHaveBeenCalled();});
 it('emails fresh selected variants only to the verified account address',async()=>{expect(await dispatchEmail(job)).toBe('sent');const init=vi.mocked(fetch).mock.calls[0][1]!;const form=init.body as FormData;expect(form.get('to')).toBe('owner@example.com');expect(form.get('html')).toContain('Beige curtain');expect(form.get('o:tracking-opens')).toBe('no');expect(mocks.tool.mock.calls[0][1]).toEqual({productIds:[product().id]});});
 it('never substitutes a different variant when the requested one is missing',async()=>{mocks.tool.mockResolvedValue([product('44444444-4444-4444-8444-444444444444')]);expect(await dispatchEmail(job)).toBe('skipped');expect(fetch).not.toHaveBeenCalled();});
 it('rechecks suppression immediately before sending',async()=>{pref.suppressed=true;expect(await dispatchEmail(job)).toBe('skipped');expect(fetch).not.toHaveBeenCalled();});
 it('allows only one sender to claim a job',async()=>{await Promise.all([dispatchEmail(job),dispatchEmail(job)]);expect(claimCount).toBe(2);expect(fetch).toHaveBeenCalledTimes(1);});
 it('does not automatically resend a message with an ambiguous provider outcome',async()=>{vi.mocked(fetch).mockRejectedValue(new Error('timeout'));expect(await dispatchEmail(job)).toBe('unknown');expect(await dispatchEmail(job)).toBe('unknown');expect(fetch).toHaveBeenCalledTimes(1);});
 it('does not call Mailgun while delivery is disabled',async()=>{vi.stubEnv('EMAIL_ENABLED','false');expect(await dispatchEmail(job)).toBe('pending');expect(mocks.admin).not.toHaveBeenCalled();});
});
it('honors palette words and explicitly excluded materials',()=>{expect(matchesEmailPreferences(product(),'beige and cream')).toBe(true);expect(matchesEmailPreferences({...product(),title:'Green leather curtain'},'no leather, beige')).toBe(false);expect(matchesEmailPreferences({...product(),title:'Green curtain'},'beige')).toBe(false);});
describe('Mailgun signatures',()=>{
 it('rejects unsigned and expired events',async()=>{expect((await webhook(new Request('http://localhost/api/email/webhook',{method:'POST',body:'{}'}))).status).toBe(400);const timestamp=String(Math.floor(Date.now()/1000)),token='a'.repeat(50),signature=createHmac('sha256','test-signing-key').update(timestamp+token).digest('hex');expect(validWebhookSignature(timestamp,token,signature)).toBe(true);expect(validWebhookSignature(timestamp,token,signature,Date.now()+600000)).toBe(false);expect(validWebhookSignature(timestamp,token,'0'.repeat(64))).toBe(false);});
});
