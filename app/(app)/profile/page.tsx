import { ProfileView } from "@/components/profile/profile-view";
import { getProfile } from "@/lib/data/profile";

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <main className="py-shell">
      <header className="mb-7"><div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-text-3">Personal operating system</div><h1 className="m-0 py-title">Your Blueprint</h1><p className="mt-2 max-w-[650px] text-[14px] leading-relaxed text-text-2">The long-term direction Project You+ uses to prioritize your time, habits, and recommendations.</p></header>
      <div className="py-card p-5 sm:p-7"><ProfileView profile={profile} /></div>
    </main>
  );
}
