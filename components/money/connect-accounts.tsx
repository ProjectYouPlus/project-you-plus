"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SOURCES = [
  { id: "bank", title: "Bank accounts", sub: "Checking, savings, credit cards", icon: "$" },
  { id: "investments", title: "Investments", sub: "Brokerage and retirement accounts", icon: "↗" },
];

export function ConnectAccounts() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(["bank", "investments"]);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  function toggle(id: string) {
    setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  function connect() {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
      window.localStorage.setItem("project-you-finance-connected", JSON.stringify(selected));
    }, 700);
  }

  if (connected) {
    return (
      <section className="py-accent-card p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-positive-soft text-[24px] text-positive">✓</div>
        <h2 className="m-0 mt-4 text-[22px] font-semibold text-text-1">Connection ready</h2>
        <p className="mx-auto mt-2 max-w-[320px] text-[13px] leading-relaxed text-text-2">The prototype connection is saved. In production this handoff will open the secure financial-data provider and return only permissioned account data.</p>
        <button onClick={() => router.push("/money?connected=1")} className="py-button-primary mt-5 w-full">Back to Money</button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="py-card px-4">
        {SOURCES.map((source) => {
          const active = selected.includes(source.id);
          return (
            <button key={source.id} onClick={() => toggle(source.id)} className="py-list-row w-full text-left">
              <span className="py-icon-tile text-[17px] font-bold text-accent-text">{source.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-text-1">{source.title}</span>
                <span className="mt-0.5 block text-[12px] text-text-2">{source.sub}</span>
              </span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${active ? "border-accent bg-accent text-white" : "border-border"}`}>{active ? "✓" : ""}</span>
            </button>
          );
        })}
      </section>

      <section className="rounded-[18px] border border-border bg-[var(--surface-2)] p-4">
        <div className="text-[12.5px] font-semibold text-text-1">Read-only by default</div>
        <p className="m-0 mt-1 text-[12px] leading-relaxed text-text-2">Project You+ should request the minimum data required for cash flow, net worth, recurring bills, and portfolio context. It should never ask for or store your bank password directly.</p>
      </section>

      <section className="py-card p-4">
        <div className="py-eyebrow">What this unlocks</div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-[12px] text-text-2">
          <div className="rounded-[14px] bg-[var(--surface-2)] p-3"><span className="block font-semibold text-text-1">Net worth</span><span className="mt-1 block">Accounts + investments in one view</span></div>
          <div className="rounded-[14px] bg-[var(--surface-2)] p-3"><span className="block font-semibold text-text-1">Cash flow</span><span className="mt-1 block">Income, spend, savings pace</span></div>
          <div className="rounded-[14px] bg-[var(--surface-2)] p-3"><span className="block font-semibold text-text-1">AI insights</span><span className="mt-1 block">Goal-aware recommendations</span></div>
          <div className="rounded-[14px] bg-[var(--surface-2)] p-3"><span className="block font-semibold text-text-1">Portfolio</span><span className="mt-1 block">Allocation and progress</span></div>
        </div>
      </section>

      <button onClick={connect} disabled={!selected.length || connecting} className="py-button-primary w-full disabled:opacity-50">{connecting ? "Opening secure connection…" : "Connect securely"}</button>
    </div>
  );
}
