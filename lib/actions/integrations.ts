"use server";

import { revalidatePath } from "next/cache";
import { syncGoogleCalendarForUser } from "@/lib/integrations/google-calendar";
import { syncPlaidForUser } from "@/lib/integrations/plaid-sync";
import { removePlaidItem } from "@/lib/integrations/plaid";
import { deleteIntegrationSecret, getIntegrationSecret } from "@/lib/integrations/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function refreshGoogleCalendar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  try {
    const result = await syncGoogleCalendarForUser(user.id);
    revalidatePath("/calendar"); revalidatePath("/dashboard"); revalidatePath("/coach"); revalidatePath("/you");
    return { error: null, synced: result.synced };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not refresh Google Calendar." };
  }
}

export async function refreshPlaid() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  try {
    const result = await syncPlaidForUser(user.id);
    revalidatePath("/money"); revalidatePath("/dashboard"); revalidatePath("/coach"); revalidatePath("/you");
    return { error: null, accounts: result.accounts };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not refresh Plaid." };
  }
}

export async function disconnectPlaid() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  try {
    const secret = await getIntegrationSecret<{ access_token: string }>(user.id, "plaid");
    if (secret?.access_token) await removePlaidItem(secret.access_token);
    const admin = createAdminClient();
    await admin.from("transactions").delete().eq("user_id", user.id).eq("provider", "plaid");
    await admin.from("investment_holdings").delete().eq("user_id", user.id).eq("provider", "plaid");
    await admin.from("finance_accounts").delete().eq("user_id", user.id).eq("connected_via", "plaid");
    await deleteIntegrationSecret(user.id, "plaid");
    await admin.from("integrations").upsert({ user_id: user.id, provider: "plaid", status: "available", connected_at: null, metadata: { disconnected_at: new Date().toISOString(), environment: process.env.PLAID_ENV || "sandbox" } }, { onConflict: "user_id,provider" });
    for (const path of ["/money", "/money/connect", "/dashboard", "/coach", "/you", "/integrations"]) revalidatePath(path);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not disconnect Plaid." };
  }
}
