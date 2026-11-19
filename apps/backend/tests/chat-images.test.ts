import { beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({ signed: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ storage: { from: () => ({ createSignedUrl: mocks.signed, upload: mocks.upload, remove: mocks.remove }) } }) }));
import { normalizePhoto, photoSchema, resolveChatPhotos, savePhoto } from '@/lib/mobile/images';
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const photo = { id: '00000000-0000-4000-8000-000000000003', ownerId: owner };
beforeEach(() => { vi.clearAllMocks(); mocks.signed.mockResolvedValue({ data: { signedUrl: 'https://project.invalid/private.jpg?token=test' }, error: null }); mocks.upload.mockResolvedValue({ error: null }); });
it('re-encodes a real JPEG and strips embedded metadata', async () => {
  const source = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#b08866' } }).jpeg().withMetadata({ exif: { IFD0: { Artist: 'private customer marker' } } }).toBuffer();
  expect((await sharp(source).metadata()).exif).toBeDefined();
  const output = await normalizePhoto(source.toString('base64'));
  expect(await sharp(output).metadata()).toMatchObject({ format: 'jpeg', width: 64, height: 48 });
  expect((await sharp(output).metadata()).exif).toBeUndefined();
});
it('rejects oversized pixel dimensions and non-raster/malformed uploads', async () => {
  const oversized = await sharp({ create: { width: 2048, height: 2048, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  await expect(normalizePhoto(oversized.toString('base64'))).rejects.toThrow();
  await expect(normalizePhoto(Buffer.from('<svg/>').toString('base64'))).rejects.toThrow();
  await expect(normalizePhoto('%%%')).rejects.toThrow();
});
it('never signs a photo owned by a different session', async () => {
  await expect(resolveChatPhotos([{ role: 'user', images: [photo] }], other)).rejects.toThrow('current session');
  expect(mocks.signed).not.toHaveBeenCalled();
});
it('uses only the most recent photo turn and derives its private path from the verified owner', async () => {
  const older = { ...photo, id: other };
  const result = await resolveChatPhotos([{ role: 'user', images: [older] }, { role: 'user', images: [photo] }, { role: 'user' }], owner);
  expect(result.index).toBe(1); expect(result.resolved.size).toBe(1);
  expect(mocks.signed).toHaveBeenCalledExactlyOnceWith(`${owner}/${photo.id}.jpg`, 900);
});
it('tolerates unavailable historical photos without granting cross-account access', async () => {
  expect((await resolveChatPhotos([{ role: 'user', images: [photo] }, { role: 'user' }], other)).resolved.size).toBe(0);
  expect(mocks.signed).not.toHaveBeenCalled();
});
it('accepts only opaque image identifiers, never caller-supplied fetch URLs', () => {
  expect(photoSchema.safeParse({ ...photo, url: 'http://127.0.0.1/private' }).success).toBe(false);
});
it('uploads under the customer path with an unguessable generated identifier', async () => {
  const stored = await savePhoto(owner, Buffer.from('fixture'));
  expect(stored.ownerId).toBe(owner);
  expect(mocks.upload.mock.calls[0][0]).toBe(`${owner}/${stored.id}.jpg`);
});
