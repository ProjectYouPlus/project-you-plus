import type { FinanceScore } from "@/lib/finance/types";

export function FinanceScoreCard({ score }: { score: FinanceScore }) {
  const scoreText = score.overall === null ? "—" : String(score.overall);
  return <section className="py-trajectory-card p-5">
    <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/55">Finance Score</div><div className="mt-2 flex items-baseline gap-2"><span className="text-[48px] font-bold tracking-[-.065em] text-white">{scoreText}</span>{score.overall !== null && <span className="text-[12px] text-white/40">/ 100</span>}</div></div><span className={`py-glass-pill ${score.directionLabel === "improving" ? "text-positive" : score.directionLabel === "declining" ? "text-warn" : "text-white/60"}`}>{direction(score)}</span></div>
    <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-white/58">{score.primaryReason}</p>
    <div className="mt-4 grid grid-cols-2 gap-2">{score.factors.map((factor) => <div key={factor.id} className="rounded-[16px] border border-white/[.065] bg-black/10 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] capitalize text-white/48">{factor.id.replace("_", " ")}</span><span className="text-[12px] font-semibold text-white">{factor.value ?? "—"}</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[.07]"><span className={`block h-full rounded-full ${factor.status === "positive" ? "bg-positive" : factor.status === "needs_attention" ? "bg-warn" : "bg-white/20"}`} style={{ width: `${factor.value ?? 0}%` }}/></div></div>)}</div>
    <div className="mt-4 border-t border-white/[.07] pt-3 text-[9.5px] leading-relaxed text-white/40">Behavior score from confirmed income, spending, budgets, savings pace, and tracked bill status. Unavailable inputs are excluded.</div>
  </section>;
}

function direction(score: FinanceScore) { if (score.direction === null) return "Calibrating"; if (score.direction > 0) return `↑ ${score.direction}`; if (score.direction < 0) return `↓ ${Math.abs(score.direction)}`; return "→ Stable"; }
