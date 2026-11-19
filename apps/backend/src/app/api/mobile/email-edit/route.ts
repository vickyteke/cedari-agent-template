import {t} from "../../../../../../../packages/config/src/copy";
import { agentConfig } from "../../../../../../../packages/config/src/public";
import { z } from 'zod';
import { productIdSchema } from '@/lib/mcp/identity';
import { body, BodyReadError, json, preflight, rateLimit, userFromRequest } from '@/lib/mobile/http';
import { emailConfigured, queueEdit } from '@/lib/email/service';
export const maxDuration=60;
export const OPTIONS=preflight;
export async function POST(request:Request) {
 if(!agentConfig.features.email)return json({error:t("backend.3e747eb226")},403);
 try { const user=await userFromRequest(request); if(!user?.email_confirmed_at)return json({error:t("backend.387540292f")},401);
 if(!await rateLimit(request,'email_edit',3,user.id))return json({error:t("backend.5b1186544d")},429);
 if(!emailConfigured())return json({error:t("backend.66191e21ce")},503);
 const input=z.object({productIds:z.array(productIdSchema).min(1).max(5),requestId:z.string().uuid()}).strict().parse(await body(request,4000));
 const result=await queueEdit(user.id,[...new Set(input.productIds)],input.requestId);
 if(['failed','unknown'].includes(result.status))return json({error:result.status==='unknown'?t("backend.9fa4a7a07c"):t("backend.f55ae7cdc8")},503);
 if(result.status==='skipped')return json({error:t("backend.f44fc494a3")},409);
 return json(result,202);
 }catch(error) {const daily=error instanceof Error&&error.message.includes('three edits');return json({error:daily?t("backend.5399264e9e"):error instanceof z.ZodError?t("backend.3909d602a7"):t("backend.5ad6f4ef2a")},daily?429:error instanceof z.ZodError?400:error instanceof BodyReadError?error.status:503);}
}
