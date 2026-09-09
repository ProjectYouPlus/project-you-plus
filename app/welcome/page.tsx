import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050509] text-white">
      <div className="relative mx-auto min-h-[852px] w-full max-w-[393px] overflow-hidden">
        <div className="pointer-events-none absolute left-[-18px] top-[-150px] h-[430px] w-[430px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.18)_0%,rgba(139,92,246,.08)_35%,transparent_70%)] blur-[2px]" />
        <div className="absolute left-1/2 top-[104px] flex h-[116px] w-[116px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-[28px]">
          <img src="/project-you-plus-logo.svg" alt="Project You+" className="h-[116px] w-[116px] object-contain" />
        </div>
        <h1 className="absolute left-[18px] top-[256px] m-0 w-[357px] text-center text-[31px] font-bold leading-[1.12] tracking-[-0.035em]">Build the life you want.</h1>
        <p className="absolute left-1/2 top-[310px] m-0 w-[325px] -translate-x-1/2 text-center text-[14px] leading-[18px] text-[#9A9AA8]">One intelligent system for your goals, health, money, habits, fitness, time, and progress.</p>
        <section className="absolute left-[18px] top-[390px] h-[142px] w-[357px] rounded-[22px] bg-[#0D0D14] px-[18px] py-[14px]">
          <ValueRow title="Know what matters" copy="AI turns your goals into priorities." />
          <ValueRow title="Stay consistent" copy="Your habits, calendar, and health stay connected." />
          <ValueRow title="See real progress" copy="One view shows what is actually improving." />
        </section>
        <button type="button" disabled title="Apple sign-in will be enabled in the native iOS phase. Use email for this test." className="absolute left-[18px] top-[562px] flex h-[52px] w-[357px] cursor-not-allowed items-center justify-center rounded-[16px] bg-white text-[14px] font-semibold text-[#050509]">Continue with Apple</button>
        <Link href="/signup" className="absolute left-[18px] top-[626px] flex h-[52px] w-[357px] items-center justify-center rounded-[16px] border border-[#292938] bg-[#151521] text-[14px] font-semibold text-white no-underline active:scale-[.99]">Continue with Email</Link>
        <p className="absolute left-0 top-[701px] m-0 w-full text-center text-[12px] font-medium text-[#9A9AA8]">Already have an account? <Link href="/login" className="font-semibold text-white no-underline">Sign in</Link></p>
        <p className="absolute left-0 top-[744px] m-0 w-full text-center text-[10px] text-[#9A9AA8]">By continuing, you agree to the Terms and Privacy Policy.</p>
      </div>
    </main>
  );
}

function ValueRow({ title, copy }: { title: string; copy: string }) {
  return <div className="flex h-[38px] items-start gap-[12px]"><span className="mt-[8px] h-2 w-2 shrink-0 rounded-full bg-[#8B5CF6]" /><div><div className="text-[13px] font-semibold leading-[18px] text-white">{title}</div><div className="text-[11px] leading-[15px] text-[#9A9AA8]">{copy}</div></div></div>;
}
