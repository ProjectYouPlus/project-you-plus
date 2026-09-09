"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/lib/actions/auth";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await requestPasswordReset(formData);
        if (result.error) setError(result.error);
        else setSent(true);
      })();
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6">
      <div className="mb-8">
        <ProjectYouLogo className="mb-3 text-[17px] font-semibold" markClassName="h-8 w-8" />
        <h1 className="m-0 text-[26px] font-bold tracking-tight text-text-1">Reset your password</h1>
      </div>

      {sent ? (
        <div className="rounded-sm bg-positive-soft px-4 py-3.5 text-[14.5px] text-text-1">
          If an account exists for that email, a reset link is on its way.
        </div>
      ) : (
        <form action={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text-2">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-sm border border-border bg-surface px-3.5 py-3 text-[15px] text-text-1 outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </label>

          {error && <div className="text-[13.5px] text-danger">{error}</div>}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 rounded-sm bg-text-1 py-[13px] text-[15px] font-semibold text-bg disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-[14px] text-text-2">
        <Link href="/login" className="font-medium text-text-1">
          Back to login
        </Link>
      </p>
    </main>
  );
}
