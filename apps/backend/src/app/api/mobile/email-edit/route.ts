import { z } from 'zod';
import { productIdSchema } from '@/lib/mcp/identity';
import { body, BodyReadError, json, preflight, rateLimit, userFromRequest } from '@/lib/mobile/http';
import { emailConfigured, queueEdit } from '@/lib/email/service';
export const maxDuration=60;
export const OPTIONS=preflight;
export async function POST(request:Request) {
 try { const user=await userFromRequest(request); if(!user?.email_confirmed_at)return json({error:'Please sign in to email your edit.'},401);
 if(!await rateLimit(request,'email_edit',3,user.id))return json({error:'Please wait a moment before requesting another edit.'},429);
 if(!emailConfigured())return json({error:'Email delivery is not available yet. Your pieces are still saved in Arviva.'},503);
 const input=z.object({productIds:z.array(productIdSchema).min(1).max(5),requestId:z.string().uuid()}).strict().parse(await body(request,4000));
 const result=await queueEdit(user.id,[...new Set(input.productIds)],input.requestId);
 if(['failed','unknown'].includes(result.status))return json({error:result.status==='unknown'?'We could not confirm delivery. Please check your inbox before requesting another edit.':'Your edit could not be emailed. Please try again later.'},503);
 if(result.status==='skipped')return json({error:'These pieces are no longer available or email delivery is disabled.'},409);
 return json(result,202);
 }catch(error) {const daily=error instanceof Error&&error.message.includes('three edits');return json({error:daily?'You can email up to three edits per day.':error instanceof z.ZodError?'Please select up to five pieces.':'Your edit could not be emailed.'},daily?429:error instanceof z.ZodError?400:error instanceof BodyReadError?error.status:503);}
}
