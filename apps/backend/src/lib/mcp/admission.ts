import { getSupabaseAdmin } from "../supabase";
export async function acquireLease(id: string) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "acquire_security_lease",
    {
      pool_name:
        id === "arviva-backend"
          ? "customer"
          : id === "arviva-public"
            ? "public"
            : "agent",
      owner_key: id,
    },
  );
  return error || typeof data !== "string" ? null : data;
}
export async function releaseLease(id: string) {
  await getSupabaseAdmin().rpc("release_security_lease", { lease_id: id });
}
