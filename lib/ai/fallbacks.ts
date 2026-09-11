import type { ProjectYouContext, UserContext } from "@/lib/ai/context";
import type { RunMyDayPlan, WeeklyReviewData } from "@/lib/types";

const domainLabel: Record<string, string> = {
  fitness: "fitness",
  sleep: "sleep",
  money: "money",
  productivity: "productivity",
  habits: "habit consistency",
  goals: "goal execution",
  learning: "learning",
};

export function fallbackCoachReply(message: string, context: ProjectYouContext): string {
  const m = message.toLowerCase();
  const priority = context.insights[0]?.content;
  const opportunity = context.score.opportunity;
  const strongest = context.score.strongest;
  const activeGoals = context.goals.filter((g) => g.status === "active");
  const userContext=context as UserContext,domains=userContext.domains;
  const four=(observation:string,why:string,recommendation:string,impact:string)=>`Observation: ${observation}\n\nWhy it matters: ${why}\n\nRecommendation: ${recommendation}\n\nExpected impact: ${impact}`;

  if((m.includes("focus")&&m.includes("today"))||m.includes("highest-leverage")){
    const rank={critical:0,important:1,optional:2};const task=context.tasks.filter(task=>!task.completedAt).sort((a,b)=>rank[a.tier]-rank[b.tier])[0];
    if(!task)return four("There is no unfinished task in your connected data.","Choosing a priority without a real action would be guesswork.","Add one concrete next action to your top active goal.","Coach can rank today from real commitments instead of assumptions.");
    return four(`“${task.title}” is your highest-tier unfinished task${task.goalId?" and it is linked to a goal":""}.`,`It is the strongest available candidate for meaningful progress today.`,`Protect your first usable focus block for it, around ${context.schedule.length?"your fixed calendar commitments":"the time you know is available"}.`,`Completing it should improve execution without adding more commitments.`);
  }
  if(m.includes("why")&&m.includes("score")&&m.includes("change")){
    const delta=context.score.score.weeklyDeltaPct,driver=opportunity?`${domainLabel[opportunity.key]??opportunity.key} is currently ${opportunity.value}`:"the score is still calibrating";
    return four(`Your score is ${context.score.score.score}${delta?`, ${delta>0?"up":"down"} ${Math.abs(delta)}% from the latest saved comparison`:"; there is no measured change from the latest saved comparison"}.`,`${driver}. ${opportunity?context.score.rationale[opportunity.key]??"":"More dated snapshots are needed to isolate a driver."}`,opportunity?`Improve one repeatable behavior in ${domainLabel[opportunity.key]??opportunity.key} before changing several areas.`:"Keep logging real activity until a comparison is available.","The next score movement will be easier to attribute to a specific behavior.");
  }
  if(m.includes("neglect"))return opportunity?four(`${domainLabel[opportunity.key]??opportunity.key} is your lowest measured domain at ${opportunity.value}.`,context.score.rationale[opportunity.key]??"It is creating the largest measured gap in your current score.",`Give this area one small repeatable action this week.`,`Raising the lowest supported domain should improve balance and overall trajectory.`):four("No neglected domain can be identified from the connected data yet.","The current score lacks enough comparable domain coverage.","Add a real signal in goals, habits, health, or finance.","Coach can identify a genuine weak point without inventing one.");
  if(m.includes("plan")&&m.includes("tomorrow")){
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const key=tomorrow.toISOString().slice(0,10),fixed=context.schedule.filter(event=>event.startAt.slice(0,10)===key),task=context.tasks.find(item=>!item.completedAt);
    return four(fixed.length?`Tomorrow has ${fixed.length} connected commitment${fixed.length===1?"":"s"}: ${fixed.map(event=>`${new Date(event.startAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})} ${event.title}`).join(", ")}.`:"No calendar commitments are connected for tomorrow.",fixed.length?"Those times are fixed boundaries for a realistic plan.":"Without connected commitments, I should not invent specific open hours.",task?`Place “${task.title}” in the first confirmed open block, then keep remaining work secondary.`:"Add one priority task, then schedule it only in a confirmed open block.","Tomorrow stays achievable and avoids calendar conflicts.");
  }
  if(m.includes("health")&&m.includes("consisten")){
    const health=domains.health,workout=domains.workout.data;return health.availability==="unavailable"?four("Health consistency is unavailable because no health or training signal is connected.","A rating without logged evidence would be invented.","Log workouts or one repeatable health metric for at least a week.","Coach can then distinguish a pattern from a single day."):four(`You logged ${workout?.workoutsLast7Days??0} workout${workout?.workoutsLast7Days===1?"":"s"} in the last seven days${context.habits.length?` and your tracked habits average ${Math.round(context.habits.reduce((sum,h)=>sum+h.consistencyPct,0)/context.habits.length)}% consistency`:""}.`,`Consistency matters more than one strong health entry.`,`Protect the next scheduled workout and keep one health behavior stable.`,`A repeatable week should strengthen fitness coverage and make the health trend more reliable.`);
  }
  if((m.includes("finance")||m.includes("money"))&&m.includes("hurt")){
    const finance=domains.finance;return finance.availability==="unavailable"?four("Finance Score drivers are unavailable because no financial summary is connected.","Explaining a score without accounts, transactions, or budgets would be guesswork.","Connect an account or add a budget first.","Coach can identify the real pressure on cash flow and spending."):four(`Your Finance Score is ${finance.data?.score??"unavailable"}; ${context.money.weeklyBudgetPctUsed}% of the weekly budget is used.`,"The score uses connected income, spending, budgets, cash, and liabilities.",context.money.weeklyBudgetPctUsed>75?"Slow discretionary spending until the next budget reset.":"Keep spending within the current budget pace.","A steadier budget pace should reduce the main measurable drag on Finance Score.");
  }
  if(m.includes("changed")&&m.includes("week")){
    const counts=domains.eventHistory.data?.counts??{},entries=Object.entries(counts).filter(([,count])=>count>0).slice(0,4);return entries.length?four(`Recent history shows ${entries.map(([type,count])=>`${count} ${type.replace("."," ")}`).join(", ")}.`,`These recorded actions show where momentum moved; they are stronger evidence than a one-day impression.`,`Repeat the strongest completed behavior and address the most frequent miss.`,`That should turn this week's activity into a more stable trend.`):four("No behavioral changes are recorded for the recent window.","There is no event evidence to compare yet.","Complete or log one meaningful action each day.","Next week's review will have a real pattern to explain.");
  }
  if(m.includes("achievement")&&m.includes("closest")){
    const state=domains.progression.data?.state,current=state?.currentScore??context.score.score.score,next=Math.min(95,Math.ceil((current+1)/5)*5),gap=Math.max(0,next-current);return four(state?`You are at ${current} in the ${state.stage} stage; the next score recognition is ${next}${gap?`, ${gap} point${gap===1?"":"s"} away`:""}.`:`Your progression state is still calibrating at score ${current}.`,`Score recognition depends on sustained, supported progress rather than one isolated result.`,opportunity?`Strengthen ${domainLabel[opportunity.key]??opportunity.key}, your lowest measured domain.`:"Keep completing and logging real daily actions.",`Closing that gap moves you toward the next recognition while improving calibration.`);
  }

  if (/\b(add|create|move|reschedule|update|delete|remove|cancel|set|increase|decrease|replace|complete|log|connect)\b/.test(m)) {
    const recommendation = priority ?? "Tie the change to your highest-priority active goal and protect existing calendar commitments.";
    return `${recommendation} I have not changed your data. Tell me the exact item and value you want changed; I’ll restate the proposed action for your confirmation before it is applied.`;
  }

  if (m.includes("score") || m.includes("progress") || m.includes("doing")) {
    if (!strongest || !opportunity) {
      return `Your 1% Score is still calibrating at ${context.score.score.score}. Add a real goal, a few tasks, and one repeatable habit so I can compare strengths and opportunities without inventing data. ${priority ?? "Start with one action that matters today."}`;
    }
    return `Your 1% Score is ${context.score.score.score}. Your strongest area is ${domainLabel[strongest.key] ?? strongest.key} at ${strongest.value}, while ${domainLabel[opportunity.key] ?? opportunity.key} is the clearest opportunity at ${opportunity.value}. ${priority ?? "Keep the next action tied to an active goal."}`;
  }
  if (m.includes("plan") && (m.includes("day") || m.includes("today"))) {
    return `I’d protect your fixed calendar commitments, then give the first open focus block to your highest-priority unfinished task. ${priority ?? "Use Run My Day to turn that into a schedule."}`;
  }
  if (m.includes("goal")) {
    const slowest = [...activeGoals].sort((a, b) => a.progress - b.progress)[0];
    return slowest ? `${slowest.title} is your slowest active goal at ${slowest.progress}% progress. The best next move is to attach one concrete task to its next milestone this week.` : "You don't have an active goal connected yet.";
  }
  if (m.includes("holding") || m.includes("stuck") || m.includes("opportunity")) {
    if (!opportunity) return "Your score is still calibrating, so there is not enough real data yet to name a weakest category. Add a few days of actions, habits, health or finance context first.";
    return `${domainLabel[opportunity.key] ?? opportunity.key} is currently your lowest category at ${opportunity.value}. ${context.score.rationale[opportunity.key] ?? "Keep adding real context so this recommendation gets sharper."}`;
  }
  return priority ?? `Your 1% Score is ${context.score.score.score}. Focus on one action that directly advances an active goal before adding more commitments.`;
}

export function fallbackRunMyDay(context: ProjectYouContext): RunMyDayPlan {
  const fixed = [...context.schedule].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const priorityTasks = context.tasks
    .filter((task) => !task.completedAt)
    .sort((a, b) => ({ critical: 0, important: 1, optional: 2 }[a.tier] - ({ critical: 0, important: 1, optional: 2 }[b.tier])))
    .slice(0, 2);
  const items: RunMyDayPlan["items"] = [];
  const opportunity = context.score.opportunity;

  if (priorityTasks[0]) items.push({ time: "9:00 AM", title: priorityTasks[0].title, note: "Highest-impact open task" });
  for (const event of fixed) {
    items.push({
      time: new Date(event.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      title: event.title,
      note: event.location ?? undefined,
    });
  }
  if (priorityTasks[1]) items.push({ time: "3:30 PM", title: priorityTasks[1].title, note: "Second priority after fixed commitments" });
  items.push({ time: "10:30 PM", title: "Wind down", note: opportunity?.key === "sleep" ? "Supports your lowest score category" : "Protect tomorrow's energy" });

  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    const key = `${item.time}-${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(`1970/01/01 ${a.time}`).getTime() - new Date(`1970/01/01 ${b.time}`).getTime());

  return {
    explanation: opportunity
      ? `This plan protects your fixed commitments and gives the best available focus time to your highest-priority open work. It also protects ${domainLabel[opportunity.key] ?? opportunity.key} because that is currently your biggest 1% Score opportunity.`
      : "This plan protects your fixed commitments and gives the best available focus time to your highest-priority open work while your score is still calibrating.",
    items: deduped.slice(0, 10),
  };
}

export function fallbackWeeklyReview(context: ProjectYouContext): WeeklyReviewData {
  const completed = context.tasks.filter((task) => task.completedAt).length;
  const activeGoals = context.goals.filter((goal) => goal.status === "active");
  const progressedGoals = activeGoals.filter((goal) => goal.progress > 0).length;
  const habitAvg = context.habits.length ? Math.round(context.habits.reduce((s, h) => s + h.consistencyPct, 0) / context.habits.length) : 0;
  const opportunity = context.score.opportunity;
  const strongest = context.score.strongest;

  const strongestText = strongest
    ? `${domainLabel[strongest.key] ?? strongest.key} is your strongest current category at ${strongest.value}. Keep the behavior behind it stable rather than trying to optimize everything at once.`
    : "Your score is still calibrating. The strongest signal will appear after you build a little more real history.";
  const opportunityText = opportunity
    ? `${domainLabel[opportunity.key] ?? opportunity.key} is currently at ${opportunity.value}. ${context.score.rationale[opportunity.key] ?? "Keep building real history in this area."}`
    : "There is not enough calibrated data yet to name a weakest category without guessing.";
  const biggestOpportunity = opportunity
    ? `Raise ${domainLabel[opportunity.key] ?? opportunity.key} with one repeatable action this week. That is the clearest path to lifting your overall 1% Score from ${context.score.score.score}.`
    : "Build a reliable baseline this week: one active goal, a few completed tasks, and consistent habit check-ins.";

  return {
    score: context.score.score.score,
    weeklyDeltaPct: context.score.score.weeklyDeltaPct,
    tasksCompletedLabel: `${completed}/${context.tasks.length}`,
    goalsProgressedLabel: `${progressedGoals} of ${activeGoals.length}`,
    habitConsistencyPct: habitAvg,
    fitnessScore: context.score.score.breakdown.fitness ?? 0,
    sleepScore: context.score.score.breakdown.sleep ?? 0,
    moneyScore: context.score.score.breakdown.money ?? 0,
    whatWentWell: strongestText,
    needsAttention: opportunityText,
    biggestOpportunity,
    nextWeekPlan: [
      context.insights[0]?.content ?? "Protect one daily focus block for your top active goal.",
      context.insights[2]?.content ?? "Keep your highest-consistency habit stable.",
      opportunity ? `Review your ${domainLabel[opportunity.key] ?? opportunity.key} score at the end of the week and adjust one behavior, not five.` : "Keep adding real data so Project You+ can calibrate without fabricated defaults.",
    ],
  };
}
