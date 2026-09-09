"use client";

import { useState } from "react";
import { completeOnboarding } from "@/lib/actions/onboarding";
import type { OnboardingAnswers } from "@/lib/blueprint";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";

const FOCUS_AREAS = ["Health & Fitness", "Career / Business", "Money / Finances", "Relationships", "Mindset", "Lifestyle", "Habits & Discipline"];
const OBSTACLES = ["Time / Schedule", "Lack of Discipline", "Finances", "Stress / Anxiety", "Health / Energy", "Bad Habits", "Lack of Clarity"];
const HEALTH = ["Excellent", "Good", "Average", "Below average", "Poor"];
const FINANCE = ["Very comfortable", "Comfortable", "Stable", "Struggling", "Prefer not to say"];
const HABITS = ["Exercise regularly", "Eat healthier", "Better sleep", "Read more", "Be more disciplined", "Reduce screen time", "Mindfulness"];
const COACHING = ["Direct & challenging", "Supportive & positive", "Data-driven", "Accountability-first", "Highly organized", "Action steps only"];
const MONEY_GOALS = ["Build emergency savings", "Reduce debt", "Increase investing", "Control spending", "Grow income", "Buy real estate"];
const CONNECTIONS = ["Calendar", "Apple Health", "Wearables", "Bank accounts", "Investments"];

const EMPTY: OnboardingAnswers = {
  name: "",
  topGoals: ["", "", ""],
  focusAreas: [],
  idealLifeOneYear: "",
  holdingBack: "",
  exerciseFrequency: "",
  healthEnergyRating: "",
  financeDescription: "",
  habitsToBuild: "",
  habitsToEliminate: "",
  wakeTime: "06:30",
  sleepTime: "23:00",
  primaryActivity: "",
  coachingStyle: [],
  availableDailyTime: "60–90 minutes",
  peakEnergy: "Morning",
  protectedCommitments: "",
  nutritionPhotoTracking: true,
  moneyGoals: [],
  connectionPrefs: [],
};

const TOTAL_STEPS = 5;

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof OnboardingAnswers,>(key: K, value: OnboardingAnswers[K]) => setAnswers((current) => ({ ...current, [key]: value }));
  const toggleArray = (key: "focusAreas" | "coachingStyle" | "moneyGoals" | "connectionPrefs", value: string) => setAnswers((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  const togglePipe = (value: string) => {
    const current = answers.holdingBack ? answers.holdingBack.split(" | ") : [];
    update("holdingBack", current.includes(value) ? current.filter((item) => item !== value).join(" | ") : [...current, value].join(" | "));
  };
  const toggleHabits = (value: string) => {
    const current = answers.habitsToBuild ? answers.habitsToBuild.split(", ") : [];
    update("habitsToBuild", current.includes(value) ? current.filter((item) => item !== value).join(", ") : [...current, value].join(", "));
  };
  const next = () => setStep((value) => Math.min(TOTAL_STEPS - 1, value + 1));
  const back = () => setStep((value) => Math.max(0, value - 1));
  const finish = async () => {
    setPending(true); setError(null);
    try { const result = await completeOnboarding(answers); if (result?.error) setError(result.error); }
    catch { setError("Could not save your plan. Your answers are still here; please try again."); }
    finally { setPending(false); }
  };
  const pct = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  const canContinue = step !== 0 || (answers.name.trim().length > 0 && answers.focusAreas.length > 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg px-5 pb-8 pt-[max(24px,env(safe-area-inset-top))] sm:px-6">
      <div className="pointer-events-none absolute left-1/2 top-[-170px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/10 blur-[95px]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-32px)] w-full max-w-[460px] flex-col">
        <div className="mb-5 flex items-center justify-between">
          <ProjectYouLogo compact markClassName="h-8 w-8" />
          <span className="text-[11px] font-medium text-text-3">Step {step + 1} of {TOTAL_STEPS}</span>
        </div>
        <div className="py-progress-track mb-8"><div className="py-progress-fill transition-all duration-300" style={{ width: `${pct}%` }} /></div>

        <div className="flex-1">
          {step === 0 && (
            <StepShell eyebrow="Priorities" title="What are you building?" sub="Start with what matters most. Project You+ will turn this into your first operating plan.">
              <div className="space-y-4">
                <Field label="Your name"><input autoFocus value={answers.name} onChange={(event) => update("name", event.target.value)} placeholder="What should we call you?" className="py-input" /></Field>
                <div><FieldLabel>What matters most right now?</FieldLabel><ChoiceGrid options={FOCUS_AREAS} selected={answers.focusAreas} onSelect={(value) => toggleArray("focusAreas", value)} /></div>
                <div><FieldLabel>Your top 3 goals</FieldLabel><div className="space-y-2.5">{[0, 1, 2].map((index) => <input key={index} value={answers.topGoals[index]} onChange={(event) => { const goals = [...answers.topGoals]; goals[index] = event.target.value; update("topGoals", goals); }} placeholder={`${index + 1}. I want to…`} className="py-input" />)}</div></div>
                <Field label="What would make the next year feel successful?"><textarea value={answers.idealLifeOneYear} onChange={(event) => update("idealLifeOneYear", event.target.value)} rows={4} placeholder="A year from now…" className="py-input resize-none leading-6" /></Field>
              </div>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell eyebrow="Reality" title="How does your real life work?" sub="The plan should fit your schedule, not fight it.">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3"><Field label="Wake"><input type="time" value={answers.wakeTime} onChange={(event) => update("wakeTime", event.target.value)} className="py-input" /></Field><Field label="Sleep"><input type="time" value={answers.sleepTime} onChange={(event) => update("sleepTime", event.target.value)} className="py-input" /></Field></div>
                <Field label="Work / primary activity"><input value={answers.primaryActivity} onChange={(event) => update("primaryActivity", event.target.value)} placeholder="e.g. 9–7 sales schedule" className="py-input" /></Field>
                <div className="grid grid-cols-2 gap-3"><Field label="Time you can protect daily"><select value={answers.availableDailyTime} onChange={(event) => update("availableDailyTime", event.target.value)} className="py-input"><option>30 minutes</option><option>60–90 minutes</option><option>2–3 hours</option><option>3+ hours</option></select></Field><Field label="Best energy"><select value={answers.peakEnergy} onChange={(event) => update("peakEnergy", event.target.value)} className="py-input"><option>Morning</option><option>Midday</option><option>Afternoon</option><option>Evening</option></select></Field></div>
                <div><FieldLabel>What gets in the way?</FieldLabel><ChoiceGrid options={OBSTACLES} selected={answers.holdingBack ? answers.holdingBack.split(" | ") : []} onSelect={togglePipe} /></div>
                <Field label="Protected commitments"><input value={answers.protectedCommitments} onChange={(event) => update("protectedCommitments", event.target.value)} placeholder="Family time, school pickup, religious commitments…" className="py-input" /></Field>
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell eyebrow="Body & routines" title="What does better health look like for you?" sub="We’ll tune recommendations to your current energy, training, and daily habits.">
              <div className="space-y-5">
                <div><FieldLabel>Current health & energy</FieldLabel><RadioList options={HEALTH} selected={answers.healthEnergyRating} onSelect={(value) => update("healthEnergyRating", value)} /></div>
                <Field label="Exercise frequency"><select value={answers.exerciseFrequency} onChange={(event) => update("exerciseFrequency", event.target.value)} className="py-input"><option value="">Choose one</option><option>Rarely or never</option><option>1–2x per week</option><option>3–4x per week</option><option>5+ times per week</option></select></Field>
                <div><FieldLabel>Habits you want to build</FieldLabel><ChoiceGrid options={HABITS} selected={answers.habitsToBuild ? answers.habitsToBuild.split(", ") : []} onSelect={toggleHabits} /></div>
                <Field label="One habit you want to reduce"><input value={answers.habitsToEliminate} onChange={(event) => update("habitsToEliminate", event.target.value)} placeholder="Late-night scrolling, takeout, skipping workouts…" className="py-input" /></Field>
                <button type="button" onClick={() => update("nutritionPhotoTracking", !answers.nutritionPhotoTracking)} className="flex w-full items-center justify-between rounded-[16px] border border-border bg-surface p-4 text-left"><div><div className="text-[14px] font-semibold text-text-1">Photo nutrition tracking</div><div className="mt-1 text-[12px] leading-relaxed text-text-2">Photograph meals and let AI estimate macros for review.</div></div><Toggle checked={answers.nutritionPhotoTracking} /></button>
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell eyebrow="Money & coaching" title="How should Project You+ help you make decisions?" sub="Your financial context and coaching style change what advice is useful.">
              <div className="space-y-5">
                <div><FieldLabel>Current financial position</FieldLabel><RadioList options={FINANCE} selected={answers.financeDescription} onSelect={(value) => update("financeDescription", value)} /></div>
                <div><FieldLabel>Financial goals</FieldLabel><ChoiceGrid options={MONEY_GOALS} selected={answers.moneyGoals} onSelect={(value) => toggleArray("moneyGoals", value)} /></div>
                <div><FieldLabel>AI Coach style</FieldLabel><ChoiceGrid options={COACHING} selected={answers.coachingStyle} onSelect={(value) => toggleArray("coachingStyle", value)} /></div>
              </div>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell eyebrow="Connections" title="Build your Project You+ system." sub="Choose which data sources you may want to connect. You can change every permission later.">
              <div className="space-y-4">
                <div className="py-card px-4">
                  {CONNECTIONS.map((connection) => {
                    const active = answers.connectionPrefs.includes(connection);
                    return <button key={connection} type="button" onClick={() => toggleArray("connectionPrefs", connection)} className="py-list-row w-full text-left"><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-text-1">{connection}</span><span className="mt-0.5 block text-[11.5px] text-text-2">Optional · connect when you&apos;re ready</span></span><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${active ? "border-accent bg-accent text-white" : "border-border"}`}>{active ? "✓" : ""}</span></button>;
                  })}
                </div>
                <div className="py-accent-card p-4">
                  <div className="py-section-label text-accent-text">Your starting system</div>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <Summary label="Priorities" value={`${answers.focusAreas.length || 0} selected`} />
                    <Summary label="Goals" value={`${answers.topGoals.filter(Boolean).length || 0} defined`} />
                    <Summary label="Daily capacity" value={answers.availableDailyTime} />
                    <Summary label="Coach" value={answers.coachingStyle[0] ?? "Personalized"} />
                  </div>
                  <p className="mb-0 mt-3 text-[11.5px] leading-relaxed text-text-2">Project You+ will use this to create your first goals, habits, planning rhythm, and AI coaching context.</p>
                </div>
              </div>
            </StepShell>
          )}
        </div>

        {error && <p role="alert" className="mt-4 text-danger">{error}</p>}
        <div className="mt-8 flex items-center gap-3 pb-[max(0px,env(safe-area-inset-bottom))]">
          {step > 0 && <button onClick={back} className="py-button-secondary min-w-[92px]">Back</button>}
          {step < TOTAL_STEPS - 1 ? <button onClick={next} disabled={!canContinue} className="py-button-primary flex-1 disabled:opacity-40">Continue</button> : <button onClick={finish} disabled={isPending} className="py-button-primary flex-1 disabled:opacity-60">{isPending ? "Building your plan…" : "Create my Project You+ plan"}</button>}
        </div>
      </div>
    </main>
  );
}

function StepShell({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub: string; children: React.ReactNode }) {
  return <section><div className="py-eyebrow mb-2 text-accent-text">{eyebrow}</div><h1 className="m-0 max-w-[410px] text-[30px] font-bold leading-[1.08] tracking-[-0.045em] text-text-1">{title}</h1><p className="mb-6 mt-2 max-w-[405px] text-[13.5px] leading-relaxed text-text-2">{sub}</p>{children}</section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><FieldLabel>{label}</FieldLabel>{children}</label>; }
function FieldLabel({ children }: { children: React.ReactNode }) { return <span className="mb-2 block text-[11.5px] font-semibold text-text-2">{children}</span>; }
function ChoiceGrid({ options, selected, onSelect }: { options: string[]; selected: string[]; onSelect: (value: string) => void }) {
  return <div className="grid grid-cols-2 gap-2">{options.map((option) => { const active = selected.includes(option); return <button key={option} type="button" onClick={() => onSelect(option)} className={`min-h-[48px] rounded-[14px] border px-3 py-2.5 text-left text-[12.5px] font-medium transition ${active ? "border-accent bg-accent-soft text-text-1" : "border-border bg-surface text-text-2"}`}>{option}</button>; })}</div>;
}
function RadioList({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (value: string) => void }) {
  return <div className="space-y-2">{options.map((option) => { const active = selected === option; return <button key={option} type="button" onClick={() => onSelect(option)} className={`flex min-h-[48px] w-full items-center gap-3 rounded-[14px] border px-4 text-left text-[13px] font-medium transition ${active ? "border-accent bg-accent-soft text-text-1" : "border-border bg-surface text-text-2"}`}><span className={`h-4 w-4 rounded-full border-[1.5px] ${active ? "border-[5px] border-accent" : "border-border"}`} />{option}</button>; })}</div>;
}
function Toggle({ checked }: { checked: boolean }) { return <span className="relative h-6 w-[42px] shrink-0 rounded-full" style={{ background: checked ? "var(--accent)" : "var(--border)" }}><span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform" style={{ transform: checked ? "translateX(21px)" : "translateX(3px)" }} /></span>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-[14px] bg-[rgba(255,255,255,.04)] p-3"><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-3">{label}</div><div className="mt-1 text-[12.5px] font-semibold text-text-1">{value}</div></div>; }
