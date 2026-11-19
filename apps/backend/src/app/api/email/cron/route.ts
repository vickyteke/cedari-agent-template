import {t} from "../../../../../../../packages/config/src/copy";
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { dispatchEmail, emailConfigured } from '@/lib/email/service';
export const maxDuration=300;
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET, supplied=request.headers.get('authorization')||'';
 if(!secret || secret.length<32 || supplied.length!==t("dynamic.8523de2c94",{value0: String(secret)}).length || !timingSafeEqual(Buffer.from(supplied),Buffer.from(t("dynamic.8523de2c94",{value0: String(secret)}))))return Response.json({error:'Unauthorized'},{status:401});
 if(!emailConfigured())return Response.json({error:t("backend.eaf6d550d9")},{status:503});
 try {
  const db=getSupabaseAdmin();
  // Never retry an ambiguous send: Mailgun may already have accepted it.
  const {error:staleError}=await db.from('customer_email_jobs').update({status:'unknown',error_code:'worker_interrupted',updated_at:new Date().toISOString()}).eq('status','processing').lt('updated_at',new Date(Date.now()-15*60000).toISOString()); if(staleError)throw staleError;
  const {error:enqueueError}=await db.rpc('enqueue_weekly_customer_emails'); if(enqueueError)throw enqueueError;
  const {data,error}=await db.from('customer_email_jobs').select('id').eq('status','pending').lte('scheduled_at',new Date().toISOString()).order('scheduled_at').limit(50); if(error)throw error;
  const results:string[]=[];
  for(let start=0;start<(data||[]).length;start+=5) results.push(...await Promise.all(data!.slice(start,start+5).map(async job=>{try{return await dispatchEmail(job.id);}catch{return 'failed';}})));
  await db.from('customer_email_webhook_nonces').delete().lt('created_at',new Date(Date.now()-86400000).toISOString());
  await db.from('customer_email_events').delete().lt('created_at',new Date(Date.now()-90*86400000).toISOString());
  return Response.json({processed:results.length,sent:results.filter(s=>s==='sent').length,skipped:results.filter(s=>s==='skipped').length,failed:results.filter(s=>['failed','unknown'].includes(s)).length});
 }catch{return Response.json({error:t("backend.fb7bb65634")},{status:503});}
}
