import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ActivityTracker } from "@/components/analytics/activity-tracker";
import { getProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo-mode";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  let isAdmin = false;
  let onboardingRequired = true;
  let disabledModules: string[] = [];

  if (!isDemoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [onboardingRes, adminRes, moduleRes] = await Promise.all([
      supabase
        .from("app_settings")
        .select("value")
        .eq("setting_key", "onboarding_required")
        .maybeSingle(),
      user
        ? supabase
            .from("admin_users")
            .select("role")
            .eq("user_id", user.id)
            .eq("active", true)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("app_modules").select("module_key,enabled"),
    ]);

    onboardingRequired = onboardingRes.data?.value !== false;
    isAdmin = Boolean(adminRes.data?.role);
    disabledModules = (moduleRes.data ?? [])
      .filter((module) => module.enabled === false)
      .map((module) => module.module_key);
  }

  if (!isDemoMode && onboardingRequired && !profile.onboardingCompleted) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar profile={profile} isAdmin={isAdmin} disabledModules={disabledModules} />
      <div className="md:pl-[252px]">{children}</div>
      <BottomNav disabledModules={disabledModules} />
      {!isDemoMode && <ActivityTracker />}
    </div>
  );
}
