import { z } from 'zod';
import { mobilePrincipal, accessResponse } from '@/lib/mcp/auth';
import { body, json, preflight, rateLimit } from '@/lib/mobile/http';
import { budget } from '@/lib/mobile/admission';
import { acquireLease, releaseLease } from '@/lib/mcp/admission';
import { normalizePhoto, removeAllPhotos, savePhoto } from '@/lib/mobile/images';
export const runtime = 'nodejs';
export const OPTIONS = preflight;
export async function POST(request: Request) {
  let principal;
  try { principal = await mobilePrincipal(request); } catch (error) { return accessResponse(error); }
  let lease: string | null = null;
  try {
    if (!await rateLimit(request, 'photo-upload', 6, principal.id)
      || !await budget(`photo:user:${principal.id}`, principal.anonymous ? 10 : 40, 86400)
      || !await budget(`photo:ip:${principal.anonymous ? 'guest' : 'customer'}:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}`, principal.anonymous ? 30 : 100, 86400)
      || !await budget(`photo:pool:${principal.anonymous ? 'guest' : 'customer'}`, principal.anonymous ? 100 : 200, 86400)) return json({ error: 'Photo limit reached. Please try again later.' }, 429);
    lease = await acquireLease('arviva-public');
    if (!lease) return json({ error: 'Photos are busy. Please try again shortly.' }, 429);
    const input = z.object({ base64: z.string().min(4).max(349528) }).strict().parse(await body(request, 360000));
    const image = await savePhoto(principal.id, await normalizePhoto(input.base64));
    return json({ image });
  } catch { return json({ error: 'Photo could not be uploaded. Choose a JPEG photo under 256 KB or try again.' }, 400); }
  finally { if (lease) await releaseLease(lease).catch(() => {}); }
}
export async function DELETE(request: Request) {
  try {
    const principal = await mobilePrincipal(request);
    if (!await rateLimit(request, 'photo-cleanup', 3, principal.id)) return json({ error: 'Please try again shortly.' }, 429);
    await removeAllPhotos(principal.id);
    return json({ deleted: true });
  } catch { return json({ error: 'Photos could not be removed. Please try again.' }, 503); }
}
