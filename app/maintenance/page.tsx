import Link from "next/link";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";
import { createClient } from "@/lib/supabase/server";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: admin } = user
    ? await supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle()
    : { data: null };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-5 text-text-1">
      <div className="pointer-events-none absolute left-1/2 top-[-140px] h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-accent/15 blur-[100px]" />
      <div className="relative w-full max-w-[520px] rounded-[26px] border border-border bg-surface p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,.3)] sm:p-9">
        <ProjectYouLogo className="mx-auto justify-center text-[16px] font-semibold" markClassName="h-10 w-10" />
        <div className="mx-auto mt-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent-soft text-accent-text">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <div className="mt-6 text-[10px] font-bold uppercase tracking-[.18em] text-accent-text">System maintenance</div>
        <h1 className="mt-2 text-[29px] font-bold tracking-[-.04em]">Project You+ is being tuned.</h1>
        <p className="mx-auto mt-3 max-w-[400px] text-[13px] leading-relaxed text-text-2">
          The product is temporarily unavailable while an update is being made. Your account and progress are safe.
        </p>
        {admin && (
          <Link href="/owner" className="mt-7 inline-flex rounded-full border border-accent/30 bg-accent-soft px-4 py-2.5 text-[12px] font-semibold text-accent-text">
            Open Owner Command Center
          </Link>
        )}
      </div>
    </main>
  );
}
