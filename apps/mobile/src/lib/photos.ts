import type { ChatPhoto } from "./model";
import { request } from "./api";
export { pickPhotos, preparePhoto } from "./photo-preparation";
export type DraftPhoto = {
  key: string;
  uri: string;
  base64: string;
  uploaded?: ChatPhoto;
};
export async function uploadPhoto(photo: DraftPhoto): Promise<ChatPhoto> {
  if (photo.uploaded) return photo.uploaded;
  const result = await request<{ image: ChatPhoto }>("/chat-images", {
    method: "POST",
    body: JSON.stringify({ base64: photo.base64 }),
  });
  photo.uploaded = result.image; // A chat retry reuses the upload rather than creating copies.
  return result.image;
}
