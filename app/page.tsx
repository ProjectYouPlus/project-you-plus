import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  // The public product flow starts at the branded welcome experience.
  // In demo mode this also makes it easy to review auth + onboarding before entering the app.
  if (isDemoMode) redirect("/welcome");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/today" : "/welcome");
}
