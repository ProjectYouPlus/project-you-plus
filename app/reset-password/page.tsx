"use client";

import { useState } from "react";
import Link from "next/link";
import { updatePassword } from "@/lib/actions/auth";

export default function ResetPasswordPage() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6">
    <h1 className="mb-6 text-3xl font-bold text-text-1">Choose a new password</h1>
    <form className="flex flex-col gap-4" action={async (data) => {
      setPending(true);
      try { const result = await updatePassword(data); setMessage(result.error ?? result.message ?? ""); }
      catch { setMessage("Unable to update your password. Please try again."); }
      finally { setPending(false); }
    }}>
      <label className="text-text-2">New password<input className="py-input mt-2 w-full" type="password" name="password" minLength={8} required autoComplete="new-password" /></label>
      <button className="py-button-primary" disabled={pending}>{pending ? "Saving…" : "Update password"}</button>
      <p role="status" className="text-text-2">{message}</p>
    </form>
    <Link href="/today" className="mt-6 text-accent-text">Continue to your account</Link>
  </main>;
}
