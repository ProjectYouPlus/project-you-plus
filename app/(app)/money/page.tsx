import Link from "next/link";

const ACCOUNTS = [
  { title: "Checking", sub: "Primary bank", value: "$12,840" },
  { title: "Savings", sub: "Emergency fund", value: "$24,500" },
  { title: "Credit card", sub: "Current balance", value: "-$1,920" },
];

export default function MoneyPage({ searchParams }: { searchParams?: { connected?: string } }) {
  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="py-eyebrow mb-1.5">Your financial picture</div>
          <h1 className="py-title">Money</h1>
        </div>
        <Link href="/money/connect" className="rounded-full border border-border bg-surface px-3 py-2 text-[12px] font-semibold text-accent-text">Connect</Link>
      </header>

      {searchParams?.connected === "1" && <div className="mb-4 rounded-[16px] border border-positive/30 bg-positive-soft px-4 py-3 text-[12.5px] font-semibold text-positive">Connection handoff completed in demo mode.</div>}

      <section className="py-accent-card p-[18px] sm:p-6">
        <div className="py-eyebrow text-accent-text">Net worth</div>
        <div className="mt-1 text-[40px] font-bold tracking-[-0.05em] text-text-1">$86,420</div>
        <div className="mt-1 flex items-center gap-2 text-[12px]"><span className="font-semibold text-positive">+$4,280 this month</span><span className="text-text-3">+5.2%</span></div>
        <div className="mt-5 flex h-12 items-end gap-1.5">
          {[25, 31, 29, 36, 40, 44, 51, 56, 61, 68, 72, 84].map((height, index) => <span key={index} className="flex-1 rounded-full bg-accent" style={{ height: `${height}%`, opacity: 0.28 + index * 0.055 }} />)}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat label="Income" value="$9.2k" sub="This month" />
        <MiniStat label="Spent" value="$4.4k" sub="48% of income" />
      </section>

      <section className="mt-4 py-card px-4 pt-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2"><h2 className="m-0 text-[19px] font-semibold text-text-1">Accounts</h2><span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-text-3">Demo</span></div>
          <Link href="/money/connect" className="text-[12px] font-semibold text-accent-text">Manage</Link>
        </div>
        {ACCOUNTS.map((account) => (
          <div key={account.title} className="py-list-row">
            <span className="py-icon-tile text-[14px] font-bold text-accent-text">$</span>
            <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-text-1">{account.title}</span><span className="mt-0.5 block text-[11.5px] text-text-2">{account.sub}</span></span>
            <span className="text-[12px] font-semibold text-text-1">{account.value}</span>
          </div>
        ))}
      </section>

      <section className="mt-4 py-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[19px] font-semibold text-text-1">Investments</h2>
          <Link href="/money/connect" className="text-[12px] font-semibold text-accent-text">View</Link>
        </div>
        <div className="mt-3 flex items-start justify-between">
          <div><div className="text-[10.5px] text-text-3">Portfolio value</div><div className="mt-1 text-[24px] font-bold text-text-1">$50,960</div></div>
          <span className="text-[12px] font-semibold text-positive">+8.4% YTD</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[["Stocks", "62%"], ["ETFs", "28%"], ["Cash", "10%"]].map(([label, value]) => <div key={label} className="rounded-[12px] bg-[var(--surface-2)] p-2.5 text-center"><div className="text-[10px] text-text-3">{label}</div><div className="mt-1 text-[13px] font-semibold text-text-1">{value}</div></div>)}
        </div>
      </section>

      <section className="mt-4 py-card p-4">
        <div className="flex items-center justify-between"><span className="text-[14px] font-semibold text-text-1">Emergency fund</span><span className="text-[12px] font-semibold text-accent-text">82%</span></div>
        <div className="mt-3 py-progress-track"><div className="py-progress-fill" style={{ width: "82%" }} /></div>
        <div className="mt-2 text-[10.5px] text-text-3">$24.5k of $30k target</div>
      </section>

      <section className="mt-4 rounded-[18px] border border-border bg-[var(--surface-2)] p-4">
        <div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">AI</span><div><div className="text-[12.5px] font-semibold text-text-1">Project You+ insight</div><p className="m-0 mt-1 text-[12px] leading-relaxed text-text-2">You&apos;re saving 29% of income this month. Your emergency fund is trending ahead of plan.</p></div></div>
      </section>
    </main>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="py-card p-4"><div className="py-eyebrow">{label}</div><div className="mt-2 text-[26px] font-bold tracking-[-0.04em] text-text-1">{value}</div><div className="mt-1 text-[11px] text-text-3">{sub}</div></div>;
}
