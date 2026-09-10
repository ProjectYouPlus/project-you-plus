import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "owner" | "admin" | "analyst" | "support";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: admin } = await supabase
    .from("admin_users")
    .select("role,active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!admin) redirect("/dashboard");
  return { supabase, user, role: admin.role as AdminRole };
}
