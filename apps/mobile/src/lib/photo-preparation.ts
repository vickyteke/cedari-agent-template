import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { DraftPhoto } from './photos';

export function pickPhotos(camera: boolean, options: ImagePicker.ImagePickerOptions) {
  return camera ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options);
}

export async function preparePhoto(asset: ImagePicker.ImagePickerAsset): Promise<DraftPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 1024) context.resize(asset.width >= asset.height ? { width: 1024, height: null } : { height: 1024, width: null });
  const image = await context.renderAsync();
  for (const compress of [0.75, 0.5, 0.3]) {
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (result.base64 && result.base64.length <= 262144) return { key: result.uri, uri: result.uri, base64: result.base64 };
  }
  throw new Error('This photo is too detailed to upload. Try a closer crop or a smaller photo.');
}
