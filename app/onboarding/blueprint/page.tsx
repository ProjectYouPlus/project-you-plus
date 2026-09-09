import { cookies } from "next/headers";
import Link from "next/link";
import { getProfile } from "@/lib/data/profile";
import type { Blueprint } from "@/lib/blueprint";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";

async function resolveBlueprint(): Promise<Blueprint | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("py_blueprint")?.value;
  if (raw) {
    try { return JSON.parse(raw) as Blueprint; } catch {}
  }
  const profile = await getProfile();
  if (!profile.blueprint) return null;
  return {
    vision: profile.blueprint.vision ?? "",
    goals: profile.blueprint.goals ?? [],
    priorities: profile.blueprint.priorities ?? [],
    habits: profile.blueprint.habits ?? [],
    challenges: "",
    ninetyDayDirection: "Build a repeatable weekly rhythm around your highest-priority goal.",
    coachingStyle: profile.blueprint.coachingStyle,
    rhythm: profile.blueprint.rhythm,
    healthEnergy: profile.blueprint.healthEnergy,
    financeContext: profile.blueprint.financeContext,
    availableDailyTime: profile.blueprint.availableDailyTime,
    peakEnergy: profile.blueprint.peakEnergy,
    protectedCommitments: profile.blueprint.protectedCommitments,
    nutritionPhotoTracking: profile.blueprint.nutritionPhotoTracking,
    moneyGoals: profile.blueprint.moneyGoals,
    connectionPrefs: profile.blueprint.connectionPrefs,
  };
}

export default async function BlueprintPage() {
  const blueprint = await resolveBlueprint();
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg px-5 py-8 sm:px-6">
      <div className="pointer-events-none absolute left-1/2 top-[-150px] h-[430px] w-[430px] -translate-x-1/2 rounded-full bg-accent/10 blur-[100px]" />
      <div className="relative mx-auto w-full max-w-[500px]">
        <ProjectYouLogo className="mb-9 text-[16px] font-semibold" markClassName="h-9 w-9" />
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-accent/30 bg-surface shadow-[0_0_60px_rgba(139,92,246,.24)]">
          <ProjectYouLogo compact markClassName="h-12 w-12" />
        </div>
        <div className="py-eyebrow mb-2 text-accent-text">Personalization complete</div>
        <h1 className="m-0 max-w-[440px] text-[34px] font-bold leading-[1.04] tracking-[-0.05em] text-text-1">Your Project You+ plan is ready.</h1>
        <p className="mb-7 mt-3 max-w-[440px] text-[14px] leading-relaxed text-text-2">Your goals, schedule, routines, money context and coaching preferences now form one starting system.</p>

        {blueprint ? (
          <div className="space-y-4">
            <section className="py-accent-card p-5">
              <div className="py-section-label text-accent-text">90-day direction</div>
              <p className="mb-0 mt-2 text-[15px] font-medium leading-6 text-text-1">{blueprint.ninetyDayDirection}</p>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <SummaryCard label="Top goals" value={`${blueprint.goals.length} defined`} />
              <SummaryCard label="Daily capacity" value={blueprint.availableDailyTime ?? "Personalized"} />
              <SummaryCard label="Peak energy" value={blueprint.peakEnergy ?? "Adaptive"} />
              <SummaryCard label="Connections" value={`${blueprint.connectionPrefs?.length ?? 0} selected`} />
            </section>

            <BlueprintCard eyebrow="Vision" title="Where you’re going">
              <p className="m-0 text-[14px] leading-6 text-text-1">{blueprint.vision}</p>
            </BlueprintCard>

            {blueprint.goals.length > 0 && (
              <BlueprintCard eyebrow="Top goals" title="What matters most">
                <div className="space-y-2">{blueprint.goals.map((goal, index) => <div key={goal} className="flex items-start gap-3 rounded-[14px] bg-[var(--surface-2)] px-3.5 py-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-text">{index + 1}</span><span className="text-[13.5px] font-medium leading-5 text-text-1">{goal}</span></div>)}</div>
              </BlueprintCard>
            )}

            <BlueprintCard eyebrow="Your operating rhythm" title="How the system will protect you">
              <div className="grid grid-cols-2 gap-2.5">
                <Detail label="Wake" value={blueprint.rhythm?.wakeTime ?? "—"} />
                <Detail label="Sleep" value={blueprint.rhythm?.sleepTime ?? "—"} />
                <Detail label="Health" value={blueprint.healthEnergy ?? "Personalized"} />
                <Detail label="Coach" value={blueprint.coachingStyle?.[0] ?? "Adaptive"} />
              </div>
              {blueprint.protectedCommitments && <div className="mt-3 rounded-[14px] bg-[var(--surface-2)] p-3 text-[12px] leading-relaxed text-text-2"><span className="font-semibold text-text-1">Protected:</span> {blueprint.protectedCommitments}</div>}
            </BlueprintCard>

            {blueprint.priorities.length > 0 && <BlueprintCard eyebrow="Focus areas" title="Where your attention goes"><div className="flex flex-wrap gap-2">{blueprint.priorities.map((priority) => <span key={priority} className="py-pill border-accent/30 bg-accent-soft text-accent-text">{priority}</span>)}</div></BlueprintCard>}
          </div>
        ) : <div className="py-card p-5 text-[14px] text-text-2">We couldn’t find your onboarding answers. You can still build your Blueprint from inside the app.</div>}

        <div className="mt-6 space-y-3">
          <Link href="/today" className="py-button-primary w-full">Enter Project You+</Link>
          <Link href="/onboarding" className="py-button-secondary w-full">Edit answers</Link>
        </div>
      </div>
    </main>
  );
}

function BlueprintCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="py-card p-5"><div className="py-section-label text-accent-text">{eyebrow}</div><h2 className="m-0 mb-4 mt-1 text-[18px] font-semibold tracking-tight text-text-1">{title}</h2>{children}</section>;
}
function SummaryCard({ label, value }: { label: string; value: string }) { return <div className="py-card p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-3">{label}</div><div className="mt-1.5 text-[13px] font-semibold text-text-1">{value}</div></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-[14px] bg-[var(--surface-2)] p-3"><div className="text-[10px] text-text-3">{label}</div><div className="mt-1 text-[12.5px] font-semibold text-text-1">{value}</div></div>; }
