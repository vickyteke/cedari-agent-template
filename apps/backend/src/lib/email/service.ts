import {t} from "../../../../../packages/config/src/copy";
import { agentConfig } from "../../../../../packages/config/src/public";
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseAdmin } from '../supabase';
import { callArvivaTool } from '../mcp/client';
import { mobileProducts } from '../mcp/products';
import type { Product } from '../types';
import { fallbackSearch } from '../mobile/shopping-intent';
import { editUrl, messageContent, safeUrl, unsubscribeUrl } from './content';
export type EmailPreferences={ welcome_enabled:boolean; weekly_enabled:boolean; suppressed:boolean; next_weekly_at?:string; sent_product_ids?:string[] };
export type EmailJob={id:string;user_id:string;kind:'welcome'|'edit'|'weekly';payload:{productIds?:string[];products?:Product[]};status:string};
export function emailConfigured() { return agentConfig.features.email && process.env.EMAIL_ENABLED==='true' && !!process.env.MAILGUN_API_KEY && !!process.env.MAILGUN_DOMAIN && !!process.env.MAILGUN_FROM && !!process.env.EMAIL_POSTAL_ADDRESS && (process.env.EMAIL_TOKEN_SECRET?.length||0)>=32; }
export async function preferences(userId:string) {
 const db=getSupabaseAdmin();
 const {error:insertError}=await db.from('customer_email_preferences').upsert({user_id:userId},{onConflict:'user_id',ignoreDuplicates:true}); if(insertError) throw Error(t("backend.94690bf644"));
 const {data,error}=await db.from('customer_email_preferences').select('welcome_enabled,weekly_enabled,suppressed,next_weekly_at,sent_product_ids').eq('user_id',userId).single(); if(error) throw Error(t("backend.94690bf644")); return data as EmailPreferences;
}
const stateSchema=z.object({profile:z.object({name:z.string().max(80).default(''),preferences:z.string().max(1200).default('')}).default({name:'',preferences:''}),saved:z.record(z.string(),z.object({active:z.boolean(),updatedAt:z.number(),product:z.object({id:z.string(),product_type:z.string().nullable().optional(),title:z.string()})})).default({}),viewed:z.record(z.string(),z.object({updatedAt:z.number(),product:z.object({id:z.string(),product_type:z.string().nullable().optional(),title:z.string()})})).default({})});
export function weeklyQuery(raw:unknown) {
 const parsed=stateSchema.safeParse(raw); if(!parsed.success) return null;
 const state=parsed.data;
 const favorites=Object.values(state.saved).filter(s=>s.active).sort((a,b)=>b.updatedAt-a.updatedAt);
 const viewed=Object.values(state.viewed).sort((a,b)=>b.updatedAt-a.updatedAt);
 const term=favorites[0]?.product.product_type || viewed[0]?.product.product_type || state.profile.preferences.replace(/^Style inspiration:|^Spaces:/gm,'').trim();
 return term ? term.slice(0,180) : null;
}
function usable(products:Product[],limit=5) {
 const seen=new Set<string>(); return products.filter(p=>{const identity=p.listing_id||p.shopify_product_id||p.id;if(seen.has(identity)||!p.available||!safeUrl(p.product_url)||!p.image_url||!safeUrl(p.image_url)||!Number.isFinite(p.price)||p.price<0||!/^[A-Z]{3}$/.test(p.currency))return false;seen.add(identity);return true;}).slice(0,limit);
}
export function matchesEmailPreferences(product:Product,preferences:string) {
 const words=preferences.toLowerCase();
 const excluded=[...words.matchAll(/\b(?:no|avoid|without)\s+(leather|velvet|wool|linen|cotton|wood|rattan|brass|ceramic)\b/g)].map(match=>match[1]);
 const identity=`${product.title} ${product.description||''} ${product.product_type||''}`.toLowerCase();
 if(excluded.some(material=>identity.includes(material)))return false;
 const positive=words.replace(/\b(?:no|avoid|without)\s+\w+/g,'');
 const colors=[...new Set(positive.match(/\b(?:ivory|cream|beige|brown|black|blue|green|pink|red|orange|yellow|gray|grey|white)\b/g)||[])];
 return !colors.length || colors.some(color=>new RegExp(`\\b${color}\\b`).test(identity));
}
function snapshot(products:Product[]) {return products.map(p=>({...p,description:null,tags:[],variant_options:undefined,inventory_quantity:null,title:p.title.slice(0,240),merchant_name:p.merchant_name?.slice(0,120),vendor:p.vendor?.slice(0,120)||null,variant_title:p.variant_title?.slice(0,160)||null}));}
async function selectedProducts(ids:string[]) { return usable(mobileProducts(await callArvivaTool('get_products',{productIds:ids.slice(0,5)},AbortSignal.timeout(8000)))).filter(p=>ids.includes(p.id)); }
export async function dispatchEmail(jobId:string) {
 if(!emailConfigured()) return 'pending';
 const db=getSupabaseAdmin(); const {data,error}=await db.rpc('claim_customer_email',{p_job:jobId}); if(error) throw Error(t("backend.cff9a40afc"));
 const claimed=(data as EmailJob[]|null)?.[0]; if(!claimed) { const {data:existing,error}=await db.from('customer_email_jobs').select('status').eq('id',jobId).maybeSingle(); if(error)throw Error(t("backend.de46e67dd1")); return existing?.status||'pending'; } const job:EmailJob=claimed;
 let sending=false;
 async function finish(status:string,errorCode?:string,providerId?:string) { const {error}=await db.from('customer_email_jobs').update({status,error_code:errorCode||null,provider_id:providerId||null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','processing'); if(error) throw Error(t("backend.54a1bb21b3")); return status; }
 try {
  const {data:account,error:accountError}=await db.auth.admin.getUserById(job.user_id); if(accountError) throw Error(t("backend.7283040535"));
  const user=account.user; if(!user?.email || !user.email_confirmed_at || user.is_anonymous) return await finish('skipped','unverified_account');
  const {data:shopper,error:stateError}=await db.from('shopper_state').select('state').eq('user_id',job.user_id).maybeSingle(); if(stateError) throw Error(t("backend.158e5a22a4"));
  let products:Product[]=[];
  if(job.kind==='edit') products=await selectedProducts(job.payload.productIds||[]);
  if(job.kind==='weekly') {
   const pref=await preferences(job.user_id); const query=weeklyQuery(shopper?.state);
   if(!query) return await finish('skipped','no_preferences');
   const profile=stateSchema.parse(shopper?.state);
   const budget=fallbackSearch(profile.profile.preferences).maxPrice;
   const found=usable(mobileProducts(await callArvivaTool('search_products',{query,limit:20,distinctProducts:true,...(budget!==undefined?{maxPrice:budget,currency:agentConfig.discovery.currency}:{})},AbortSignal.timeout(8000))),20).filter(p=>budget===undefined||(p.currency===agentConfig.discovery.currency&&p.price<=budget));
   const ids=found.filter(p=>!(pref.sent_product_ids||[]).includes(p.listing_id||p.shopify_product_id||p.id)&&matchesEmailPreferences(p,profile.profile.preferences)).map(p=>p.id);
   products=ids.length?(await selectedProducts(ids)).filter(p=>(budget===undefined||(p.currency===agentConfig.discovery.currency&&p.price<=budget))&&matchesEmailPreferences(p,profile.profile.preferences)):[];
   if(products.length<3) return await finish('skipped','not_enough_new_matches');
  }
  if(job.kind==='edit' && !products.length) return await finish('skipped','pieces_unavailable');
  const pref=await preferences(job.user_id);
  if(pref.suppressed || (job.kind==='welcome'&&!pref.welcome_enabled) || (job.kind==='weekly'&&!pref.weekly_enabled)) return await finish('skipped','email_disabled');
  const profile=stateSchema.safeParse(shopper?.state);
  products=snapshot(products);
  const content=messageContent(job.kind,profile.success?profile.data.profile.name:'',products,job.id,job.user_id);
  const {error:payloadError}=await db.from('customer_email_jobs').update({payload:{products}}).eq('id',job.id).eq('status','processing'); if(payloadError) throw Error(t("backend.88ab5a2425"));
  const form=new FormData(); for(const [key,value] of Object.entries({from:process.env.MAILGUN_FROM!,to:user.email,subject:content.subject,html:content.html,text:content.text,'h:Reply-To':agentConfig.brand.supportEmail,'h:List-Unsubscribe':`<${unsubscribeUrl(job.user_id)}>`, 'h:List-Unsubscribe-Post':'List-Unsubscribe=One-Click','o:tracking':'no','o:tracking-opens':'no','o:tracking-clicks':'no','o:tag':`${agentConfig.id}-${job.kind}`,'v:agent_job_id':job.id}))form.set(key,value);
  const host=process.env.MAILGUN_REGION==='EU'?'https://api.eu.mailgun.net':'https://api.mailgun.net';
  sending=true;
  const response=await fetch(`${host}/v3/${encodeURIComponent(process.env.MAILGUN_DOMAIN!)}/messages`,{method:'POST',headers:{Authorization:t("dynamic.dc84aef237",{value0: String(Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64'))})},body:form,signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!response.ok) return await finish(response.status>=500?'unknown':'failed',`provider_${response.status}`);
  const payload=z.object({id:z.string()}).parse(await response.json());
  if(products.length && job.kind==='weekly') { const {error}=await db.from('customer_email_preferences').update({sent_product_ids:[...new Set([...(pref.sent_product_ids||[]),...products.map(p=>p.listing_id||p.shopify_product_id||p.id)])].slice(-250)}).eq('user_id',job.user_id); if(error) throw Error(t("backend.e564a362e8")); }
  return await finish('sent',undefined,payload.id);
 } catch { return await finish(sending?'unknown':'failed',sending?'provider_outcome_unknown':'preparation_failed'); }
}
export async function queueEdit(userId:string,ids:string[],key:string) {
 const db=getSupabaseAdmin(); await preferences(userId);
 const {data,error}=await db.rpc('enqueue_customer_email_edit',{p_user:userId,p_ids:ids,p_key:createHash('sha256').update(key).digest('hex')});
 if(error) throw Error(error.message.includes('EMAIL_DAILY_LIMIT')?t("backend.5399264e9e"):t("backend.eb754c6adc"));
 const status=await dispatchEmail(data as string);
 return {id:data as string,status};
}
export async function unsubscribe(userId:string,source='unsubscribe') {
 const db=getSupabaseAdmin(); const {error}=await db.rpc('set_customer_email_preferences',{p_user:userId,p_welcome:false,p_weekly:false,p_source:source}); if(error) throw Error(t("backend.2d08438fec"));
 const {error:jobError}=await db.from('customer_email_jobs').update({status:'skipped',error_code:'unsubscribed',updated_at:new Date().toISOString()}).eq('user_id',userId).in('kind',['welcome','weekly']).eq('status','pending'); if(jobError) throw Error(t("backend.69db2aa275"));
}
export async function getPublicEdit(id:string) {
 const {data,error}=await getSupabaseAdmin().from('customer_email_jobs').select('id,user_id,kind,payload,status').eq('id',id).in('status',['sent','processing','unknown']).maybeSingle(); if(error) throw Error(t("backend.e586416ad0")); return data as Pick<EmailJob,'id'|'user_id'|'kind'|'payload'|'status'>|null;
}
export { editUrl };
