import { t } from "../../../../../../../packages/config/src/copy";
import { removeAllPhotos } from "@/lib/mobile/images";
import { json, preflight, userFromRequest } from "@/lib/mobile/http";
import { getSupabaseAdmin } from "@/lib/supabase";
export const OPTIONS = preflight;
export async function DELETE(request: Request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return json({ error: t("backend.2e1d18330b") }, 401);
    await removeAllPhotos(user.id);
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch {
    return json({ error: t("backend.52d918a7c4") }, 503);
  }
}
