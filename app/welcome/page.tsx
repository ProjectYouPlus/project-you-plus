import Link from "next/link";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";

export default function WelcomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-5 py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[48vh] bg-[radial-gradient(circle_at_50%_15%,rgba(139,92,246,.22),transparent_58%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[420px] flex-col">
        <ProjectYouLogo className="text-[17px] font-semibold" markClassName="h-9 w-9" />
        <div className="flex flex-1 flex-col justify-center pb-8 pt-12">
          <div className="mb-10 flex justify-center">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-[28px] border border-accent/25 bg-surface shadow-[0_0_70px_rgba(139,92,246,.24)]">
              <ProjectYouLogo compact markClassName="h-16 w-16" />
              <div className="absolute inset-0 rounded-[28px] bg-[linear-gradient(145deg,rgba(255,255,255,.05),transparent_45%)]" />
            </div>
          </div>
          <div className="py-eyebrow mb-3 text-accent-text">A better you, every day.</div>
          <h1 className="m-0 max-w-[360px] text-[42px] font-bold leading-[1.02] tracking-[-0.05em] text-text-1">Build the 1% version of yourself.</h1>
          <p className="mt-5 max-w-[375px] text-[15px] leading-7 text-text-2">Project You+ connects your goals, time, health, money and habits so your AI can help you make better decisions every day.</p>
        </div>
        <div className="space-y-3 pb-3">
          <Link href="/signup" className="py-button-primary w-full">Get started</Link>
          <Link href="/login" className="py-button-secondary w-full">I already have an account</Link>
          <p className="m-0 pt-2 text-center text-[11px] text-text-3">Private by design. You choose what your AI can access.</p>
        </div>
      </div>
    </main>
  );
}
