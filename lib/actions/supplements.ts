"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addSupplement(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim() || null;
  const timing = String(formData.get("timing") ?? "morning");
  const frequency = String(formData.get("frequency") ?? "daily");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name) return { error: "Add the supplement name." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };

  const { error } = await supabase.from("supplements").insert({ user_id: user.id, name, dosage, timing, frequency, notes, active: true });
  if (error) return { error: error.message };
  revalidatePath("/supplements");
  revalidatePath("/health");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function logSupplementToday(supplementId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const loggedOn = new Date().toISOString().slice(0, 10);
  await supabase.from("supplement_logs").upsert({ user_id: user.id, supplement_id: supplementId, logged_on: loggedOn }, { onConflict: "user_id,supplement_id,logged_on" });
  revalidatePath("/supplements");
  revalidatePath("/dashboard");
}

export async function setSupplementActive(supplementId: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("supplements").update({ active }).eq("id", supplementId);
  revalidatePath("/supplements");
  revalidatePath("/health");
  revalidatePath("/dashboard");
}
