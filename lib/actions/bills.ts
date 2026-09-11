"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addBill(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!name || name.length > 120 || !isDate(dueDate) || !Number.isFinite(amount) || amount < 0 || amount > 100000000) return { error: "Add a valid bill name, amount, and due date." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to add a bill." };
  const { error } = await supabase.from("bills").insert({ user_id: user.id, name, amount, due_date: dueDate });
  if (error) return { error: error.message };
  refreshFinanceViews();
  return { error: null };
}

export async function setBillPaid(billId: string, paid: boolean) {
  if (!billId) return { error: "Choose a valid bill." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to update a bill." };
  const { error } = await supabase.from("bills").update({ paid }).eq("id", billId).eq("user_id", user.id);
  if (error) return { error: error.message };
  refreshFinanceViews();
  return { error: null };
}

function refreshFinanceViews() {
  for (const path of ["/money", "/dashboard", "/coach", "/run-my-day", "/you"]) revalidatePath(path);
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}
