"use client";

import { useEffect, useMemo, useState } from "react";

type Row = Record<string, any>;
type Overview = {
  runs?: Row[];
  generationJobs?: Row[];
  activity?: Row[];
  higgsfield?: { status?: string; metadata?: Row | null } | null;
  instagram?: { status?: string; metadata?: Row | null } | null;
  creditBudgets?: Row[];
};

export function MarketingRuntimeStatus() {
  const [data, setData] = useState<Overview>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/marketing-ops/overview", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Runtime status unavailable");
        if (!cancelled) { setData(json); setError(""); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Runtime status unavailable");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const activeRuns = useMemo(() => (data.runs || []).filter((run) => ["queued", "running"].includes(run.status)), [data.runs]);
  const providerJobs = useMemo(() => (data.generationJobs || []).filter((job) => ["awaiting_provider", "submitted", "processing"].includes(job.status)), [data.generationJobs]);
  const latest = data.activity?.[0];
  const budget = data.creditBudgets?.[0];
  const hfConnected = data.higgsfield?.status === "connected";
  const instagramConnected = data.instagram?.status === "connected";

  return (
    <section className="mb-4 rounded-xl border border-[#24334b] bg-[linear-gradient(145deg,#0b1423,#080e18)] p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.22em] text-[#a991ff]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]"/>Live Marketing Runtime</div>
          <div className="mt-1 text-[10px] text-[#8794a9]">{error || latest?.message || "Runtime heartbeat is active; agent and provider events will appear here."}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Status label="Agent lanes" value={`${activeRuns.length}/3`} ok={activeRuns.length > 0} />
          <Status label="Provider queue" value={String(providerJobs.length)} ok={providerJobs.length > 0} />
          <Status label="Higgsfield" value={hfConnected ? "Connected" : "Setup needed"} ok={hfConnected} />
          <Status label="Instagram" value={instagramConnected ? `@${String(data.instagram?.metadata?.username || "connected")}` : "Disconnected"} ok={instagramConnected} />
        </div>
      </div>
      {budget ? <div className="mt-3 border-t border-white/[.05] pt-3 text-[9px] text-[#69778e]">Higgsfield credits: {Number(budget.credits_used || 0).toFixed(1)} used · {Number(budget.credits_reserved || 0).toFixed(1)} reserved · {Number(budget.operational_budget || 0).toFixed(0)} operating budget</div> : null}
    </section>
  );
}

function Status({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="min-w-[116px] rounded-lg border border-[#26354c] bg-[#070d16] px-3 py-2"><div className="text-[8px] uppercase tracking-[.14em] text-[#65738a]">{label}</div><div className={`mt-1 text-[10px] font-semibold ${ok ? "text-emerald-300" : "text-[#aab4c5]"}`}>{value}</div></div>;
}
