"use client";

import { useRef,useState,useTransition } from "react";
import { addFinanceAccount } from "@/lib/actions/money";
import { PlaidLinkButton } from "@/components/money/plaid-link-button";

export function ConnectAccounts(){
  const formRef=useRef<HTMLFormElement>(null);const[message,setMessage]=useState<string|null>(null);const[isPending,startTransition]=useTransition();
  function submit(fd:FormData){setMessage(null);startTransition(()=>{void(async()=>{const r=await addFinanceAccount(fd);if(r?.error)setMessage(r.error);else{setMessage("Account added");formRef.current?.reset();}})()})}
  return <div className="space-y-4">
    <section className="py-glass-hero p-5"><h2 className="m-0 text-[22px] font-semibold tracking-[-.03em] text-white">Bring your financial picture into one place.</h2><p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[#C2BED0]">Connect through Plaid or add balances manually. Bank credentials stay inside Plaid Link and are never entered into Project You+.</p><div className="mt-5"><PlaidLinkButton/></div><p className="m-0 mt-2 text-[10px] leading-relaxed text-[#9E97AC]">Sandbox uses test institutions while we verify consent, account import, transaction sync, and disconnect behavior.</p></section>
    <div className="flex items-center gap-3 px-2"><div className="h-px flex-1 bg-white/[.07]"/><span className="text-[10px] font-medium text-text-3">or add manually</span><div className="h-px flex-1 bg-white/[.07]"/></div>
    <form ref={formRef} action={submit} className="py-glass-soft p-4"><div className="mt-1 space-y-2.5"><input name="name" required placeholder="Account name" className="py-input"/><div className="grid grid-cols-2 gap-2.5"><select name="accountType" defaultValue="checking" className="py-input text-[13px]"><option value="checking">Checking</option><option value="savings">Savings</option><option value="credit">Credit card</option><option value="investment">Investment</option><option value="cash">Cash</option><option value="other">Other</option></select><input name="balance" type="number" step="0.01" required placeholder="Balance" className="py-input"/></div></div>{message&&<div className={`mt-2 text-[11px] ${message==="Account added"?"text-positive":"text-danger"}`}>{message}</div>}<button disabled={isPending} className="py-button-secondary mt-3 w-full disabled:opacity-50">{isPending?"Saving…":"Add account manually"}</button></form>
  </div>
}
