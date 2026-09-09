import Link from "next/link";
import { ConnectAccounts } from "@/components/money/connect-accounts";

export default function ConnectMoneyPage() {
  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="mb-6 flex items-start gap-3">
        <Link href="/money" className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-[22px] text-text-2">‹</Link>
        <div>
          <div className="py-eyebrow mb-1">Financial connections</div>
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.04em] text-text-1">Connect your money</h1>
          <p className="py-subtitle">Choose what Project You+ can use to build your financial picture.</p>
        </div>
      </header>
      <ConnectAccounts />
    </main>
  );
}
