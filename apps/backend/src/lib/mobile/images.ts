import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { getSupabaseAdmin } from '../supabase';
import { boundedMap } from '../bounded-map';
export const imageBucket = 'arviva-chat-images';
export const photoSchema = z.object({ id: z.string().uuid(), ownerId: z.string().uuid() }).strict();
export type ChatPhoto = z.infer<typeof photoSchema>;
const imagePath = (owner: string, id: string) => `${owner}/${id}.jpg`;
export async function normalizePhoto(base64: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) throw new Error('Invalid photo');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > 262144 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('Choose a smaller JPEG photo');
  // Re-encoding strips EXIF/location and rejects malformed/oversized raster data.
  const output = await sharp(bytes, { limitInputPixels: 1048576, failOn: 'error' }).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  if (output.length > 262144) throw new Error('Choose a smaller photo');
  return output;
}
export async function savePhoto(ownerId: string, bytes: Buffer): Promise<ChatPhoto> {
  const id = randomUUID();
  const { error } = await getSupabaseAdmin().storage.from(imageBucket).upload(imagePath(ownerId, id), bytes, { contentType: 'image/jpeg', upsert: false, cacheControl: '0' });
  if (error) throw new Error('Photo could not be uploaded. Please try again.');
  return { id, ownerId };
}
export async function photoUrl(ownerId: string, id: string) {
  const { data, error } = await getSupabaseAdmin().storage.from(imageBucket).createSignedUrl(imagePath(ownerId, id), 900);
  if (error || !data?.signedUrl) throw new Error('Photo is no longer available. Please attach it again.');
  return data.signedUrl;
}
export async function removePhotos(ownerId: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await getSupabaseAdmin().storage.from(imageBucket).remove(ids.map(id => imagePath(ownerId, id)));
  if (error) throw new Error('Photos could not be removed. Please try again.');
}
export async function removeAllPhotos(ownerId: string) {
  const bucket = getSupabaseAdmin().storage.from(imageBucket);
  // Bound one cleanup request; the upload quotas keep normal accounts well below this.
  for (let batch = 0; batch < 20; batch++) {
    const { data, error } = await bucket.list(ownerId, { limit: 100 });
    if (error) throw new Error('Photo cleanup unavailable');
    if (!data?.length) return;
    const { error: removeError } = await bucket.remove(data.map(item => `${ownerId}/${item.name}`));
    if (removeError) throw new Error('Photo cleanup unavailable');
  }
  throw new Error('Photo cleanup needs another attempt');
}
/** Only the most recent photo-bearing user turn is included, at most two photos. */
export async function resolveChatPhotos(messages: { role: string; images?: ChatPhoto[] }[], ownerId?: string) {
  const index = messages.findLastIndex(message => message.role === 'user' && !!message.images?.length);
  const resolved = new Map<string, string>();
  if (index < 0) return { index, resolved };
  const images = messages[index].images!;
  const current = index === messages.length - 1;
  await boundedMap(images, async photo => {
    if (!ownerId || photo.ownerId !== ownerId) {
      if (current) throw new Error('Please attach this photo again in your current session.');
      return;
    }
    try { resolved.set(photo.id, await photoUrl(ownerId, photo.id)); }
    catch (error) { if (current) throw error; }
  });
  return { index, resolved };
}
