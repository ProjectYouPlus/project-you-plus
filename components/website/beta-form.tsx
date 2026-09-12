"use client";
import { useRef, useState, type FormEvent } from "react";
import { track, visit } from "@/lib/website/client";
export function BetaForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "joined" | "already_joined">("idle");
  const [error, setError] = useState("");
  const started = useRef(false); const result = useRef<HTMLDivElement>(null);
  function start() { if (!started.current) { started.current = true; track("waitlist_form_started"); } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (status === "saving") return; setStatus("saving"); setError("");
    const form = new FormData(event.currentTarget); const data = visit();
    try {
      const response = await fetch("/api/beta-waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, referral_source: data.referral_source ? `https://${data.referral_source}` : null, name: form.get("name"), email: form.get("email"), improvement_goal: form.get("improvement_goal"), willingness_to_pay: form.get("willingness_to_pay"), website: form.get("website") }) });
      const body = await response.json();
      if (!response.ok || !["joined", "already_joined"].includes(body.status)) throw new Error(body.error || "Please try again in a moment.");
      setStatus(body.status); requestAnimationFrame(() => result.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connection interrupted. Please try again."); setStatus("idle"); }
  }
  if (status === "joined" || status === "already_joined") return <div className="beta-result" ref={result} tabIndex={-1} role="status"><span className="result-check" aria-hidden="true">✓</span><h3>{status === "joined" ? "You’re on the list." : "You’re already on the list."}</h3><p>{status === "joined" ? "We’ll let you know when your private beta access is ready." : "We’ll keep you updated as private beta access expands."}</p><p className="fine-print">Private beta members will receive founding-member benefits at launch.</p></div>;
  return <form className="beta-form" onSubmit={submit} onFocusCapture={start} aria-label="Join the private beta">
    <div className="form-pair"><label htmlFor="beta-name">Name<input id="beta-name" name="name" required maxLength={100} autoComplete="name" placeholder="Your name" /></label><label htmlFor="beta-email">Email<input id="beta-email" name="email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" placeholder="you@example.com" /></label></div>
    <label htmlFor="beta-goal">What do you most want to improve? <span>Optional</span><textarea id="beta-goal" name="improvement_goal" maxLength={1000} rows={2} placeholder="Discipline, health, finances, career, consistency…" /></label>
    <div className="form-honeypot" aria-hidden="true"><label htmlFor="beta-website">Leave this empty<input id="beta-website" name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="site-button form-submit" type="submit" disabled={status === "saving"} onClick={() => track("bottom_beta_cta_click")}>{status === "saving" ? "Saving your place…" : "Join the private beta"}<span aria-hidden="true">↗</span></button>
    <p className="fine-print">Private beta members will receive access to exclusive founding-member pricing at launch.</p>
    <p className="privacy-note">Your details are used for beta access and product research. <a href="#privacy">How we use your information</a></p>
  </form>;
}
