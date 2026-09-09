import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "@/lib/actions/auth";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";

export default function SignupPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg px-5 py-8 sm:px-6">
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/10 blur-[90px]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[420px] flex-col justify-center">
        <ProjectYouLogo className="mb-10 text-[17px] font-semibold" markClassName="h-9 w-9" />
        <div className="mb-7">
          <div className="py-eyebrow mb-2">Start Project You+</div>
          <h1 className="m-0 text-[30px] font-bold tracking-[-0.035em] text-text-1">Create your account.</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-text-2">Your Personal Blueprint starts with a few questions about the life you want to build.</p>
        </div>
        <AuthForm mode="signup" action={signUp} />
        <p className="mt-6 text-center text-[11px] leading-relaxed text-text-3">By continuing, you agree to the Terms and acknowledge the Privacy Policy.</p>
        <p className="mt-4 text-center text-[13.5px] text-text-2">
          Already have an account? <Link href="/login" className="font-semibold text-accent-text">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
