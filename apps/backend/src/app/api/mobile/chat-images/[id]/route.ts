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
    if (!await rateLimit(request, 'photo-read', 120, principal.id)) return json({ error: 'Please try again shortly.' }, 429);
    const id = z.string().uuid().parse((await context.params).id);
    lease = await acquireLease('arviva-public');
    if (!lease) return json({ error: 'Photo previews are busy. Please try again shortly.' }, 429);
    return json({ url: await photoUrl(principal.id, id) });
  } catch { return json({ error: 'Photo is no longer available.' }, 404); }
  finally { if (lease) await releaseLease(lease).catch(() => {}); }
}
