import { getProfile } from "@/lib/data/profile";
import { getGoals } from "@/lib/data/goals";
import { getTasks } from "@/lib/data/tasks";
import { getHabits } from "@/lib/data/habits";
import { calculateOnePercentScore } from "@/lib/score";
import { buildProactiveInsights } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, Goal, Habit, HealthSnapshot, MoneySnapshot, Profile, Task } from "@/lib/types";

type NutritionContext = { today: { calories: number; protein: number; carbs: number; fat: number; meals: number }; recentMeals: Array<{ name: string; calories: number; protein: number; loggedAt: string }>; };
type TrainingContext = { activePlan: null | { title: string; goal: string; daysPerWeek: number; sessionMinutes: number; experience: string }; todaySession: null | { title: string; focus: string; duration: number; exercises: Array<{ name: string; sets: string; reps: string }> }; workoutsLast7Days: number; };
type SupplementContext = { active: Array<{ name: string; dosage: string | null; timing: string; frequency: string }>; loggedToday: string[] };
type WorkScheduleContext = Array<{ label: string; days: number[]; startTime: string; endTime: string }>;
type FinanceDetailContext = { accounts: Array<{ name: string; type: string | null; balance: number; institution: string | null; source: string | null }>; investmentsValue: number; holdings: Array<{ ticker: string | null; name: string; value: number }> };
type AccountabilityContext = { friendCount: number; activeChallenges: Array<{ title: string; metric: string; points: number; endsOn: string }>; streak: { current: number; best: number } };
type ReminderContext = Array<{ title: string; targetType: string; recurrence: string; remindAt: string | null; timeOfDay: string | null }>;
type IntegrationContext = Array<{ provider: string; status: string | null }>;

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
  accountability: AccountabilityContext;
  reminders: ReminderContext;
  integrations: IntegrationContext;
  score: ReturnType<typeof calculateOnePercentScore>;
  insights: ReturnType<typeof buildProactiveInsights>;
  generatedAt: string;
}

export async function buildProjectYouContext(): Promise<ProjectYouContext> {
  const [profile, goals, tasks, habits, live] = await Promise.all([getProfile(), getGoals(), getTasks(), getHabits(), getLiveContext()]);
  const score = calculateOnePercentScore({ goals, tasks, habits, health: live.health, money: live.money });
  return { profile, goals, tasks, habits, ...live, score, insights: buildProactiveInsights({ score, tasks, goals, habits }), generatedAt: new Date().toISOString() };
}

async function getLiveContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate()+1);
  const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate()-6);
  const monthStart = new Date(dayStart); monthStart.setDate(monthStart.getDate()-29);
  const scheduleEnd = new Date(dayStart); scheduleEnd.setDate(scheduleEnd.getDate()+7);
  const streakStart = new Date(dayStart); streakStart.setDate(streakStart.getDate()-90);

  const [metricsRes, workoutsTodayRes, workouts7Res, eventsRes, transactionsRes, budgetsRes, billsRes, nutritionRes, planRes, planLogsRes, supplementsRes, supplementLogsRes, workScheduleRes, accountsRes, holdingsRes, remindersRes, connectionsRes, challengeMembersRes, integrationsRes, habitLogsRes, taskCompletionsRes] = await Promise.all([
    supabase.from("health_metrics").select("metric_type,value,recorded_at").order("recorded_at",{ascending:false}).limit(100),
    supabase.from("workouts").select("id").gte("performed_at",dayStart.toISOString()).lt("performed_at",dayEnd.toISOString()),
    supabase.from("workouts").select("id,performed_at").gte("performed_at",weekStart.toISOString()),
    supabase.from("calendar_events").select("id,title,start_at,end_at,location,source").gte("start_at",dayStart.toISOString()).lt("start_at",scheduleEnd.toISOString()).order("start_at"),
    supabase.from("transactions").select("amount,occurred_at").gte("occurred_at",monthStart.toISOString()),
    supabase.from("budgets").select("monthly_limit"),
    supabase.from("bills").select("name,due_date,paid").eq("paid",false).gte("due_date",dayStart.toISOString().slice(0,10)).order("due_date").limit(1),
    supabase.from("nutrition_logs").select("meal_name,calories,protein_g,carbs_g,fat_g,logged_at").gte("logged_at",weekStart.toISOString()).order("logged_at",{ascending:false}).limit(30),
    supabase.from("workout_plans").select("id,title,goal,days_per_week,session_minutes,experience,schedule").eq("active",true).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("workout_plan_logs").select("plan_id,session_key,completed_on").gte("completed_on",localDate(weekStart)),
    supabase.from("supplements").select("id,name,dosage,timing,frequency").eq("active",true).order("created_at"),
    supabase.from("supplement_logs").select("supplement_id,logged_on").eq("logged_on",localDate(now)),
    supabase.from("work_schedules").select("label,days_of_week,start_time,end_time").eq("active",true).order("created_at"),
    supabase.from("finance_accounts").select("name,account_type,balance,institution,connected_via"),
    supabase.from("investment_holdings").select("ticker,name,value").order("value",{ascending:false}).limit(20),
    supabase.from("reminders").select("title,target_type,recurrence,remind_at,time_of_day").eq("enabled",true).order("created_at").limit(30),
    supabase.from("accountability_connections").select("id").eq("status","accepted"),
    supabase.from("challenge_members").select("points,challenges(title,metric,ends_on,status)").eq("user_id",user?.id ?? "00000000-0000-0000-0000-000000000000"),
    supabase.from("integrations").select("provider,status"),
    supabase.from("habit_logs").select("logged_at").gte("logged_at",localDate(streakStart)),
    supabase.from("tasks").select("completed_at").not("completed_at","is",null).gte("completed_at",streakStart.toISOString()),
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

  const health:HealthSnapshot={sleepMinutes:latest.get("sleep_minutes")??0,sleepTargetMinutes:480,recoveryPct:latest.get("recovery_pct")??0,steps:latest.get("steps")??0,stepsTarget:10000,waterCups:latest.get("water_cups")??0,waterTargetCups:10,workoutStatus:(workoutsTodayRes.data??[]).length?"completed":todaySession?"scheduled":"missed",nutritionStatus:todayNutrition.length?"on_track":"under"};
  const money:MoneySnapshot={spentTodayCents:Math.round(Math.abs(transactions.filter((item)=>new Date(item.occurred_at)>=dayStart&&Number(item.amount)<0).reduce((sum,item)=>sum+Number(item.amount),0))*100),weeklyBudgetPctUsed:monthlyBudget>0?Math.min(100,Math.round((weeklySpend/(monthlyBudget/4.33))*100)):0,nextBillLabel:billsRes.data?.[0]?.name??null,savingsGoalPct:0};
  const schedule:CalendarEvent[]=(eventsRes.data??[]).map((event)=>({id:event.id,title:event.title,startAt:event.start_at,endAt:event.end_at,location:event.location,isCurrent:new Date(event.start_at)<=now&&new Date(event.end_at)>=now}));
  const nutrition:NutritionContext={today:{...nutritionTotal,meals:todayNutrition.length},recentMeals:(nutritionRes.data??[]).slice(0,10).map((item)=>({name:item.meal_name||"Meal",calories:Number(item.calories||0),protein:Number(item.protein_g||0),loggedAt:item.logged_at}))};
  const training:TrainingContext={activePlan:plan?{title:plan.title,goal:plan.goal,daysPerWeek:Number(plan.days_per_week),sessionMinutes:Number(plan.session_minutes),experience:plan.experience}:null,todaySession:todaySession?{title:todaySession.title,focus:todaySession.focus||"",duration:Number(todaySession.duration||plan?.session_minutes||0),exercises:(todaySession.exercises??[]).slice(0,8).map((item:any)=>({name:String(item.name),sets:String(item.sets),reps:String(item.reps)}))}:null,workoutsLast7Days:(workouts7Res.data??[]).length};
  const supplements:SupplementContext={active:activeSupplements.map((item)=>({name:item.name,dosage:item.dosage,timing:item.timing,frequency:item.frequency})),loggedToday:activeSupplements.filter((item)=>loggedSupplementIds.has(item.id)).map((item)=>item.name)};
  const workSchedule:WorkScheduleContext=(workScheduleRes.data??[]).map((item)=>({label:item.label,days:item.days_of_week??[],startTime:item.start_time,endTime:item.end_time}));
  const financeDetail:FinanceDetailContext={accounts:accounts.map((item)=>({name:item.name,type:item.account_type,balance:Number(item.balance||0),institution:item.institution,source:item.connected_via})),investmentsValue:holdings.reduce((sum,item)=>sum+Number(item.value||0),0),holdings:holdings.slice(0,10).map((item)=>({ticker:item.ticker,name:item.name,value:Number(item.value||0)}))};
  const activeChallenges=(challengeMembersRes.data??[]).map((row:any)=>({points:Number(row.points||0),challenge:row.challenges})).filter((row:any)=>row.challenge?.status==="active").map((row:any)=>({title:row.challenge.title,metric:row.challenge.metric,points:row.points,endsOn:row.challenge.ends_on}));
  const accountability:AccountabilityContext={friendCount:(connectionsRes.data??[]).length,activeChallenges,streak};
  const reminders:ReminderContext=(remindersRes.data??[]).map((item)=>({title:item.title,targetType:item.target_type,recurrence:item.recurrence,remindAt:item.remind_at,timeOfDay:item.time_of_day}));
  const integrations:IntegrationContext=(integrationsRes.data??[]).map((item)=>({provider:item.provider,status:item.status}));

  return {health,money,schedule,nutrition,training,supplements,workSchedule,financeDetail,accountability,reminders,integrations};
}

export function compactContext(context: ProjectYouContext) {
  return {
    user:{name:context.profile.fullName,timezone:context.profile.timezone,blueprint:context.profile.blueprint},
    onePercentScore:context.score.score,scoreBreakdown:context.score.score.breakdown,scoreRationale:context.score.rationale,
    goals:context.goals.map(({id,title,category,target,deadline,progress,objective90day,status})=>({id,title,category,target,deadline,progress,objective90day,status})),
    tasks:context.tasks.map(({id,title,tier,dueAt,completedAt,goalId,meta})=>({id,title,tier,dueAt,completedAt,goalId,meta})),
    habits:context.habits,
    health:context.health,
    nutrition:context.nutrition,
    training:context.training,
    supplements:context.supplements,
    finance:{summary:context.money,detail:context.financeDetail},
    schedule:context.schedule,
    recurringWorkSchedule:context.workSchedule,
    reminders:context.reminders,
    accountability:context.accountability,
    integrations:context.integrations,
    proactiveInsights:context.insights.map((item)=>item.content),
    generatedAt:context.generatedAt,
  };
}

function calculateStreak(values:string[]){const dates=Array.from(new Set(values.map((value)=>value.slice(0,10)))).sort();let best=0,run=0,previous:number|null=null;for(const value of dates){const time=new Date(`${value}T12:00:00`).getTime();if(previous!=null&&Math.round((time-previous)/86400000)===1)run+=1;else run=1;best=Math.max(best,run);previous=time}const set=new Set(dates);const cursor=new Date();cursor.setHours(12,0,0,0);if(!set.has(localDate(cursor)))cursor.setDate(cursor.getDate()-1);let current=0;while(set.has(localDate(cursor))){current++;cursor.setDate(cursor.getDate()-1)}return{current,best}}
function localDate(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
