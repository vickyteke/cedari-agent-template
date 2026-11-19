import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { body, BodyReadError, json, preflight, rateLimit, userFromRequest } from '@/lib/mobile/http';
import { consentVersion } from '@/lib/email/content';
import { dispatchEmail, emailConfigured, preferences } from '@/lib/email/service';
export const maxDuration=60;
export const OPTIONS=preflight;
export async function GET(request:Request) {
 try { const user=await userFromRequest(request); if(!user?.email_confirmed_at)return json({error:'Please sign in with a verified email.'},401);
 if(!await rateLimit(request,'email_preferences',20,user.id))return json({error:'Please try again shortly.'},429);
 const pref=await preferences(user.id); return json({welcome:pref.welcome_enabled,weekly:pref.weekly_enabled,suppressed:pref.suppressed,available:emailConfigured(),consentVersion});
 } catch { return json({error:'Email preferences could not be loaded.'},503); }
}
export async function POST(request:Request) {
 try { const user=await userFromRequest(request); if(!user?.email_confirmed_at)return json({error:'Please sign in with a verified email.'},401);
 if(!await rateLimit(request,'email_preferences_update',10,user.id))return json({error:'Please try again shortly.'},429);
 const input=z.object({welcome:z.boolean(),weekly:z.boolean(),consentVersion:z.literal(consentVersion),source:z.enum(['profile','sign_in'])}).strict().parse(await body(request,2000));
 const db=getSupabaseAdmin(); const {error}=await db.rpc('set_customer_email_preferences',{p_user:user.id,p_welcome:input.welcome,p_weekly:input.weekly,p_source:input.source}); if(error)throw error;
 if(input.welcome) {const {data}=await db.from('customer_email_jobs').select('id').eq('dedupe_key',`welcome:${user.id}`).eq('status','pending').maybeSingle(); if(data)await dispatchEmail(data.id);}
 return json({saved:true});
 } catch(error) {return json({error:error instanceof z.ZodError?'Please review your email preferences.':'Email preferences could not be saved.'},error instanceof z.ZodError?400:error instanceof BodyReadError?error.status:503);}
}
