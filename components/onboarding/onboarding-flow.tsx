"use client";

import { useMemo, useState } from "react";
import { completeOnboarding } from "@/lib/actions/onboarding";
import type { OnboardingAnswers } from "@/lib/blueprint";

const PRIORITIES = [
  ["Health", "Feel better, eat better, recover"],
  ["Fitness", "Train consistently and get stronger"],
  ["Money", "Build savings, invest, control spending"],
  ["Career", "Perform better and grow professionally"],
  ["Business", "Build and launch something meaningful"],
  ["Family", "Protect quality time and relationships"],
  ["Habits", "Build routines that actually stick"],
  ["Time", "Use your days more intentionally"],
] as const;

const PERSONAL_TIME = ["Early morning", "Midday", "Late afternoon", "Evening"];
const ENERGY = ["Morning", "Afternoon", "Evening"];
const PROTECTED = [["Family time", "Evenings"], ["Workout time", "4–5× / week"], ["Sleep window", "7+ hours"]] as const;
const HEALTH_GOALS = ["Lose fat", "Build muscle", "More energy", "Longevity"];
const TRAINING = [["3×", "Light"], ["4×", "Balanced"], ["5×", "Committed"]] as const;
const MONEY = ["Save more", "Pay down debt", "Invest consistently", "Control spending"];
const COACH = [["Direct", "Tell me what to do"], ["Supportive", "Guide and encourage"], ["Strategic", "Explain the why"]] as const;
const CONNECTIONS = [["Apple Health", "Steps, sleep, workouts"], ["Calendar", "Schedule and free time"], ["Bank & cards", "Cash flow and spending"], ["Investments", "Portfolio and allocation"]] as const;

export function OnboardingFlow({ initialName }: { initialName: string }) {
  const [step, setStep] = useState(0);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [ninetyDayWin, setNinetyDayWin] = useState("");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("19:00");
  const [personalTime, setPersonalTime] = useState<string[]>([]);
  const [peakEnergy, setPeakEnergy] = useState("Morning");
  const [protectedItems, setProtectedItems] = useState<string[]>([]);
  const [healthGoals, setHealthGoals] = useState<string[]>([]);
  const [training, setTraining] = useState("4×");
  const [nutritionTracking, setNutritionTracking] = useState(true);
  const [moneyGoals, setMoneyGoals] = useState<string[]>([]);
  const [coachStyle, setCoachStyle] = useState("Direct");
  const [connections, setConnections] = useState<string[]>([]);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPriorityText = useMemo(() => priorities.slice(0, 3).join(" + ") || "Your priorities", [priorities]);

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, value: string, max?: number) {
    setter((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (max && current.length >= max) return current;
      return [...current, value];
    });
  }

  function next() {
    setError(null);
    if (step === 0 && priorities.length === 0) {
      setError("Choose at least one area that matters most right now.");
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  }

  async function finish() {
    setPending(true);
    setError(null);
    const answers: OnboardingAnswers = {
      name: initialName,
      topGoals: ninetyDayWin.trim() ? [ninetyDayWin.trim()] : [],
      focusAreas: priorities,
      idealLifeOneYear: ninetyDayWin.trim(),
      holdingBack: "",
      exerciseFrequency: training === "3×" ? "3x per week" : training === "5×" ? "5+ times per week" : "4x per week",
      healthEnergyRating: healthGoals.join(" + "),
      financeDescription: moneyGoals.join(" + "),
      habitsToBuild: [training ? `Train ${training} per week` : "", nutritionTracking ? "Review nutrition from meal photos" : ""].filter(Boolean).join(", "),
      habitsToEliminate: "",
      wakeTime: "06:30",
      sleepTime: "23:00",
      primaryActivity: `Typical workday ${workStart}–${workEnd}`,
      coachingStyle: coachStyle ? [coachStyle] : [],
      availableDailyTime: personalTime.length ? personalTime.join(", ") : "Flexible personal time",
      peakEnergy,
      protectedCommitments: protectedItems.join(", "),
      nutritionPhotoTracking: nutritionTracking,
      moneyGoals,
      connectionPrefs: connections,
    };
    try {
      const result = await completeOnboarding(answers);
      if (result?.error) setError(result.error);
    } catch {
      setError("Could not save your plan. Your answers are still here; please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050509] text-white">
      <div className="relative mx-auto min-h-[852px] w-full max-w-[393px] overflow-hidden px-[18px] pb-[28px] pt-[24px]">
        {step < 4 ? <><div className="text-[11px] font-semibold text-[#9A9AA8]">{step + 1} of 5</div><div className="mt-[10px] h-[6px] w-full overflow-hidden rounded-full bg-[#151521]"><div className="h-full rounded-full bg-[#8B5CF6] transition-all duration-300" style={{ width: `${(step + 1) * 20}%` }} /></div></> : null}
        <div className={step < 4 ? "mt-[28px]" : ""}>
          {step === 0 && <>
            <Header title="What matters most right now?" sub="Choose up to four areas. Project You+ will use these to prioritize your plan." />
            <div className="mt-[26px] grid grid-cols-2 gap-x-[15px] gap-y-[12px]">{PRIORITIES.map(([title, copy]) => <ChoiceCard key={title} title={title} copy={copy} active={priorities.includes(title)} onClick={() => toggle(setPriorities, title, 4)} />)}</div>
            <Card className="mt-[28px] p-[14px]"><div className="text-[14px] font-semibold">What would make the next 90 days a win?</div><input value={ninetyDayWin} onChange={(event) => setNinetyDayWin(event.target.value)} className="mt-[10px] h-[46px] w-full rounded-[14px] border-0 bg-[#151521] px-[12px] text-[12px] text-white outline-none placeholder:text-[#9A9AA8] focus:ring-1 focus:ring-[#8B5CF6]" placeholder="Example: lose 10 lb, save $5k, launch MVP…" /></Card>
            <Card className="mt-[16px] flex h-[74px] items-center gap-[10px] px-[14px]"><div className="h-[28px] w-[28px] shrink-0 rounded-full bg-[#8B5CF6]" /><div><div className="text-[12px] font-semibold">Why this matters</div><div className="mt-[4px] text-[11px] leading-[14px] text-[#9A9AA8]">Your priorities control what appears in Today, your AI Coach, and your weekly review.</div></div></Card>
          </>}

          {step === 1 && <>
            <Header title="Design around your real life." sub="Tell us when you have time, energy, and non-negotiable commitments." />
            <Card className="mt-[26px] p-[14px]"><SectionTitle>Typical workday</SectionTitle><div className="mt-[14px] grid grid-cols-2 gap-[23px]"><TimeBox value={workStart} onChange={setWorkStart} /><TimeBox value={workEnd} onChange={setWorkEnd} /></div></Card>
            <Card className="mt-[16px] p-[14px]"><SectionTitle>When do you usually have personal time?</SectionTitle><div className="mt-[14px] grid grid-cols-2 gap-x-[23px] gap-y-[12px]">{PERSONAL_TIME.map((item) => <MiniChoice key={item} active={personalTime.includes(item)} onClick={() => toggle(setPersonalTime, item)}>{item}</MiniChoice>)}</div></Card>
            <Card className="mt-[16px] p-[14px]"><SectionTitle>When is your energy usually highest?</SectionTitle><div className="mt-[16px] grid grid-cols-3 gap-[5px]">{ENERGY.map((item) => <PillChoice key={item} active={peakEnergy === item} onClick={() => setPeakEnergy(item)}>{item}</PillChoice>)}</div></Card>
            <Card className="mt-[16px] p-[14px]"><SectionTitle>What should Project You+ protect?</SectionTitle><div className="mt-[16px] grid grid-cols-3 gap-[5px]">{PROTECTED.map(([title, sub]) => <SmallCard key={title} title={title} sub={sub} active={protectedItems.includes(title)} onClick={() => toggle(setProtectedItems, title)} />)}</div></Card>
          </>}

          {step === 2 && <>
            <Header title="How do you want to feel and perform?" sub="We’ll personalize nutrition, workouts, recovery, and daily health targets around your goals." />
            <Card className="mt-[26px] p-[14px]"><SectionTitle>Primary health goal</SectionTitle><div className="mt-[14px] grid grid-cols-2 gap-x-[23px] gap-y-[10px]">{HEALTH_GOALS.map((item) => <MiniChoice key={item} active={healthGoals.includes(item)} onClick={() => toggle(setHealthGoals, item, 2)}>{item}</MiniChoice>)}</div></Card>
            <Card className="mt-[16px] p-[14px]"><SectionTitle>Training frequency</SectionTitle><div className="mt-[14px] grid grid-cols-3 gap-[5px]">{TRAINING.map(([title, sub]) => <SmallCard key={title} title={title} sub={sub} active={training === title} onClick={() => setTraining(title)} strong />)}</div></Card>
            <Card className="mt-[16px] flex min-h-[108px] items-center justify-between gap-[12px] p-[14px]"><div className="max-w-[245px]"><SectionTitle>Nutrition tracking</SectionTitle><p className="mb-0 mt-[12px] text-[11px] leading-[15px] text-[#9A9AA8]">Use meal photos to estimate calories and macros, then let me confirm before saving.</p></div><button type="button" aria-label="Toggle nutrition tracking" onClick={() => setNutritionTracking((value) => !value)} className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition ${nutritionTracking ? "bg-[#8B5CF6]" : "bg-[#292938]"}`}><span className={`absolute top-[3px] h-[24px] w-[24px] rounded-full bg-white transition-all ${nutritionTracking ? "left-[23px]" : "left-[3px]"}`} /></button></Card>
            <Card className="mt-[16px] p-[14px]"><SectionTitle>Daily recovery targets</SectionTitle><div className="mt-[16px] grid grid-cols-3 gap-[5px]"><Metric label="Sleep" value="7–8 h" /><Metric label="Water" value="80 oz" /><Metric label="Steps" value="10k" /></div></Card>
          </>}

          {step === 3 && <>
            <Header title="How should Project You+ help?" sub="Set your money focus, coaching style, and which data you want connected." />
            <Card className="mt-[26px] p-[14px]"><SectionTitle>Money focus</SectionTitle><div className="mt-[14px] grid grid-cols-2 gap-x-[23px] gap-y-[10px]">{MONEY.map((item) => <MiniChoice key={item} active={moneyGoals.includes(item)} onClick={() => toggle(setMoneyGoals, item)}>{item}</MiniChoice>)}</div></Card>
            <Card className="mt-[16px] p-[14px]"><SectionTitle>How should your AI Coach communicate?</SectionTitle><div className="mt-[16px] grid grid-cols-3 gap-[5px]">{COACH.map(([title, sub]) => <SmallCard key={title} title={title} sub={sub} active={coachStyle === title} onClick={() => setCoachStyle(title)} />)}</div></Card>
            <Card className="mt-[16px] p-[14px]"><SectionTitle>Connect now for better personalization</SectionTitle><div className="mt-[12px] space-y-[2px]">{CONNECTIONS.map(([title, sub]) => { const active = connections.includes(title); return <button key={title} type="button" onClick={() => toggle(setConnections, title)} className="flex h-[36px] w-full items-center rounded-[12px] bg-[#151521] px-[10px] text-left"><span className="w-[102px] text-[11px] font-semibold text-white">{title}</span><span className="flex-1 text-[9px] text-[#9A9AA8]">{sub}</span><span className={`flex h-[24px] w-[54px] items-center justify-center rounded-full text-[9px] font-semibold ${active ? "bg-[#8B5CF6] text-white" : "bg-[#1B1B29] text-[#9A9AA8]"}`}>{active ? "On" : "Later"}</span></button>; })}</div></Card>
            <Card className="mt-[14px] flex h-[54px] items-center px-[14px] text-[10.5px] leading-[14px] text-[#9A9AA8]">These are personalization preferences for this web test. External provider connections are enabled separately.</Card>
          </>}

          {step === 4 && <div className="pt-[54px]">
            <div className="pointer-events-none absolute left-[-18px] top-[-120px] h-[350px] w-[430px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.16)_0%,transparent_68%)]" />
            <div className="relative mx-auto flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#8B5CF6] text-[18px] font-bold">✓</div>
            <h1 className="relative mt-[26px] text-center text-[27px] font-bold leading-[32px] tracking-[-0.035em]">Your Project You+ plan is ready.</h1>
            <p className="relative mx-auto mt-[10px] w-[337px] text-center text-[13px] leading-[17px] text-[#9A9AA8]">We built your starting system around your priorities, schedule, health, money, and coaching preferences.</p>
            <Card className="relative mt-[30px] h-[132px] bg-[#151521] p-[16px]"><div className="text-[17px] font-semibold">Your starting focus</div><div className="mt-[8px] truncate text-[20px] font-bold">{selectedPriorityText}</div><p className="mt-[10px] text-[11px] leading-[15px] text-[#9A9AA8]">Your Today screen will favor actions that support these areas first.</p></Card>
            <Card className="relative mt-[16px] p-[16px]"><div className="text-[17px] font-semibold">Recommended starting system</div><SummaryRow label="Morning" value="10-min plan + protein-first breakfast" /><SummaryRow label="Work" value="2 protected high-impact blocks" /><SummaryRow label="Fitness" value={`${training} strength sessions / week`} /><SummaryRow label="Money" value={moneyGoals[0] ?? "Weekly cash-flow review"} /><SummaryRow label="Review" value="Sunday weekly review + next-week plan" /></Card>
            <Card className="relative mt-[16px] p-[16px]"><div className="text-[14px] font-semibold">Connected context</div><div className="mt-[14px] grid grid-cols-3 gap-[5px]">{["Apple Health", "Calendar", "Money"].map((item) => <div key={item} className={`flex h-[36px] items-center rounded-[12px] px-[10px] text-[10px] font-medium ${connections.includes(item) || (item === "Money" && moneyGoals.length) ? "bg-[#1B1B29] text-white" : "bg-[#151521] text-[#9A9AA8]"}`}>{item}</div>)}</div></Card>
          </div>}
        </div>

        {error && <p role="alert" className="mt-[12px] text-[12px] text-[#FF7A88]">{error}</p>}
        <div className={`${step === 4 ? "mt-[30px]" : "mt-[28px]"} flex gap-[10px] pb-[max(0px,env(safe-area-inset-bottom))]`}>
          {step > 0 && step < 4 && <button type="button" onClick={() => { setError(null); setStep((current) => current - 1); }} className="h-[54px] min-w-[82px] rounded-[17px] border border-[#292938] bg-[#151521] text-[13px] font-semibold text-white">Back</button>}
          {step < 4 ? <button type="button" onClick={next} className="h-[54px] flex-1 rounded-[17px] bg-[#8B5CF6] text-[14px] font-semibold text-white active:scale-[.99]">Continue</button> : <button type="button" onClick={finish} disabled={isPending} className="h-[56px] w-full rounded-[18px] bg-[#8B5CF6] text-[14px] font-semibold text-white active:scale-[.99] disabled:opacity-60">{isPending ? "Building your plan…" : "Enter Project You+"}</button>}
        </div>
      </div>
    </main>
  );
}

function Header({ title, sub }: { title: string; sub: string }) { return <><h1 className="m-0 text-[28px] font-bold leading-[32px] tracking-[-0.035em] text-white">{title}</h1><p className="mb-0 mt-[7px] max-w-[345px] text-[13px] leading-[16px] text-[#9A9AA8]">{sub}</p></>; }
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-[18px] bg-[#0D0D14] ${className}`}>{children}</section>; }
function SectionTitle({ children }: { children: React.ReactNode }) { return <div className="text-[14px] font-semibold text-white">{children}</div>; }
function ChoiceCard({ title, copy, active, onClick }: { title: string; copy: string; active: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`relative min-h-[68px] rounded-[16px] border px-[11px] py-[10px] text-left transition ${active ? "border-[1.5px] border-[#8B5CF6] bg-[#1B1B29]" : "border-transparent bg-[#0D0D14]"}`}><span className="block pr-[24px] text-[14px] font-semibold text-white">{title}</span><span className="mt-[6px] block text-[10px] leading-[12px] text-[#9A9AA8]">{copy}</span>{active && <span className="absolute right-[10px] top-[9px] flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#8B5CF6] text-[10px] font-semibold text-white">✓</span>}</button>; }
function MiniChoice({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`h-[34px] rounded-[12px] border px-[10px] text-left text-[11px] font-medium ${active ? "border-[#8B5CF6] bg-[#1B1B29] text-white" : "border-transparent bg-[#151521] text-[#9A9AA8]"}`}>{children}</button>; }
function PillChoice({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`h-[34px] rounded-[12px] text-[11px] font-semibold ${active ? "bg-[#8B5CF6] text-white" : "bg-[#151521] text-[#9A9AA8]"}`}>{children}</button>; }
function SmallCard({ title, sub, active, onClick, strong = false }: { title: string; sub: string; active: boolean; onClick: () => void; strong?: boolean }) { return <button type="button" onClick={onClick} className={`h-[52px] rounded-[12px] px-[9px] text-left ${active ? "bg-[#8B5CF6] text-white" : "bg-[#151521] text-white"}`}><span className={`block ${strong ? "text-[14px]" : "text-[10.5px]"} font-semibold`}>{title}</span><span className={`mt-[5px] block text-[9px] ${active ? "text-white/90" : "text-[#9A9AA8]"}`}>{sub}</span></button>; }
function TimeBox({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <input type="time" value={value} onChange={(event) => onChange(event.target.value)} className="h-[48px] w-full rounded-[14px] border-0 bg-[#151521] px-[14px] text-[14px] font-medium text-white outline-none [color-scheme:dark] focus:ring-1 focus:ring-[#8B5CF6]" />; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="h-[52px] rounded-[12px] bg-[#151521] px-[10px] py-[8px]"><div className="text-[10px] text-[#9A9AA8]">{label}</div><div className="mt-[5px] text-[14px] font-semibold text-white">{value}</div></div>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="mt-[13px] flex items-center gap-[12px]"><span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#8B5CF6]" /><span className="w-[54px] text-[11px] font-semibold text-white">{label}</span><span className="min-w-0 flex-1 truncate text-[10px] text-[#9A9AA8]">{value}</span></div>; }
