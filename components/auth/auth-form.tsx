"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { AuthResult } from "@/lib/actions/auth";

interface AuthFormProps {
  mode: "login" | "signup";
  action: (formData: FormData) => Promise<AuthResult>;
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
        const result = await action(formData);
        if (result.error) setError(result.error);
        else if (result.message) setMessage(result.message);
    } catch { setError("Unable to connect. Please try again."); }
    finally { setPending(false); }
  }

  async function social(provider: "apple" | "google") {
    setPending(true); setError(null);
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/confirm` } });
      if (error) setError(error.message);
    } catch { setError("This sign-in provider is not available yet. Use email and password."); }
    finally { setPending(false); }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      {mode === "signup" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-text-2">Full name</span>
          <input name="fullName" autoComplete="name" className="py-input" placeholder="Your name" />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-text-2">Email</span>
        <input type="email" name="email" required autoComplete="email" className="py-input" placeholder="you@example.com" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-text-2">Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="py-input"
          placeholder="••••••••"
        />
      </label>

      {mode === "login" && (
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-[12.5px] font-medium text-accent-text">
            Forgot password?
          </Link>
        </div>
      )}

      {error && <div className="rounded-xl border border-danger bg-[rgba(239,68,68,.08)] px-3 py-2.5 text-[13px] text-danger">{error}</div>}
      {message && <div className="rounded-xl border border-success/30 bg-[rgba(54,217,139,.08)] px-3 py-2.5 text-[13px] text-text-1">{message}</div>}

      <button type="submit" disabled={isPending} className="py-button-primary mt-1 w-full disabled:opacity-60">
        {isPending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </button>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11.5px] text-text-3">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button type="button" disabled={isPending} onClick={() => social("apple")} className="py-button-secondary w-full gap-2.5" aria-label="Continue with Apple">
        <span className="text-[18px] leading-none">●</span>
        Continue with Apple
      </button>
      <button type="button" disabled={isPending} onClick={() => social("google")} className="py-button-secondary w-full gap-2.5" aria-label="Continue with Google">
        <span className="text-[16px] font-bold text-[#4285F4]">G</span>
        Continue with Google
      </button>
    </form>
  );
}
