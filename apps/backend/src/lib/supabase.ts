import { t } from "../../../../packages/config/src/copy";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(t("backend.d7fe9b15e4"));
  return createClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.any([
            AbortSignal.timeout(5000),
            ...(init?.signal ? [init.signal] : []),
          ]),
        }),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
