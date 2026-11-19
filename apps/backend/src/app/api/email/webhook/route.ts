import { createHash } from 'node:crypto';
import { z } from 'zod';
import { body, BodyReadError } from '@/lib/mobile/http';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validWebhookSignature } from '@/lib/email/content';
const eventSchema=z.object({signature:z.object({timestamp:z.string(),token:z.string(),signature:z.string()}),'event-data':z.object({id:z.string().max(200),event:z.enum(['accepted','delivered','failed','complained','unsubscribed','clicked','opened']),severity:z.string().optional(),'user-variables':z.object({arviva_job_id:z.string().uuid()}).optional()})});
export async function POST(request:Request) {
 try {
  const input=eventSchema.safeParse(await body(request,32000));if(!input.success)return Response.json({error:'Invalid event'},{status:400});
  const {signature,'event-data':event}=input.data;
  if(!validWebhookSignature(signature.timestamp,signature.token,signature.signature))return Response.json({error:'Invalid signature'},{status:401});
  const id=event['user-variables']?.arviva_job_id;if(!id)return Response.json({received:true});
  const {error}=await getSupabaseAdmin().rpc('record_customer_email_webhook',{p_nonce:createHash('sha256').update(signature.timestamp+':'+signature.token).digest('hex'),p_event_id:event.id,p_job:id,p_event:event.event,p_permanent:event.severity==='permanent'}); if(error)throw error;
  return Response.json({received:true});
 }catch(error){return Response.json({error:'Event could not be processed'},{status:error instanceof BodyReadError?error.status:503});}
}
