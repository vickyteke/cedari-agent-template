import {t} from "../../../../../packages/config/src/copy";
// Shopping navigation belongs to verified product cards and checkout controls.
// Model prose remains readable but never creates a new destination.
export function safeProse(text: string) {
  return text.replace(/!?\[([^\]\n]*)\]\([^\n]*?\)/g, "$1")
    .replace(/https?:\/\/[^\s<>)]*/gi, t("backend.7857d68152"));
}
