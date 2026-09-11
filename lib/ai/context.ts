import { getHealthOverview } from "@/lib/data/health";
import { getFinanceOverview } from "@/lib/data/finance";
import { dateStart, shiftDate } from "@/lib/health/schedule";
import type { HealthScore } from "@/lib/health/score";
import type { FinanceOverview } from "@/lib/finance/types";
import { getProfile } from "@/lib/data/profile";
import { getGoals } from "@/lib/data/goals";
import { getTasks } from "@/lib/data/tasks";
import { getHabits } from "@/lib/data/habits";
import { calculateOnePercentScore } from "@/lib/score";
import { buildProactiveInsights } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { calculateDomainScores } from "@/lib/scores/domain-scores";
import type { CalendarEvent, Goal, Habit, HealthSnapshot, MoneySnapshot, Profile, Task } from "@/lib/types";

type NutritionContext = { targets?:{calories:number;protein:number;carbs:number;fat:number}|null; today: { calories: number; protein: number; carbs: number; fat: number; meals: number }; recentMeals: Array<{ name: string; calories: number; protein: number; loggedAt: string }>; };
export type TrainingContext = { trainingDays?:number[]; todayStatus?:string; activePlan: null | { id:string; title: string; goal: string; daysPerWeek: number; sessionMinutes: number; experience: string; schedule:Array<{key:string;day:string;dayIndex:number;title:string;focus?:string;duration:number}> }; todaySession: null | { key?:string; title: string; focus: string; duration: number; exercises: Array<{ name: string; sets: string; reps: string }> }; workoutsLast7Days: number; };
type SupplementContext = { scheduledToday?:string[]; remainingToday?:string[]; active: Array<{ name: string; dosage: string | null; timing: string; frequency: string }>; loggedToday: string[] };
type WorkScheduleContext = Array<{ label: string; days: number[]; startTime: string; endTime: string }>;
type FinanceDetailContext = { accounts: Array<{ name: string; type: string | null; balance: number; institution: string | null; source: string | null }>; investmentsValue: number; holdings: Array<{ ticker: string | null; name: string; value: number }> };
type AccountabilityContext = { friendCount: number; activeChallenges: Array<{ title: string; metric: string; points: number; endsOn: string }>; streak: { current: number; best: number } };
type ReminderContext = Array<{ title: string; targetType: string; recurrence: string; remindAt: string | null; timeOfDay: string | null }>;
type IntegrationContext = Array<{ provider: string; status: string | null }>;
type BehaviorEventSummary = { windowDays: number; total: number; counts: Record<string, number>; recent: Array<{ id: string; type: string; occurredAt: string; sourceTable: string | null; sourceId: string | null; payload: Record<string, unknown> }> };
export type ContextAvailability = "available" | "partial" | "unavailable";
export type ContextEvidence = { domain: string; table: string; ids: string[]; window?: { from: string; to: string } };
export type ContextDomain<T> = { availability: ContextAvailability; reason: string | null; data: T | null; evidence: ContextEvidence[] };

export interface UserContextDomains {
  profile: ContextDomain<{ id: string; name: string | null; timezone: string; blueprint: Profile["blueprint"] }>;
  goals: ContextDomain<{ active: number; completed: number; items: Array<{ id: string; title: string; progress: number; deadline: string | null }> }>;
  tasks: ContextDomain<{ open: number; completedRecently: number; overdue: number; priorities: Array<{ id: string; title: string; tier: string; dueAt: string | null; goalId: string | null }> }>;
  habits: ContextDomain<{ tracked: number; averageConsistency: number | null; recentLogDays: string[]; items: Array<{ id: string; title: string; consistencyPct: number; streakDays: number }> }>;
  calendar: ContextDomain<{ upcoming: CalendarEvent[] }>;
  workSchedule: ContextDomain<WorkScheduleContext>;
  workout: ContextDomain<TrainingContext>;
  nutrition: ContextDomain<NutritionContext>;
  supplements: ContextDomain<SupplementContext>;
  health: ContextDomain<{ snapshot:HealthSnapshot; score:number; factors?:HealthScore["factors"]; drivers:{training:number|null;diet:number|null;protocol:number|null;consistency:number|null} }>;
  finance: ContextDomain<{ summary: MoneySnapshot; score:number; drivers:{budget:number|null;cashFlow:number|null;savings:number|null;consistency:number|null}; primaryReason:string; accountCount: number; cashBalance: number | null; totalConnectedBalance: number; investmentsValue: number|null; monthlySpending:number|null;budgetRemaining:number|null;savingsRate:number|null;spendingPacePct:number|null;upcomingBills:{count:number;total:number|null;next:string|null};goals:Array<{name:string;progressPct:number;status:string;requiredMonthlyPace:number|null;targetPaceDate:string|null}>;recommendation:{observation:string;impact:string;recommendedAction:string|null}|null;freshness:string|null }>;
  recentScores: ContextDomain<Array<{ id: string; score: number; scoredOn: string; breakdown: Record<string, number> | null }>>;
  recentPerformance: ContextDomain<{ activeDays: number; completedTasks: number; workouts: number; habitLogDays: number }>;
  achievements: ContextDomain<{ completedChallenges: Array<{ id: string; title: string; points: number; endedOn: string }>; unlocked: Array<{ id:string; key:string; title:string; category:string; unlockedAt:string }> }>;
  progression: ContextDomain<{ activeGoals: Array<{ id: string; title: string; progress: number; nextMilestone: number; deadline: string | null }>; state:null|{stage:string;currentScore:number;highestScore:number;coveragePct:number;sustainedHighDays:number;onePercentUnlocked:boolean} }>;
  eventHistory: ContextDomain<BehaviorEventSummary>;
}

export interface ProjectYouContext {
  profile: Profile;
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  health: HealthSnapshot;
  money: MoneySnapshot;
  schedule: CalendarEvent[];
  nutrition: NutritionContext;
  training: TrainingContext;
  supplements: SupplementContext;
  workSchedule: WorkScheduleContext;
  financeDetail: FinanceDetailContext;
  financeOverview: FinanceOverview;
  accountability: AccountabilityContext;
  reminders: ReminderContext;
  integrations: IntegrationContext;
  score: ReturnType<typeof calculateOnePercentScore>;
  insights: ReturnType<typeof buildProactiveInsights>;
  generatedAt: string;
}

export interface UserContext extends ProjectYouContext { domains: UserContextDomains }

type ContextSignals = {
  metricIds:string[];eventIds:string[];transactionIds:string[];nutritionIds:string[];workoutLogIds:string[];supplementIds:string[];supplementLogIds:string[];workScheduleIds:string[];accountIds:string[];habitLogIds:string[];recentHabitDays:string[];completedTaskIds:string[];behaviorEventIds:string[];
  recentScores:Array<{id:string;score:number;scoredOn:string;breakdown:Record<string,number>|null}>;completedChallenges:Array<{id:string;title:string;points:number;endedOn:string}>;
  behaviorSummary:BehaviorEventSummary|null;
  progressionState:null|{stage:string;currentScore:number;highestScore:number;coveragePct:number;sustainedHighDays:number;onePercentUnlocked:boolean};unlockedAchievements:Array<{id:string;key:string;title:string;category:string;unlockedAt:string}>;
  windows:{week:{from:string;to:string};month:{from:string;to:string}};workoutsLast7Days:number;
  healthScoreDetails?:HealthScore;
  domainScores:{healthScore:number|null;financeScore:number|null;health:{training:number|null;diet:number|null;protocol:number|null;consistency:number|null}|null};
  errors:Partial<Record<"health"|"finance"|"calendar"|"workout"|"nutrition"|"supplements"|"workSchedule"|"recentScores"|"recentPerformance"|"achievements"|"progression"|"eventHistory",string[]>>;
};

export async function buildUserContext(): Promise<UserContext> {
  const [profile, goals, tasks, habits, live] = await Promise.all([getProfile(), getGoals(), getTasks(), getHabits(), getLiveContext()]);
  const today=localDate(new Date());const saved=live.contextSignals.recentScores;const prior=saved.find(item=>item.scoredOn!==today)??saved[1]??saved[0];
  const score = calculateOnePercentScore({ goals, tasks, habits, health: live.health, money: live.money, previousScore:prior?.score??0, personalBest:saved.reduce((best,item)=>Math.max(best,item.score),0) });
  const generatedAt = new Date().toISOString();
  const { contextSignals, ...liveContext } = live;
  const base: ProjectYouContext = { profile, goals, tasks, habits, ...liveContext, score, insights: buildProactiveInsights({ score, tasks, goals, habits }), generatedAt };
  return { ...base, domains: buildDomains(base, contextSignals) };
}

// Compatibility name for current coach, planning, and review callers.
export const buildProjectYouContext = buildUserContext;

async function getLiveContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [overview, financeOverview] = await Promise.all([getHealthOverview(), getFinanceOverview()]);
  const now = new Date();
  const dayStart = dateStart(overview.today,overview.timezone);
  const dayEnd = dateStart(shiftDate(overview.today,1),overview.timezone);
  const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate()-6);
  const monthStart = new Date(dayStart); monthStart.setDate(monthStart.getDate()-29);
  const scheduleEnd = new Date(dayStart); scheduleEnd.setDate(scheduleEnd.getDate()+7);
  const streakStart = new Date(dayStart); streakStart.setDate(streakStart.getDate()-90);

  const [metricsRes, workoutsTodayRes, workouts7Res, eventsRes, transactionsRes, budgetsRes, billsRes, nutritionRes, planRes, planLogsRes, supplementsRes, supplementLogsRes, workScheduleRes, accountsRes, holdingsRes, remindersRes, connectionsRes, challengeMembersRes, integrationsRes, habitLogsRes, taskCompletionsRes, scoresRes, behaviorRes, progressionRes, achievementsRes] = await Promise.all([
    supabase.from("health_metrics").select("id,metric_type,value,recorded_at").order("recorded_at",{ascending:false}).limit(24),
    supabase.from("workouts").select("id").gte("performed_at",dayStart.toISOString()).lt("performed_at",dayEnd.toISOString()),
    supabase.from("workouts").select("id,performed_at").gte("performed_at",weekStart.toISOString()),
    supabase.from("calendar_events").select("id,title,start_at,end_at,location,source").gte("start_at",dayStart.toISOString()).lt("start_at",scheduleEnd.toISOString()).order("start_at").limit(30),
    supabase.from("transactions").select("id,amount,occurred_at").gte("occurred_at",monthStart.toISOString()).limit(200),
    supabase.from("budgets").select("id,monthly_limit"),
    supabase.from("bills").select("id,name,due_date,paid").eq("paid",false).gte("due_date",dayStart.toISOString().slice(0,10)).order("due_date").limit(5),
    supabase.from("nutrition_logs").select("id,meal_name,calories,protein_g,carbs_g,fat_g,logged_at").gte("logged_at",weekStart.toISOString()).order("logged_at",{ascending:false}).limit(21),
    supabase.from("workout_plans").select("id,title,goal,days_per_week,session_minutes,experience,schedule").eq("active",true).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("workout_plan_logs").select("id,plan_id,session_key,completed_on").eq("status","completed").gte("completed_on",localDate(weekStart)),
    supabase.from("supplements").select("id,name,dosage,timing,frequency").eq("active",true).order("created_at"),
    supabase.from("supplement_logs").select("id,supplement_id,logged_on").eq("logged_on",overview.today),
    supabase.from("work_schedules").select("id,label,days_of_week,start_time,end_time").eq("active",true).order("created_at"),
    supabase.from("finance_accounts").select("id,name,account_type,balance,institution,connected_via"),
    supabase.from("investment_holdings").select("id,ticker,name,value").order("value",{ascending:false}).limit(10),
    supabase.from("reminders").select("title,target_type,recurrence,remind_at,time_of_day").eq("enabled",true).order("created_at").limit(30),
    supabase.from("accountability_connections").select("id").eq("status","accepted"),
    supabase.from("challenge_members").select("points,challenges(id,title,metric,ends_on,status)").eq("user_id",user?.id ?? "00000000-0000-0000-0000-000000000000"),
    supabase.from("integrations").select("provider,status"),
    supabase.from("habit_logs").select("id,habit_id,logged_at").gte("logged_at",localDate(streakStart)).limit(500),
    supabase.from("tasks").select("id,completed_at").not("completed_at","is",null).gte("completed_at",streakStart.toISOString()).limit(200),
    supabase.from("score_snapshots").select("id,score,breakdown,scored_on:captured_on").order("captured_on",{ascending:false}).limit(14),
    supabase.from("behavior_events").select("id,event_type,occurred_at,source_table,source_id,payload").gte("occurred_at",streakStart.toISOString()).order("occurred_at",{ascending:false}).limit(100),
    supabase.from("user_progression").select("current_level,current_score,highest_score,coverage_pct,sustained_high_days,one_percent_unlocked").maybeSingle(),
    supabase.from("user_achievements").select("id,achievement_key,title,category,unlocked_at").order("unlocked_at",{ascending:false}).limit(30),
  ]);

  const metrics=metricsRes.data??[];const latest=new Map<string,number>();for(const metric of metrics){if(!latest.has(metric.metric_type))latest.set(metric.metric_type,Number(metric.value))}
  const transactions=transactionsRes.data??[];const weeklySpend=Math.abs(transactions.filter((item)=>new Date(item.occurred_at)>=weekStart&&Number(item.amount)<0).reduce((sum,item)=>sum+Number(item.amount),0));const monthlyBudget=(budgetsRes.data??[]).reduce((sum,item)=>sum+Number(item.monthly_limit??0),0);
  const todayNutrition=(nutritionRes.data??[]).filter((item)=>new Date(item.logged_at)>=dayStart&&new Date(item.logged_at)<dayEnd);
  const nutritionTotal=todayNutrition.reduce((sum,item)=>({calories:sum.calories+Number(item.calories||0),protein:sum.protein+Number(item.protein_g||0),carbs:sum.carbs+Number(item.carbs_g||0),fat:sum.fat+Number(item.fat_g||0)}),{calories:0,protein:0,carbs:0,fat:0});
  const plan=planRes.data as any;const scheduleItems=Array.isArray(plan?.schedule)?plan.schedule:[];const todaySession=scheduleItems.find((item:any)=>Number(item.dayIndex)===now.getDay())??null;
  const activeSupplements=supplementsRes.data??[];const loggedSupplementIds=new Set((supplementLogsRes.data??[]).map((item)=>item.supplement_id));
  const accounts=accountsRes.data??[];const holdings=holdingsRes.data??[];
  const activityDates=[...(habitLogsRes.data??[]).map((item)=>String(item.logged_at)),...(workouts7Res.data??[]).map((item)=>localDate(new Date(item.performed_at))),...(taskCompletionsRes.data??[]).map((item)=>localDate(new Date(item.completed_at)))];
  const streak=calculateStreak(activityDates);

  const errors:ContextSignals["errors"]={};
  addErrors(errors,"health",metricsRes);
  addErrors(errors,"calendar",eventsRes);
  addErrors(errors,"finance",transactionsRes,budgetsRes,billsRes,accountsRes,holdingsRes);
  addErrors(errors,"nutrition",nutritionRes);
  addErrors(errors,"workout",workoutsTodayRes,workouts7Res,planRes,planLogsRes);
  addErrors(errors,"supplements",supplementsRes,supplementLogsRes);
  addErrors(errors,"workSchedule",workScheduleRes);
  addErrors(errors,"recentPerformance",habitLogsRes,taskCompletionsRes,workouts7Res);
  addErrors(errors,"recentScores",scoresRes);
  addErrors(errors,"eventHistory",behaviorRes);
  addErrors(errors,"progression",progressionRes);
  addErrors(errors,"achievements",achievementsRes,challengeMembersRes);
  const domainScores=calculateDomainScores({now,plan:planRes.data as {id:string;schedule:unknown}|null,planLogs:planLogsRes.data??[],nutritionLogs:nutritionRes.data??[],supplements:supplementsRes.data??[],supplementLogs:supplementLogsRes.data??[],accounts:accountsRes.data??[],transactions:transactionsRes.data??[],budgets:budgetsRes.data??[],healthSourcesAvailable:!(errors.workout?.length&&errors.nutrition?.length&&errors.supplements?.length),financeSourcesAvailable:!errors.finance?.length});

  domainScores.healthScore=overview.score.overall;
  domainScores.health=overview.score.overall===null?null:{training:overview.score.training,diet:overview.score.diet,protocol:overview.score.supplements,consistency:overview.score.consistency};
  domainScores.financeScore=financeOverview.score.overall;
  domainScores.finance=financeOverview.score.overall===null?null:{budget:financeOverview.score.budget,cashFlow:financeOverview.score.cashFlow,savings:financeOverview.score.savings,consistency:financeOverview.score.consistency,spendingOnTarget:financeOverview.metrics.spendingPacePct===null?null:financeOverview.metrics.spendingPacePct<=100};
  const health:HealthSnapshot={sleepMinutes:latest.get("sleep_minutes")??null,sleepTargetMinutes:null,recoveryPct:latest.get("recovery_pct")??null,steps:latest.get("steps")??null,stepsTarget:null,waterCups:latest.get("water_cups")??null,waterTargetCups:null,workoutStatus:overview.training.status==="completed"?"completed":overview.training.todayWorkout?"scheduled":"not_scheduled",nutritionStatus:overview.nutrition.meals.length?"logged":"unavailable"};
  const money:MoneySnapshot={spentTodayCents:Math.round(Math.abs(transactions.filter((item)=>new Date(item.occurred_at)>=dayStart&&Number(item.amount)<0).reduce((sum,item)=>sum+Number(item.amount),0))*100),weeklyBudgetPctUsed:financeOverview.metrics.spendingPacePct??0,nextBillLabel:financeOverview.bills.next?.name??null,savingsGoalPct:financeOverview.goals[0]?.progressPct??0};
  const schedule:CalendarEvent[]=(eventsRes.data??[]).map((event)=>({id:event.id,title:event.title,startAt:event.start_at,endAt:event.end_at,location:event.location,isCurrent:new Date(event.start_at)<=now&&new Date(event.end_at)>=now}));
  const nutrition:NutritionContext={targets:overview.nutrition.targets,today:{...overview.nutrition.totals,meals:overview.nutrition.meals.length},recentMeals:(nutritionRes.data??[]).slice(0,10).map((item)=>({name:item.meal_name||"Meal",calories:Number(item.calories||0),protein:Number(item.protein_g||0),loggedAt:item.logged_at}))};
  const training:TrainingContext={trainingDays:overview.training.activePlan?.schedule.map(x=>x.dayIndex)??[],todayStatus:overview.training.status,activePlan:plan?{id:plan.id,title:plan.title,goal:plan.goal,daysPerWeek:Number(plan.days_per_week),sessionMinutes:Number(plan.session_minutes),experience:plan.experience,schedule:scheduleItems.map((item:any,index:number)=>({key:String(item.key??`session-${index+1}`),day:String(item.day??"Training day"),dayIndex:Number(item.dayIndex),title:String(item.title??`Training Session ${index+1}`),focus:item.focus?String(item.focus):undefined,duration:Number(item.duration??plan.session_minutes??45)}))}:null,todaySession:overview.training.todayWorkout?{key:overview.training.todayWorkout.key,title:overview.training.todayWorkout.title,focus:overview.training.todayWorkout.focus??"",duration:overview.training.todayWorkout.duration,exercises:overview.training.todayWorkout.exercises}:null,workoutsLast7Days:(workouts7Res.data??[]).length};
  const supplements:SupplementContext={scheduledToday:overview.supplements.filter(x=>x.due).map(x=>x.name),remainingToday:overview.supplements.filter(x=>x.due&&!x.done).map(x=>x.name),active:activeSupplements.map((item)=>({name:item.name,dosage:item.dosage,timing:item.timing,frequency:item.frequency})),loggedToday:overview.supplements.filter(item=>item.done).map(item=>item.name)};
  const workSchedule:WorkScheduleContext=(workScheduleRes.data??[]).map((item)=>({label:item.label,days:item.days_of_week??[],startTime:item.start_time,endTime:item.end_time}));
  const financeDetail:FinanceDetailContext={accounts:accounts.map((item)=>({name:item.name,type:item.account_type,balance:Number(item.balance||0),institution:item.institution,source:item.connected_via})),investmentsValue:holdings.reduce((sum,item)=>sum+Number(item.value||0),0),holdings:holdings.slice(0,10).map((item)=>({ticker:item.ticker,name:item.name,value:Number(item.value||0)}))};
  const activeChallenges=(challengeMembersRes.data??[]).map((row:any)=>({points:Number(row.points||0),challenge:row.challenges})).filter((row:any)=>row.challenge?.status==="active").map((row:any)=>({title:row.challenge.title,metric:row.challenge.metric,points:row.points,endsOn:row.challenge.ends_on}));
  const accountability:AccountabilityContext={friendCount:(connectionsRes.data??[]).length,activeChallenges,streak};
  const reminders:ReminderContext=(remindersRes.data??[]).map((item)=>({title:item.title,targetType:item.target_type,recurrence:item.recurrence,remindAt:item.remind_at,timeOfDay:item.time_of_day}));
  const integrations:IntegrationContext=(integrationsRes.data??[]).map((item)=>({provider:item.provider,status:item.status}));

  const completedChallenges=(challengeMembersRes.data??[]).map((row:any)=>({id:String(row.challenges?.id??""),title:String(row.challenges?.title??""),points:Number(row.points||0),endedOn:String(row.challenges?.ends_on??""),status:String(row.challenges?.status??"")})).filter((row:any)=>row.id&&row.title&&row.status==="completed").map(({status:_,...row}:any)=>row);
  const behaviorRows=behaviorRes.data??[];const behaviorCounts=behaviorRows.reduce<Record<string,number>>((counts,row:any)=>{const type=String(row.event_type);counts[type]=(counts[type]??0)+1;return counts},{});
  const behaviorSummary:BehaviorEventSummary|null=behaviorRows.length?{windowDays:90,total:behaviorRows.length,counts:behaviorCounts,recent:behaviorRows.slice(0,30).map((row:any)=>({id:String(row.id),type:String(row.event_type),occurredAt:String(row.occurred_at),sourceTable:row.source_table?String(row.source_table):null,sourceId:row.source_id?String(row.source_id):null,payload:(row.payload??{}) as Record<string,unknown>}))}:null;
  const progressionState=progressionRes.data?{stage:String(progressionRes.data.current_level),currentScore:Number(progressionRes.data.current_score),highestScore:Number(progressionRes.data.highest_score),coveragePct:Number(progressionRes.data.coverage_pct),sustainedHighDays:Number(progressionRes.data.sustained_high_days),onePercentUnlocked:Boolean(progressionRes.data.one_percent_unlocked)}:null;
  const unlockedAchievements=(achievementsRes.data??[]).map(row=>({id:String(row.id),key:String(row.achievement_key),title:String(row.title),category:String(row.category),unlockedAt:String(row.unlocked_at)}));
  const contextSignals={
    metricIds:(metricsRes.data??[]).map((row:any)=>String(row.id)), eventIds:(eventsRes.data??[]).map((row:any)=>String(row.id)), transactionIds:(transactionsRes.data??[]).map((row:any)=>String(row.id)),
    nutritionIds:(nutritionRes.data??[]).map((row:any)=>String(row.id)), workoutLogIds:(planLogsRes.data??[]).map((row:any)=>String(row.id)), supplementIds:activeSupplements.map((row:any)=>String(row.id)), supplementLogIds:(supplementLogsRes.data??[]).map((row:any)=>String(row.id)),
    workScheduleIds:(workScheduleRes.data??[]).map((row:any)=>String(row.id)), accountIds:accounts.map((row:any)=>String(row.id)), habitLogIds:(habitLogsRes.data??[]).map((row:any)=>String(row.id)), recentHabitDays:Array.from(new Set((habitLogsRes.data??[]).map((row:any)=>String(row.logged_at)))).slice(-30),
    completedTaskIds:(taskCompletionsRes.data??[]).map((row:any)=>String(row.id)), recentScores:(scoresRes.data??[]).map((row:any)=>({id:String(row.id),score:Number(row.score),scoredOn:String(row.scored_on),breakdown:(row.breakdown??null) as Record<string,number>|null})), completedChallenges,
    behaviorEventIds:behaviorRows.map((row:any)=>String(row.id)),behaviorSummary,progressionState,unlockedAchievements,
    windows:{week:{from:weekStart.toISOString(),to:now.toISOString()},month:{from:monthStart.toISOString(),to:now.toISOString()}}, workoutsLast7Days:(workouts7Res.data??[]).length,domainScores,healthScoreDetails:overview.score,errors,
  };
  return {health,money,schedule,nutrition,training,supplements,workSchedule,financeDetail,financeOverview,accountability,reminders,integrations,contextSignals};
}

function buildDomains(context:ProjectYouContext,signals:ContextSignals):UserContextDomains {
  const now=new Date(context.generatedAt);const openTasks=context.tasks.filter(task=>!task.completedAt);const overdue=openTasks.filter(task=>task.dueAt&&new Date(task.dueAt)<now);
  const activeGoals=context.goals.filter(goal=>goal.status==="active");const completedGoals=context.goals.filter(goal=>goal.status==="completed");
  const averageConsistency=context.habits.length?Math.round(context.habits.reduce((sum,habit)=>sum+habit.consistencyPct,0)/context.habits.length):null;
  const evidence=(domain:string,table:string,ids:string[],window?:{from:string;to:string}):ContextEvidence[]=>ids.length?[{domain,table,ids:ids.slice(0,30),...(window?{window}:{})}]:[];
  const domain=<T>(data:T|null,reason:string|null,evidenceRows:ContextEvidence[],errors:string[]=[]):ContextDomain<T>=>({availability:data===null?"unavailable":errors.length?"partial":"available",reason:data===null?(errors.length?`Could not load this context: ${errors.join(" ")}`:reason):errors.length?`Some context could not be loaded: ${errors.join(" ")}`:null,data,evidence:evidenceRows});
  const hasHealthScore=Boolean(context.training.activePlan)||signals.nutritionIds.length>0||signals.supplementIds.length>0;
  const hasFinance=signals.domainScores.financeScore!==null||signals.accountIds.length>0||signals.transactionIds.length>0||Boolean(context.money.nextBillLabel)||context.financeOverview.goals.length>0;
  const recentCompletedTaskIds=new Set(signals.completedTaskIds);const performanceActiveDays=new Set([...signals.recentHabitDays,...context.tasks.filter(task=>recentCompletedTaskIds.has(task.id)&&task.completedAt).map(task=>task.completedAt!.slice(0,10))]).size;
  return {
    profile:domain({id:context.profile.id,name:context.profile.fullName,timezone:context.profile.timezone,blueprint:context.profile.blueprint},null,evidence("profile","profiles",[context.profile.id])),
    goals:domain(context.goals.length?{active:activeGoals.length,completed:completedGoals.length,items:context.goals.slice(0,12).map(goal=>({id:goal.id,title:goal.title,progress:goal.progress,deadline:goal.deadline}))}:null,"No goals are available.",evidence("goals","goals",context.goals.map(goal=>goal.id))),
    tasks:domain(context.tasks.length?{open:openTasks.length,completedRecently:signals.completedTaskIds.length,overdue:overdue.length,priorities:openTasks.slice(0,12).map(task=>({id:task.id,title:task.title,tier:task.tier,dueAt:task.dueAt,goalId:task.goalId}))}:null,"No tasks are available.",evidence("tasks","tasks",context.tasks.map(task=>task.id),signals.windows.month)),
    habits:domain(context.habits.length?{tracked:context.habits.length,averageConsistency,recentLogDays:signals.recentHabitDays.slice(-14),items:context.habits.slice(0,12).map(habit=>({id:habit.id,title:habit.title,consistencyPct:habit.consistencyPct,streakDays:habit.streakDays}))}:null,"No habits are available.",[...evidence("habits","habits",context.habits.map(habit=>habit.id)),...evidence("habits","habit_logs",signals.habitLogIds,signals.windows.month)]),
    calendar:domain(context.schedule.length?{upcoming:context.schedule}:null,"No upcoming calendar events are available.",evidence("calendar","calendar_events",signals.eventIds),signals.errors.calendar),
    workSchedule:domain(context.workSchedule.length?context.workSchedule:null,"No work schedule is available.",evidence("workSchedule","work_schedules",signals.workScheduleIds),signals.errors.workSchedule),
    workout:domain(context.training.activePlan||context.training.workoutsLast7Days?context.training:null,"No workout plan or recent completion is available.",evidence("workout","workout_plan_logs",signals.workoutLogIds,signals.windows.week),signals.errors.workout),
    nutrition:domain(signals.nutritionIds.length?context.nutrition:null,"No recent nutrition logs are available.",evidence("nutrition","nutrition_logs",signals.nutritionIds,signals.windows.week),signals.errors.nutrition),
    supplements:domain(context.supplements.active.length?context.supplements:null,"No active supplements are available.",[...evidence("supplements","supplements",signals.supplementIds),...evidence("supplements","supplement_logs",signals.supplementLogIds)],signals.errors.supplements),
    health:domain(hasHealthScore&&signals.domainScores.healthScore!==null&&signals.domainScores.health?{snapshot:context.health,factors:signals.healthScoreDetails?.factors,score:signals.domainScores.healthScore,drivers:signals.domainScores.health}:null,"No Health Score inputs are available.",[
      ...evidence("health","health_metrics",signals.metricIds,signals.windows.month),...evidence("health","workout_plan_logs",signals.workoutLogIds,signals.windows.week),...evidence("health","nutrition_logs",signals.nutritionIds,signals.windows.week),...evidence("health","supplement_logs",signals.supplementLogIds,signals.windows.week)
    ],[...(signals.errors.health??[]),...(signals.errors.workout??[]),...(signals.errors.nutrition??[]),...(signals.errors.supplements??[])]),
    finance:domain(hasFinance&&signals.domainScores.financeScore!==null?{summary:context.money,score:signals.domainScores.financeScore,drivers:{budget:context.financeOverview.score.budget,cashFlow:context.financeOverview.score.cashFlow,savings:context.financeOverview.score.savings,consistency:context.financeOverview.score.consistency},primaryReason:context.financeOverview.score.primaryReason,accountCount:signals.accountIds.length,cashBalance:context.financeOverview.metrics.cashAvailable,totalConnectedBalance:context.financeDetail.accounts.reduce((sum,account)=>sum+account.balance,0),investmentsValue:context.financeOverview.investments.totalValue,monthlySpending:context.financeOverview.metrics.monthlySpending,budgetRemaining:context.financeOverview.metrics.budgetRemaining,savingsRate:context.financeOverview.metrics.savingsRate,spendingPacePct:context.financeOverview.metrics.spendingPacePct,upcomingBills:{count:context.financeOverview.bills.upcomingCount,total:context.financeOverview.bills.totalUpcoming,next:context.financeOverview.bills.next?.name??null},goals:context.financeOverview.goals.map(goal=>({name:goal.name,progressPct:goal.progressPct,status:goal.status,requiredMonthlyPace:goal.requiredMonthlyPace,targetPaceDate:goal.targetPaceDate})),recommendation:context.financeOverview.recommendation?{observation:context.financeOverview.recommendation.observation,impact:context.financeOverview.recommendation.impact,recommendedAction:context.financeOverview.recommendation.recommendedAction}:null,freshness:context.financeOverview.dataFreshness.lastSyncedAt}:null,"No connected financial data is available.",[...evidence("finance","finance_accounts",signals.accountIds),...evidence("finance","transactions",signals.transactionIds,signals.windows.month)],signals.errors.finance),
    recentScores:domain(signals.recentScores.length?signals.recentScores:null,"No recent saved scores are available.",evidence("recentScores","score_snapshots",signals.recentScores.map(row=>row.id)),signals.errors.recentScores),
    recentPerformance:domain(performanceActiveDays||signals.workoutsLast7Days||signals.completedTaskIds.length?{activeDays:performanceActiveDays,completedTasks:signals.completedTaskIds.length,workouts:signals.workoutsLast7Days,habitLogDays:signals.recentHabitDays.length}:null,"No recent performance history is available.",[...evidence("recentPerformance","habit_logs",signals.habitLogIds,signals.windows.month),...evidence("recentPerformance","tasks",signals.completedTaskIds,signals.windows.month),...evidence("recentPerformance","workout_plan_logs",signals.workoutLogIds,signals.windows.week)],signals.errors.recentPerformance),
    achievements:domain(signals.completedChallenges.length||signals.unlockedAchievements.length?{completedChallenges:signals.completedChallenges,unlocked:signals.unlockedAchievements}:null,"No achievements are unlocked yet.",[...evidence("achievements","challenges",signals.completedChallenges.map(row=>row.id)),...evidence("achievements","user_achievements",signals.unlockedAchievements.map(row=>row.id))]),
    progression:domain(activeGoals.length||signals.progressionState?{activeGoals:activeGoals.map(goal=>({id:goal.id,title:goal.title,progress:goal.progress,nextMilestone:Math.min(100,Math.max(25,Math.ceil((goal.progress+1)/25)*25)),deadline:goal.deadline})),state:signals.progressionState}:null,"No progression state is available.",evidence("progression","goals",activeGoals.map(goal=>goal.id))),
    eventHistory:domain(signals.behaviorSummary,"No longitudinal behavior events are available yet.",evidence("eventHistory","behavior_events",signals.behaviorEventIds),signals.errors.eventHistory),
  };
}

function cashBalance(accounts:FinanceDetailContext["accounts"]){const cash=accounts.filter(account=>/checking|savings|cash|depository/i.test(account.type??""));return cash.length?cash.reduce((sum,account)=>sum+account.balance,0):null;}

function calculateStreak(values:string[]){const dates=Array.from(new Set(values.map((value)=>value.slice(0,10)))).sort();let best=0,run=0,previous:number|null=null;for(const value of dates){const time=new Date(`${value}T12:00:00`).getTime();if(previous!=null&&Math.round((time-previous)/86400000)===1)run+=1;else run=1;best=Math.max(best,run);previous=time}const set=new Set(dates);const cursor=new Date();cursor.setHours(12,0,0,0);if(!set.has(localDate(cursor)))cursor.setDate(cursor.getDate()-1);let current=0;while(set.has(localDate(cursor))){current++;cursor.setDate(cursor.getDate()-1)}return{current,best}}
function localDate(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function addErrors(target:ContextSignals["errors"],key:keyof ContextSignals["errors"],...results:Array<{error:{message:string}|null}>){const messages=results.flatMap(result=>result.error?[result.error.message]:[]);if(messages.length)target[key]=messages;}
import "server-only";
