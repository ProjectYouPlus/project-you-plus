import Link from "next/link";
import { getProfile } from "@/lib/data/profile";
import { getGoals } from "@/lib/data/goals";
import { getTasks } from "@/lib/data/tasks";
import { getHabits } from "@/lib/data/habits";
import { createClient } from "@/lib/supabase/server";
import { toggleTaskComplete } from "@/lib/actions/tasks";
import { logHabitToday } from "@/lib/actions/habits";
import { completeWorkoutPlanSession } from "@/lib/actions/fitness";
import { logSupplementToday } from "@/lib/actions/supplements";
import type { Goal, Habit, Task } from "@/lib/types";

type PlanSession = {
  key: string;
  day: string;
  dayIndex: number;
  title: string;
  focus?: string;
  duration: number;
  exercises?: Array<{ name: string; sets: string; reps: string; rest?: string }>;
};

type ActivePlan = {
  id: string;
  title: string;
  goal: string;
  days_per_week: number;
  schedule: PlanSession[] | null;
};

type Supplement = { id: string; name: string; dosage: string | null; timing: string; frequency: string };
type DateLog = { logged_on?: string; completed_on?: string; logged_at?: string; created_at?: string; performed_at?: string; completed_at?: string | null };

const tierWeight: Record<Task["tier"], number> = { critical: 30, important: 20, optional: 10 };

function taskPriority(task: Task, activeGoalIds: Set<string>) {
  let score = tierWeight[task.tier];
  if (task.goalId && activeGoalIds.has(task.goalId)) score += 100;
  if (task.dueAt) {
    const hours = (new Date(task.dueAt).getTime() - Date.now()) / 36e5;
    if (hours <= 0) score += 50;
    else if (hours <= 24) score += 32;
    else if (hours <= 72) score += 16;
  }
  return score;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const today = localDate(now);
  const currentStart = new Date(now); currentStart.setHours(0, 0, 0, 0); currentStart.setDate(currentStart.getDate() - 6);
  const previousStart = new Date(currentStart); previousStart.setDate(previousStart.getDate() - 7);
  const previousEnd = new Date(currentStart); previousEnd.setMilliseconds(-1);

  const [profile, goals, tasks, habits, live] = await Promise.all([
    getProfile(),
    getGoals(),
    getTasks(),
    getHabits(),
    getLiveDashboardData(supabase, previousStart),
  ]);

  const firstName = (profile.fullName ?? "You").split(" ")[0];
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const activeGoalIds = new Set(activeGoals.map((goal) => goal.id));
  const goalById = new Map(activeGoals.map((goal) => [goal.id, goal]));
  const openTasks = tasks.filter((task) => !task.completedAt).sort((a, b) => taskPriority(b, activeGoalIds) - taskPriority(a, activeGoalIds));
  const topTasks = openTasks.slice(0, 3);

  const habitLogsToday = new Set(live.habitLogs.filter((log) => log.logged_at === today).map((log) => log.habit_id));
  const supplementLogsToday = new Set(live.supplementLogs.filter((log) => log.logged_on === today).map((log) => log.supplement_id));
  const planLogsToday = new Set(live.planLogs.filter((log) => log.completed_on === today).map((log) => `${log.plan_id}:${log.session_key}`));

  const todaySession = live.activePlan?.schedule?.find((item) => item.dayIndex === now.getDay()) ?? null;
  const workoutDone = todaySession ? planLogsToday.has(`${live.activePlan?.id}:${todaySession.key}`) : false;
  const dueSupplements = live.supplements.filter((item) => isSupplementDue(item, now, Boolean(todaySession)));
  const habitRows = habits.slice(0, 5);

  const commitments = [
    ...topTasks.map((task) => ({ done: Boolean(task.completedAt) })),
    ...habitRows.map((habit) => ({ done: habitLogsToday.has(habit.id) })),
    ...(todaySession ? [{ done: workoutDone }] : []),
    ...dueSupplements.map((item) => ({ done: supplementLogsToday.has(item.id) })),
  ];
  const todayExecution = commitments.length ? pct(commitments.filter((item) => item.done).length, commitments.length) : null;

  const currentActivity = activityCount(live, currentStart, now);
  const previousActivity = activityCount(live, previousStart, previousEnd);
  const consistency = consistencyScore(live, habits, currentStart, now);
  const body = bodyScore(live, currentStart, now);
  const finance = financeScore(live, now);
  const goalsScore = activeGoals.length ? Math.round(activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length) : null;

  const pillars = [
    { key: "Execution", value: todayExecution, weight: 30, note: todayExecution == null ? "Add today’s actions" : `${commitments.filter((c) => c.done).length}/${commitments.length} commitments` },
    { key: "Consistency", value: consistency, weight: 25, note: consistency == null ? "Build a 7-day pattern" : "Last 7 days" },
    { key: "Body", value: body, weight: 20, note: body == null ? "Add health or training data" : "Training + health targets" },
    { key: "Finance", value: finance, weight: 10, note: finance == null ? "Add a budget for scoring" : "Budget pacing" },
    { key: "Goals", value: goalsScore, weight: 15, note: goalsScore == null ? "Create a goal" : `${activeGoals.length} active goal${activeGoals.length === 1 ? "" : "s"}` },
  ];
  const available = pillars.filter((pillar) => pillar.value != null) as Array<{ key: string; value: number; weight: number; note: string }>;
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  const lifeScore = totalWeight ? Math.round(available.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight) : 0;
  const coverage = Math.round((available.length / pillars.length) * 100);
  const trend = previousActivity > 0 ? Math.round(((currentActivity - previousActivity) / previousActivity) * 100) : currentActivity > 0 ? 100 : 0;
  const strongest = available.length ? [...available].sort((a, b) => b.value - a.value)[0] : null;
  const opportunity = available.length ? [...available].sort((a, b) => a.value - b.value)[0] : null;

  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="py-animate-in mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="py-eyebrow text-accent-text">Project You+ Intelligence</div>
          <h1 className="m-0 mt-1 text-[31px] font-bold tracking-[-0.045em] text-text-1">Good {daypart()}, {firstName}</h1>
          <p className="m-0 mt-1.5 text-[12.5px] text-text-3">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <Link href="/you" className="py-glass flex h-11 w-11 items-center justify-center rounded-full text-[12px] font-bold text-text-1">{firstName.slice(0, 2).toUpperCase()}</Link>
      </header>

      <section className="py-orbit-card py-animate-in py-stagger-1 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[.16em] text-[#C8AEFF]"><span className="py-pulse-dot h-2 w-2 rounded-full bg-accent-2" />Life operating score</div>
          <span className="py-glass-pill text-[#C8AEFF]">{coverage}% calibrated</span>
        </div>
        <div className="mt-5 grid grid-cols-[132px_1fr] items-center gap-5">
          <div className="py-score-ring" style={{ "--py-score": `${lifeScore * 3.6}deg` } as React.CSSProperties}>
            <div className="py-score-ring-inner"><div className="text-[42px] font-bold tracking-[-.065em] text-white">{lifeScore}</div><div className="-mt-1 text-[9.5px] font-semibold uppercase tracking-[.14em] text-[#9E97AC]">You+ Score</div></div>
          </div>
          <div>
            <div className="text-[18px] font-semibold tracking-[-.025em] text-white">{scoreHeadline(lifeScore, coverage)}</div>
            <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#C2BED0]">{scoreRead(strongest, opportunity, coverage)}</p>
            <div className="mt-4 flex flex-wrap gap-2"><span className="py-glass-pill">7-day activity {trend >= 0 ? "+" : ""}{trend}%</span><span className="py-glass-pill">{currentActivity} wins logged</span></div>
          </div>
        </div>
      </section>

      <section className="py-animate-in py-stagger-2 mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {pillars.map((pillar) => <Pillar key={pillar.key} label={pillar.key} value={pillar.value} note={pillar.note} />)}
      </section>

      <section className="py-animate-in py-stagger-3 mt-7">
        <div className="mb-3 flex items-end justify-between gap-3"><div><div className="py-eyebrow">Today</div><h2 className="m-0 mt-1 text-[23px] font-semibold tracking-[-.035em] text-text-1">Execute the system</h2></div><span className="text-[11.5px] font-semibold text-accent-text">{commitments.filter((item) => item.done).length}/{commitments.length || 0} done</span></div>
        <div className="py-glass-soft overflow-hidden px-4">
          {todaySession ? <WorkoutRow planId={live.activePlan!.id} session={todaySession} done={workoutDone} /> : <SetupRow href="/fitness" tag="WORKOUT" title="No workout scheduled today" sub="Build an AI plan and your training will appear here automatically." />}
          {topTasks.length ? topTasks.map((task) => <TaskRow key={task.id} task={task} goal={task.goalId ? goalById.get(task.goalId) : undefined} />) : <SetupRow href="/tasks/new" tag="TASK" title="Add your first high-impact action" sub="Dashboard will rank what moves your goals forward." />}
          {habitRows.length ? habitRows.map((habit) => <HabitRow key={habit.id} habit={habit} done={habitLogsToday.has(habit.id)} goal={habit.goalId ? goalById.get(habit.goalId) : undefined} />) : <SetupRow href="/habits" tag="HABIT" title="Build one repeatable behavior" sub="Habits become the consistency layer behind your goals." />}
          {dueSupplements.length ? dueSupplements.map((supplement) => <SupplementRow key={supplement.id} supplement={supplement} done={supplementLogsToday.has(supplement.id)} />) : <SetupRow href="/supplements" tag="SUPPLEMENTS" title="No supplements scheduled" sub="Track only the supplements you choose to take." />}
        </div>
      </section>

      <section className="py-animate-in py-stagger-4 mt-7 grid gap-3 sm:grid-cols-2">
        <Link href="/review" className="py-glass-soft py-pressable p-4"><div className="py-eyebrow text-accent-text">Weekly consistency</div><div className="mt-2 flex items-end gap-2"><span className="text-[31px] font-bold tracking-[-.05em] text-text-1">{currentActivity}</span><span className="pb-1 text-[11px] text-text-3">wins / 7 days</span></div><div className="mt-3 py-progress-track"><div className="py-progress-fill" style={{ width: `${Math.min(100, consistency ?? 0)}%` }} /></div><p className="m-0 mt-3 text-[11.5px] leading-relaxed text-text-3">{previousActivity ? `${trend >= 0 ? "Up" : "Down"} ${Math.abs(trend)}% versus the prior 7 days.` : "Keep logging. Your comparison baseline is forming."}</p></Link>
        <Link href="/coach" className="py-glass-soft py-pressable p-4"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-accent text-[10px] font-bold text-white">AI</span><div className="py-eyebrow text-accent-text">Jarvis read</div></div><div className="mt-3 text-[16px] font-semibold tracking-[-.02em] text-text-1">{jarvisRead(topTasks[0], todaySession, opportunity)}</div><p className="m-0 mt-2 text-[11.5px] leading-relaxed text-text-3">Ask Coach to reorganize your day, adjust training, plan meals for your goals, or reason through your money.</p></Link>
      </section>

      <section className="py-animate-in py-stagger-5 mt-7"><div className="mb-3 flex items-end justify-between"><div><div className="py-eyebrow">Goal momentum</div><h2 className="m-0 mt-1 text-[22px] font-semibold tracking-[-.03em] text-text-1">Where your life is moving</h2></div><Link href="/goals" className="text-[12px] font-semibold text-accent-text">Manage</Link></div>{activeGoals.length ? <div className="py-glass-soft divide-y divide-white/[.06] px-4">{activeGoals.slice(0, 3).map((goal) => <Link key={goal.id} href={`/goals/${goal.id}`} className="py-pressable block py-4"><div className="flex items-center justify-between gap-3"><span className="truncate text-[14px] font-semibold text-text-1">{goal.title}</span><span className="text-[12px] font-bold text-accent-text">{goal.progress}%</span></div><div className="mt-2.5 py-progress-track"><div className="py-progress-fill" style={{ width: `${goal.progress}%` }} /></div></Link>)}</div> : <Link href="/goals/new" className="py-glass-soft py-pressable flex items-center gap-3 p-4"><span className="py-empty-icon">+</span><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-text-1">Give the system a destination</span><span className="mt-0.5 block text-[11.5px] text-text-3">Create one meaningful goal and Project You+ will connect actions to it.</span></span><span className="text-[18px] text-text-3">›</span></Link>}</section>
    </main>
  );
}

async function getLiveDashboardData(supabase: Awaited<ReturnType<typeof createClient>>, since: Date) {
  const sinceIso = since.toISOString();
  const sinceDate = localDate(since);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [habitLogs, workouts, activePlanRes, planLogs, supplements, supplementLogs, metrics, accounts, transactions, budgets] = await Promise.all([
    supabase.from("habit_logs").select("habit_id,logged_at").gte("logged_at", sinceDate),
    supabase.from("workouts").select("id,performed_at,duration_minutes").gte("performed_at", sinceIso),
    supabase.from("workout_plans").select("id,title,goal,days_per_week,schedule").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("workout_plan_logs").select("plan_id,session_key,completed_on,duration_minutes").gte("completed_on", sinceDate),
    supabase.from("supplements").select("id,name,dosage,timing,frequency").eq("active", true).order("created_at"),
    supabase.from("supplement_logs").select("supplement_id,logged_on").gte("logged_on", sinceDate),
    supabase.from("health_metrics").select("metric_type,value,recorded_at").order("recorded_at", { ascending: false }).limit(100),
    supabase.from("finance_accounts").select("id,balance,account_type"),
    supabase.from("transactions").select("amount,occurred_at").gte("occurred_at", monthStart.toISOString()),
    supabase.from("budgets").select("monthly_limit"),
  ]);
  return {
    habitLogs: habitLogs.data ?? [], workouts: workouts.data ?? [], activePlan: (activePlanRes.data as ActivePlan | null) ?? null,
    planLogs: planLogs.data ?? [], supplements: (supplements.data ?? []) as Supplement[], supplementLogs: supplementLogs.data ?? [],
    metrics: metrics.data ?? [], accounts: accounts.data ?? [], transactions: transactions.data ?? [], budgets: budgets.data ?? [],
  };
}

function activityCount(live: Awaited<ReturnType<typeof getLiveDashboardData>>, start: Date, end: Date) {
  const startTime = start.getTime(), endTime = end.getTime();
  const inRange = (value: string) => { const t = new Date(value).getTime(); return t >= startTime && t <= endTime; };
  return live.habitLogs.filter((x) => inRange(`${x.logged_at}T12:00:00`)).length + live.workouts.filter((x) => inRange(x.performed_at)).length + live.planLogs.filter((x) => inRange(`${x.completed_on}T12:00:00`)).length + live.supplementLogs.filter((x) => inRange(`${x.logged_on}T12:00:00`)).length;
}

function consistencyScore(live: Awaited<ReturnType<typeof getLiveDashboardData>>, habits: Habit[], start: Date, end: Date) {
  const days = Math.max(1, Math.min(7, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1));
  const habitExpected = habits.filter((h) => h.targetFrequency === "daily").length * days;
  const habitActual = live.habitLogs.filter((x) => new Date(`${x.logged_at}T12:00:00`) >= start).length;
  const workoutExpected = live.activePlan ? live.activePlan.days_per_week : 0;
  const workoutActual = live.planLogs.filter((x) => new Date(`${x.completed_on}T12:00:00`) >= start).length || live.workouts.filter((x) => new Date(x.performed_at) >= start).length;
  const supplementExpected = live.supplements.filter((s) => s.frequency === "daily").length * days;
  const supplementActual = live.supplementLogs.filter((x) => new Date(`${x.logged_on}T12:00:00`) >= start).length;
  const expected = habitExpected + workoutExpected + supplementExpected;
  if (!expected) return null;
  return Math.min(100, Math.round(((habitActual + Math.min(workoutActual, workoutExpected) + supplementActual) / expected) * 100));
}

function bodyScore(live: Awaited<ReturnType<typeof getLiveDashboardData>>, start: Date, end: Date) {
  const latest = new Map<string, number>();
  for (const metric of live.metrics) if (!latest.has(metric.metric_type)) latest.set(metric.metric_type, Number(metric.value));
  const parts: number[] = [];
  if (latest.has("steps")) parts.push(Math.min(100, pct(latest.get("steps")!, 10000)));
  if (latest.has("sleep_minutes")) parts.push(Math.min(100, pct(latest.get("sleep_minutes")!, 480)));
  if (latest.has("water_cups")) parts.push(Math.min(100, pct(latest.get("water_cups")!, 10)));
  if (live.activePlan) {
    const completed = live.planLogs.filter((x) => new Date(`${x.completed_on}T12:00:00`) >= start && new Date(`${x.completed_on}T12:00:00`) <= end).length;
    parts.push(Math.min(100, pct(completed, Math.max(1, live.activePlan.days_per_week))));
  }
  return parts.length ? Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length) : null;
}

function financeScore(live: Awaited<ReturnType<typeof getLiveDashboardData>>, now: Date) {
  const budget = live.budgets.reduce((sum, row) => sum + Number(row.monthly_limit ?? 0), 0);
  if (!budget) return null;
  const spent = Math.abs(live.transactions.filter((row) => Number(row.amount) < 0).reduce((sum, row) => sum + Number(row.amount), 0));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedPace = budget * (now.getDate() / daysInMonth);
  if (expectedPace <= 0) return 100;
  const ratio = spent / expectedPace;
  if (ratio <= 1) return Math.round(100 - Math.max(0, 1 - ratio) * 8);
  return Math.max(0, Math.round(100 - (ratio - 1) * 70));
}

function isSupplementDue(item: Supplement, now: Date, hasTraining: boolean) {
  if (item.frequency === "daily") return true;
  if (item.frequency === "weekdays") return now.getDay() >= 1 && now.getDay() <= 5;
  if (item.frequency === "training_days") return hasTraining;
  return false;
}

function WorkoutRow({ planId, session, done }: { planId: string; session: PlanSession; done: boolean }) {
  const action = completeWorkoutPlanSession.bind(null, planId, session.key, session.duration);
  return <div className="py-command-row"><form action={action}><button disabled={done} aria-label={done ? "Workout complete" : "Mark workout complete"} className={`py-check ${done ? "py-check-done" : ""}`}>{done ? "✓" : ""}</button></form><Link href="/fitness" className="min-w-0 flex-1"><div className="py-command-tag">WORKOUT · {session.duration} MIN</div><div className={`mt-0.5 text-[14px] font-semibold ${done ? "text-text-3 line-through" : "text-text-1"}`}>{session.title}</div><div className="mt-0.5 truncate text-[11px] text-text-3">{session.focus || "Your scheduled training session"}</div></Link><span className="text-[19px] text-text-3">›</span></div>;
}
function TaskRow({ task, goal }: { task: Task; goal?: Goal }) {
  const action = toggleTaskComplete.bind(null, task.id, true);
  return <div className="py-command-row"><form action={action}><button aria-label="Complete task" className="py-check" /></form><Link href="/tasks" className="min-w-0 flex-1"><div className="py-command-tag">{task.tier.toUpperCase()} TASK</div><div className="mt-0.5 truncate text-[14px] font-semibold text-text-1">{task.title}</div><div className="mt-0.5 truncate text-[11px] text-text-3">{goal ? `Advances ${goal.title}` : "Link this action to a goal for smarter prioritization"}</div></Link><span className="text-[19px] text-text-3">›</span></div>;
}
function HabitRow({ habit, done, goal }: { habit: Habit; done: boolean; goal?: Goal }) {
  const action = logHabitToday.bind(null, habit.id);
  return <div className="py-command-row"><form action={action}><button disabled={done} aria-label={done ? "Habit complete" : "Complete habit"} className={`py-check ${done ? "py-check-done" : ""}`}>{done ? "✓" : ""}</button></form><Link href="/habits" className="min-w-0 flex-1"><div className="py-command-tag">HABIT · {habit.streakDays} DAY STREAK</div><div className={`mt-0.5 truncate text-[14px] font-semibold ${done ? "text-text-3 line-through" : "text-text-1"}`}>{habit.title}</div><div className="mt-0.5 truncate text-[11px] text-text-3">{goal ? `Supports ${goal.title}` : `${habit.consistencyPct}% consistency`}</div></Link><span className="text-[19px] text-text-3">›</span></div>;
}
function SupplementRow({ supplement, done }: { supplement: Supplement; done: boolean }) {
  const action = logSupplementToday.bind(null, supplement.id);
  return <div className="py-command-row"><form action={action}><button disabled={done} aria-label={done ? "Supplement logged" : "Log supplement"} className={`py-check ${done ? "py-check-done" : ""}`}>{done ? "✓" : ""}</button></form><Link href="/supplements" className="min-w-0 flex-1"><div className="py-command-tag">SUPPLEMENT · {supplement.timing.toUpperCase()}</div><div className={`mt-0.5 truncate text-[14px] font-semibold ${done ? "text-text-3 line-through" : "text-text-1"}`}>{supplement.name}</div><div className="mt-0.5 truncate text-[11px] text-text-3">{supplement.dosage || "Dose not specified"}</div></Link><span className="text-[19px] text-text-3">›</span></div>;
}
function SetupRow({ href, tag, title, sub }: { href: string; tag: string; title: string; sub: string }) { return <Link href={href} className="py-command-row py-pressable"><span className="py-check flex items-center justify-center text-[14px] text-accent-text">+</span><span className="min-w-0 flex-1"><span className="py-command-tag">{tag}</span><span className="mt-0.5 block text-[14px] font-semibold text-text-1">{title}</span><span className="mt-0.5 block text-[11px] text-text-3">{sub}</span></span><span className="text-[19px] text-text-3">›</span></Link>; }
function Pillar({ label, value, note }: { label: string; value: number | null; note: string }) { return <div className="py-glass-soft min-h-[104px] p-3.5"><div className="text-[9.5px] font-semibold uppercase tracking-[.13em] text-text-3">{label}</div><div className="mt-2 text-[24px] font-bold tracking-[-.045em] text-text-1">{value == null ? "—" : value}</div><div className="mt-1 text-[9.5px] leading-snug text-text-3">{note}</div></div>; }
function scoreHeadline(score: number, coverage: number) { if (coverage < 40) return "Your system is calibrating."; if (score >= 85) return "You’re operating with strong alignment."; if (score >= 70) return "Momentum is building."; if (score >= 50) return "Your next gains are visible."; return "The system sees where to focus."; }
function scoreRead(strongest: { key: string; value: number } | null, opportunity: { key: string; value: number } | null, coverage: number) { if (!strongest || !opportunity) return "Add a goal, daily actions, and one repeatable habit. Your score will become meaningful as real data arrives."; if (coverage < 100) return `${strongest.key} is currently strongest. ${opportunity.key} has the clearest upside; add more context to increase score confidence.`; return `${strongest.key} is your strongest pillar at ${strongest.value}. ${opportunity.key} is the clearest opportunity at ${opportunity.value}.`; }
function jarvisRead(task: Task | undefined, session: PlanSession | null, opportunity: { key: string; value: number } | null) { if (task) return `Protect ${task.title} first. It is currently your highest-leverage open move.`; if (session) return `${session.title} is today’s anchor. Build the rest of the day around it.`; if (opportunity) return `${opportunity.key} is the lowest-scoring calibrated pillar. Ask Coach for one change that would move it this week.`; return "Give me more context and I’ll start making sharper decisions across your day."; }
function pct(value: number, total: number) { return total > 0 ? Math.round((value / total) * 100) : 0; }
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function daypart() { const hour = new Date().getHours(); return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"; }
