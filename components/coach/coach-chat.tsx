"use client";

import { useRef, useState, useTransition } from "react";
import type { CoachMessage } from "@/lib/types";

type CoachMode = "decide" | "plan" | "reflect";

const MODES: Array<{ id: CoachMode; label: string; sub: string }> = [
  { id: "decide", label: "Decide", sub: "What matters now" },
  { id: "plan", label: "Plan", sub: "Turn intent into time" },
  { id: "reflect", label: "Reflect", sub: "Find the pattern" },
];

const PROMPTS: Record<CoachMode, string[]> = {
  decide: ["What should I focus on today?", "What can I safely ignore?", "What is my highest-leverage move?"],
  plan: ["Plan my day.", "Find time for my workout.", "How should I sequence today’s tasks?"],
  reflect: ["How am I progressing?", "What’s holding me back?", "What is my biggest opportunity?"],
};

const INITIAL: CoachMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "I’m looking across your goals, tasks, habits, score, health, money, and schedule. Tell me what decision you’re trying to make.",
  },
];

export function CoachChat() {
  const [messages, setMessages] = useState<CoachMessage[]>(INITIAL);
  const [input, setInput] = useState("");
  const [coachMode, setCoachMode] = useState<CoachMode>("decide");
  const [intelligenceMode, setIntelligenceMode] = useState<"claude" | "local" | "local-fallback" | null>(null);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    const prior = messages.filter((message) => message.id !== "welcome").map(({ role, content }) => ({ role, content }));
    const userMessage: CoachMessage = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    setMessages((current) => [...current, userMessage]);
    setInput("");

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/coach", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: trimmed, history: prior, coachMode }),
          });
          if (!response.ok) throw new Error("Coach request failed");
          const data = (await response.json()) as { reply?: string; mode?: "claude" | "local" | "local-fallback" };
          setIntelligenceMode(data.mode ?? null);
          setMessages((current) => [...current, { id: `a-${Date.now()}`, role: "assistant", content: data.reply || "I couldn’t generate a response." }]);
        } catch {
          setMessages((current) => [...current, { id: `a-${Date.now()}`, role: "assistant", content: "I couldn’t reach the intelligence layer. Try again in a moment." }]);
        }
        requestAnimationFrame(() => { const list = listRef.current; if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" }); });
      })();
    });
  }

  return (
    <div className="flex h-[calc(100vh-165px)] min-h-[610px] flex-col md:h-[calc(100vh-64px)]">
      <div className="border-b border-border px-4 pb-3 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-accent-text">Project You+ Intelligence</div>
            <div className="mt-1 text-[12px] text-text-2">Grounded in your connected context</div>
          </div>
          {intelligenceMode && <span className="rounded-full border border-border px-2.5 py-1 text-[10.5px] font-semibold text-text-3">{intelligenceMode === "claude" ? "AI live" : intelligenceMode === "local-fallback" ? "Local fallback" : "Local intelligence"}</span>}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {MODES.map((mode) => {
            const active = coachMode === mode.id;
            return <button key={mode.id} onClick={() => setCoachMode(mode.id)} className={`rounded-[14px] border px-2 py-2.5 text-left transition ${active ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}><span className={`block text-[12px] font-semibold ${active ? "text-text-1" : "text-text-2"}`}>{mode.label}</span><span className="mt-0.5 hidden text-[9.5px] text-text-3 sm:block">{mode.sub}</span></button>;
          })}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pt-5 sm:px-6">
        {messages.map((message) => (
          <div key={message.id} className={`mb-3 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-[18px] px-4 py-3 text-[14px] leading-relaxed ${message.role === "user" ? "bg-accent text-white" : "bg-[var(--surface-2)] text-text-1"}`}>{message.content}</div>
          </div>
        ))}
        {isPending && <div className="mb-3 flex justify-start"><div className="rounded-[18px] bg-[var(--surface-2)] px-4 py-3 text-[13px] text-text-3">Reading your context…</div></div>}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-6">
          {PROMPTS[coachMode].map((prompt) => <button key={prompt} onClick={() => send(prompt)} className="rounded-full border border-border bg-surface px-3.5 py-2 text-[12px] font-medium text-text-1 transition active:scale-[.99]">{prompt}</button>)}
        </div>
      )}

      <form onSubmit={(event) => { event.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-border px-4 py-3.5 sm:px-6">
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={coachMode === "decide" ? "What decision are you making?" : coachMode === "plan" ? "What do you need to fit in?" : "What do you want to understand?"} className="min-h-[46px] flex-1 rounded-full border border-border bg-surface px-4 text-[14px] text-text-1 outline-none focus:border-accent" />
        <button type="submit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50" disabled={!input.trim() || isPending}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </form>
    </div>
  );
}
