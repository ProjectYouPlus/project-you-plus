"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { AuthResult } from "@/lib/actions/auth";

interface AuthFormProps { mode: "login" | "signup"; action: (formData: FormData) => Promise<AuthResult>; }
const googleEnabled=process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED==="true";
const appleEnabled=process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED==="true";

export function AuthForm({ mode, action }: AuthFormProps) {
  const [error,setError]=useState<string|null>(null);const[message,setMessage]=useState<string|null>(null);const[isPending,setPending]=useState(false);
  async function handleSubmit(formData:FormData){setError(null);setMessage(null);setPending(true);try{const result=await action(formData);if(result.error)setError(result.error);else if(result.message)setMessage(result.message)}catch{setError("Unable to connect. Please try again.")}finally{setPending(false)}}
  async function social(provider:"apple"|"google"){setPending(true);setError(null);try{const {error}=await createClient().auth.signInWithOAuth({provider,options:{redirectTo:`${window.location.origin}/auth/confirm`}});if(error)setError(error.message)}catch{setError("This sign-in provider is not configured yet. Use email and password.")}finally{setPending(false)}}
  const hasSocial=googleEnabled||appleEnabled;
  return <form action={handleSubmit} className="flex flex-col gap-4">
    {mode==="signup"&&<label className="flex flex-col gap-1.5"><span className="text-[12px] font-medium text-text-2">Full name</span><input name="fullName" autoComplete="name" className="py-input" placeholder="Your name" required/></label>}
    <label className="flex flex-col gap-1.5"><span className="text-[12px] font-medium text-text-2">Email</span><input type="email" name="email" required autoComplete="email" className="py-input" placeholder="you@example.com"/></label>
    <label className="flex flex-col gap-1.5"><span className="text-[12px] font-medium text-text-2">Password</span><input type="password" name="password" required minLength={8} autoComplete={mode==="login"?"current-password":"new-password"} className="py-input" placeholder="••••••••"/></label>
    {mode==="login"&&<div className="-mt-1 text-right"><Link href="/forgot-password" className="text-[12px] font-medium text-accent-text">Forgot password?</Link></div>}
    {error&&<div className="rounded-[14px] border border-danger/40 bg-[rgba(239,68,68,.08)] px-3 py-2.5 text-[12px] text-danger">{error}</div>}
    {message&&<div className="rounded-[14px] border border-positive/30 bg-positive-soft px-3 py-2.5 text-[12px] text-text-1">{message}</div>}
    <button type="submit" disabled={isPending} className="py-liquid-button mt-1 w-full disabled:opacity-60">{isPending?"Please wait…":mode==="login"?"Sign in":"Create account"}</button>
    {hasSocial&&<><div className="flex items-center gap-3 py-1"><div className="h-px flex-1 bg-border"/><span className="text-[11px] text-text-3">or</span><div className="h-px flex-1 bg-border"/></div>{appleEnabled&&<button type="button" disabled={isPending} onClick={()=>social("apple")} className="py-glass min-h-[48px] w-full rounded-[16px] text-[13px] font-semibold text-text-1">Continue with Apple</button>}{googleEnabled&&<button type="button" disabled={isPending} onClick={()=>social("google")} className="py-glass min-h-[48px] w-full rounded-[16px] text-[13px] font-semibold text-text-1">Continue with Google</button>}</>}
    {!hasSocial&&<p className="m-0 rounded-[14px] border border-white/[.05] bg-white/[.02] px-3 py-2.5 text-center text-[10.5px] leading-relaxed text-text-3">Email sign-in is live. Apple and Google will appear here only after their production OAuth credentials are configured.</p>}
  </form>
}
