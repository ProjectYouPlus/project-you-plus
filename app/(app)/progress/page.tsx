import Image from "next/image";
import Link from "next/link";
import { buildUserContext } from "@/lib/ai/context";
import { evaluateProgression } from "@/lib/progression/service";
import { PROGRESSION_CONFIG } from "@/lib/progression/config";
import { ACHIEVEMENTS } from "@/lib/progression/achievements";
import { AchievementBadge } from "@/components/celebrations/achievement-badge";
import { AchievementGallery } from "@/components/celebrations/achievement-gallery";

export default async function ProgressPage() {
  const state = await evaluateProgression(await buildUserContext());
  const gap = state.nextMilestone ? state.nextMilestone.level - state.level : 0;
  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="mb-7"><div className="py-eyebrow mb-1.5 text-accent-text">Evidence over estimates</div><h1 className="py-title">Progress & Achievements</h1><p className="py-subtitle">Your level changes slowly as consistent behavior becomes reliable history.</p></header>

    <section className="py-glass-hero relative overflow-hidden p-5 sm:p-6">
      <div className="absolute -right-20 -top-24 h-52 w-52 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative grid grid-cols-[1fr_auto] items-center gap-5"><div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-violet-200/65">Current level</div><div className="mt-2 flex items-end gap-3"><b className="text-[58px] leading-none tracking-[-.08em] text-white">{state.level}</b><span className="pb-1 text-[16px] font-semibold text-violet-200">{state.stage}</span></div><p className="m-0 mt-3 max-w-[390px] text-[12px] leading-relaxed text-white/55">{state.status === "calibrating" ? "Calibrating from the history you have. Your current score remains available while the slower progression signal becomes dependable." : `Built from 7, 28, and 90-day performance, ${state.consistency}% active-day consistency, domain balance, and priority-weighted execution.`}</p></div><div className="flex h-24 w-24 items-center justify-center rounded-full border border-violet-300/20 bg-white/[.05] shadow-[0_0_45px_rgba(139,92,246,.2)]"><span className="text-center"><b className="block text-[27px] text-white">{state.index}</b><span className="text-[8px] uppercase tracking-[.14em] text-white/40">index</span></span></div></div>
    </section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2">
      <article className="py-glass-soft p-4"><div className="py-eyebrow">Next milestone</div>{state.nextMilestone ? <><div className="mt-2 flex items-baseline justify-between"><b className="text-[24px] text-text-1">{state.nextMilestone.level} — {state.nextMilestone.stage}</b><span className="text-[11px] font-semibold text-accent-text">{gap} levels</span></div><div className="mt-3 py-progress-track"><div className="py-progress-fill" style={{width:`${Math.max(0,Math.min(100,100-gap/(state.nextMilestone.level-(state.highestMilestone??0))*100))}%`}} /></div></> : <div className="mt-2 text-[20px] font-semibold text-text-1">Final milestone reached</div>}</article>
      <article className="py-glass-soft p-4"><div className="py-eyebrow">Current score</div><div className="mt-2 flex items-baseline gap-2"><b className="text-[24px] text-text-1">{state.currentScore}</b><span className="text-[11px] text-text-3">today · {state.coveragePct}% coverage</span></div><p className="m-0 mt-2 text-[10.5px] leading-relaxed text-text-3">Today’s score can move quickly. Level {state.level} reflects sustained behavior and changes gradually.</p></article>
    </section>

    <section className="py-glass-soft mt-4 p-5"><div className="flex items-center gap-4">{state.onePercentUnlocked ? <Image src={state.brandAsset!} alt="Project You+ 1% mark" width={56} height={56} className="h-14 w-14 object-contain"/> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[.03] text-[18px] text-text-3">⌁</div>}<div className="min-w-0"><div className="py-eyebrow text-accent-text">1% progression</div><h2 className="m-0 mt-1 text-[20px] font-semibold text-text-1">{state.onePercentCurrent ? "Operating at 1%" : state.onePercentUnlocked ? "1% earned historically" : "The final standard"}</h2><p className="m-0 mt-1 text-[10.5px] leading-relaxed text-text-3">{state.onePercentUnlocked ? (state.onePercentCurrent ? "Your current 28 and 90-day performance, balance, consistency, history, and integrity checks all meet the standard." : "The milestone remains part of your history. Your current level reflects how you are operating now.") : "Requires long-horizon excellence, strong balance across active domains, high consistency, enough real history, and clean integrity signals."}</p></div></div>
      {!state.onePercentCurrent && <div className="mt-4 grid gap-2 sm:grid-cols-2">{state.limitingFactors.map((factor)=><div key={factor} className="rounded-xl border border-border bg-surface/30 px-3 py-2 text-[10.5px] text-text-2">{factor}</div>)}</div>}
    </section>

    <Section title="Milestones" sub="Permanent first-reached history. A later level change never removes it.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{PROGRESSION_CONFIG.milestones.map((milestone)=>{const earned=state.milestones.find((item)=>item.level===milestone.level);return <div key={milestone.level} className={`rounded-2xl border p-4 text-center ${earned?"border-violet-400/25 bg-violet-500/10":"border-border bg-surface/25"}`}><AchievementBadge level={milestone.level} locked={!earned}/><div className={`mt-2 text-[16px] font-bold ${earned?"text-accent-text":"text-text-3"}`}>{milestone.level} · {milestone.stage}</div><div className="mt-1 text-[8.5px] text-text-3">{earned?new Date(earned.reachedAt).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"Locked"}</div></div>})}</div>
    </Section>

    <Section title="Achievements" sub="Only meaningful, evidence-backed unlocks appear here.">
      <AchievementGallery definitions={ACHIEVEMENTS} earned={state.achievements}/>
    </Section>

    <Section title="Recent wins" sub="A filtered view of meaningful events from your existing history.">
      {state.recentWins.length ? <div className="divide-y divide-white/[.06]">{state.recentWins.map((win)=><div key={win.id} className="flex items-center gap-3 py-3"><span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_var(--accent-glow)]"/><span className="min-w-0 flex-1 text-[12px] font-medium text-text-1">{win.title}</span><time className="text-[9px] text-text-3">{new Date(win.occurredAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time></div>)}</div> : <Empty text="Your meaningful milestones, achievements, completed goals, and personal bests will appear here." />}
    </Section>
    <Link href="/coach" className="py-liquid-button mt-5 w-full">Ask Coach about my progression</Link>
  </main>;
}
function Section({title,sub,children}:{title:string;sub:string;children:React.ReactNode}){return <section className="py-glass-soft mt-4 p-5"><div className="mb-4"><h2 className="m-0 text-[18px] font-semibold text-text-1">{title}</h2><p className="m-0 mt-1 text-[10.5px] text-text-3">{sub}</p></div>{children}</section>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-border p-5 text-center text-[11px] leading-relaxed text-text-3">{text}</div>}
