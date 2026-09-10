import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ActivityTracker } from "@/components/analytics/activity-tracker";
import { getProfile } from "@/lib/data/profile";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo-mode";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!isDemoMode && !profile.onboardingCompleted) redirect("/onboarding");

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar profile={profile} />
      <div className="md:pl-[252px]">{children}</div>
      <BottomNav />
      {!isDemoMode && <ActivityTracker />}
    </div>
  );
}
