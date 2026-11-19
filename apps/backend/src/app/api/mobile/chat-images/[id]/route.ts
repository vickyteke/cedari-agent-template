import {t} from "../../../../../../../../packages/config/src/copy";
import { acquireLease, releaseLease } from '@/lib/mcp/admission';
import { z } from 'zod';
import { mobilePrincipal, accessResponse } from '@/lib/mcp/auth';
import { json, preflight, rateLimit } from '@/lib/mobile/http';
import { photoUrl } from '@/lib/mobile/images';
export const OPTIONS = preflight;
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let principal;
  try { principal = await mobilePrincipal(request); } catch (error) { return accessResponse(error); }
  let lease: string | null = null;
  try {
    if (!await rateLimit(request, 'photo-read', 120, principal.id)) return json({ error: t("backend.b154014c9f") }, 429);
    const id = z.string().uuid().parse((await context.params).id);
    lease = await acquireLease('arviva-public');
    if (!lease) return json({ error: t("backend.876a076da1") }, 429);
    return json({ url: await photoUrl(principal.id, id) });
  } catch { return json({ error: t("backend.dd303d3d0a") }, 404); }
  finally { if (lease) await releaseLease(lease).catch(() => {}); }
}
