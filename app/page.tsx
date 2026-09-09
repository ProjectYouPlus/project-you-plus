import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  if (isDemoMode) redirect("/welcome");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/welcome");
}
