"use server";

import { revalidatePath } from "next/cache";
import { syncGoogleCalendarForUser } from "@/lib/integrations/google-calendar";
import { syncPlaidForUser } from "@/lib/integrations/plaid-sync";
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
