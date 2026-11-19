import type { ImagePickerAsset, ImagePickerOptions, ImagePickerResult } from 'expo-image-picker';
import type { DraftPhoto } from './photos';

export function pickPhotos(camera: boolean, options: ImagePickerOptions): Promise<ImagePickerResult> {
  return new Promise(resolve => {
    // Keep the original File: browsers can leave the MIME type blank even for JPEGs.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif,.jpeg,.jpg,.png';
    input.multiple = !!options.allowsMultipleSelection;
    if (camera) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    const finish = () => {
      const files = Array.from(input.files ?? []).slice(0, options.selectionLimit || 2);
      input.remove();
      if (!files.length) return resolve({ canceled: true, assets: null });
      resolve({ canceled: false, assets: files.map(file => ({
        file, fileName: file.name, mimeType: file.type, width: 0, height: 0, uri: '',
      })) });
    };
    input.addEventListener('change', finish, { once: true });
    input.addEventListener('cancel', finish, { once: true });
    document.body.append(input);
    input.click();
  });
}

async function decode(file: Blob) {
  const uri = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = uri;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(uri);
  }
}

export async function preparePhoto(asset: ImagePickerAsset): Promise<DraftPhoto> {
  const file = asset.file;
  if (!file?.size) throw new Error('That photo is empty. Choose another photo.');
  if (file.size > 20_000_000) throw new Error('This photo is over 20 MB. Try exporting a smaller copy.');
  let image;
  try {
    image = await decode(file);
  } catch {
    try {
      const { heicTo, isHeic } = await import('heic-to/csp');
      if (!await isHeic(file)) throw new Error();
      image = await decode(await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 }));
    } catch {
      throw new Error('This photo could not be decoded. Try exporting a fresh JPEG or PNG copy.');
    }
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx || !image.naturalWidth || !image.naturalHeight) throw new Error('The browser could not prepare this photo.');
  const originalEdge = Math.max(image.naturalWidth, image.naturalHeight);
  for (const [edge, quality] of [[1024, .78], [1024, .58], [800, .58], [640, .45]]) {
    const scale = Math.min(1, edge / originalEdge);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const uri = canvas.toDataURL('image/jpeg', quality);
    const base64 = uri.slice('data:image/jpeg;base64,'.length);
    if (uri.startsWith('data:image/jpeg;base64,') && base64.length <= 262144) {
      return { key: crypto.randomUUID(), uri, base64 };
    }
  }
  throw new Error('This photo is too detailed to upload. Try a smaller copy.');
}
