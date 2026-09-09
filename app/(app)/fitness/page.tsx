import { mockHealth, mockSchedule } from "@/lib/mock-data";

const RECENT_WORKOUTS = [
  { title: "Upper body", date: "Today · 7:00 AM", duration: "45 min", score: "Strong" },
  { title: "Long run · 6 miles", date: "Yesterday", duration: "58 min", score: "On plan" },
  { title: "Lower body", date: "3 days ago", duration: "50 min", score: "Strong" },
];

export default function FitnessPage() {
  const nextWorkout = mockSchedule.find((e) => e.title.toLowerCase().includes("workout"));
  return (
    <main className="py-shell-narrow">
      <header className="mb-7"><div className="py-eyebrow mb-2">Body</div><h1 className="py-title">Fitness</h1><p className="py-subtitle">Train with context from recovery, consistency and your current goals.</p></header>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Recovery" value={`${mockHealth.recoveryPct}%`} sub="Ready to train" tone="positive" />
        <Metric label="Weekly consistency" value="84%" sub="4 sessions planned" />
        <Metric label="Current streak" value="12d" sub="Personal best: 18" />
      </div>
      {nextWorkout && <section className="py-accent-card mb-5 p-5"><div className="py-section-label text-accent-text">Project You+ Action</div><h2 className="py-section-title">Keep the workout as planned</h2><p className="mb-0 mt-2 text-[13.5px] leading-6 text-text-2">Recovery supports today’s upper-body session. Keep intensity normal and avoid adding volume just because readiness is high.</p></section>}
      <section className="py-card p-5 sm:p-6"><div className="py-section-label">Recent workouts</div><h2 className="py-section-title mb-4">Consistency over intensity</h2>{RECENT_WORKOUTS.map((w)=><div key={w.title} className="flex items-center justify-between border-b border-border py-3.5 last:border-b-0"><div><div className="text-[14px] font-semibold text-text-1">{w.title}</div><div className="mt-1 text-[12px] text-text-3">{w.date}</div></div><div className="text-right"><div className="text-[13px] font-semibold text-text-1">{w.duration}</div><div className="mt-1 text-[11.5px] text-positive">{w.score}</div></div></div>)}</section>
    </main>
  );
}
function Metric({label,value,sub,tone}:{label:string;value:string;sub:string;tone?:"positive"}){return <div className="py-card p-5"><div className="py-section-label">{label}</div><div className={`mt-2 text-[32px] font-bold tracking-tight ${tone?"text-positive":"text-text-1"}`}>{value}</div><div className="mt-1 text-[12.5px] text-text-3">{sub}</div></div>}
