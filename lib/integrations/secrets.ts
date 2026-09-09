import { createAdminClient } from "@/lib/supabase/admin";

export async function saveIntegrationSecret(userId: string, provider: string, payload: Record<string, unknown>) {
  const admin = createAdminClient();
  const { error } = await admin.from("integration_secrets").upsert({
    user_id: userId,
    provider,
    secret_payload: payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });
  if (error) throw error;
}

export async function getIntegrationSecret<T extends Record<string, unknown>>(userId: string, provider: string): Promise<T | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("integration_secrets").select("secret_payload").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (error) throw error;
  return (data?.secret_payload as T | undefined) ?? null;
}

export async function deleteIntegrationSecret(userId: string, provider: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("integration_secrets").delete().eq("user_id", userId).eq("provider", provider);
  if (error) throw error;
}
