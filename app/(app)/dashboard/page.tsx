import { getHealthOverview } from "@/lib/data/health";
import { userDate, supplementDue, scheduleForDate, dateStart, shiftDate, type TrainingPlan } from "@/lib/health/schedule";
import { getProfile } from "@/lib/data/profile";
import { getGoals } from "@/lib/data/goals";
import { getTasks } from "@/lib/data/tasks";
import { getHabits } from "@/lib/data/habits";
import { createClient } from "@/lib/supabase/server";
import { TrajectoryCommandCenter, type DashboardDay, type DashboardTask } from "@/components/dashboard/trajectory-command-center";
import type { Goal, Habit, Task } from "@/lib/types";

type PlanSession = { key: string; day: string; dayIndex: number; title: string; focus?: string; duration: number; exercises?: Array<{name:string;sets:string;reps:string;rest?:string}> };
type ActivePlan = TrainingPlan;
type Supplement = { id: string; name: string; dosage: string | null; timing: string; frequency: string; created_at: string };
type WorkSchedule = { label: string; days_of_week: number[]; start_time: string; end_time: string; active: boolean };

const tierWeight: Record<Task["tier"], number> = { critical: 30, important: 20, optional: 10 };

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile=await getProfile();
  const now = new Date(`${userDate(new Date(),profile.timezone)}T12:00:00`);
  const today = localDate(now);
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
  const currentStart = new Date(now); currentStart.setHours(0,0,0,0); currentStart.setDate(currentStart.getDate()-6);

  const [goals, tasks, habits, live, healthOverview] = await Promise.all([
    getGoals(), getTasks(), getHabits(), getLiveDashboardData(supabase, rangeStart, rangeEnd, profile.timezone), getHealthOverview(),
  ]);

  const firstName=(profile.fullName??"You").split(" ")[0];
  const activeGoals=goals.filter((goal)=>goal.status==="active");
  const activeGoalIds=new Set(activeGoals.map((goal)=>goal.id));
  const goalById=new Map(activeGoals.map((goal)=>[goal.id,goal]));
  const openTasks=tasks.filter((task)=>!task.completedAt).sort((a,b)=>taskPriority(b,activeGoalIds)-taskPriority(a,activeGoalIds));
  const dueToday=tasks.filter((task)=>task.dueAt&&localDate(new Date(task.dueAt))===today&&!task.completedAt);
  const topTasks=uniqueTasks([...dueToday,...openTasks.slice(0,3)]).slice(0,6);

  const habitLogMap=multiMap(live.habitLogs,"logged_at","habit_id");
  const planLogMap=new Set(live.planLogs.map((row)=>`${row.completed_on}:${row.plan_id}:${row.session_key}`));
  const supplementLogMap=multiMap(live.supplementLogs,"logged_on","supplement_id");
  const nutritionByDay=nutritionMap(live.nutritionLogs,profile.timezone);
  const todaySession=sessionForDate(live.activePlan,now,profile.timezone);
  const dueSupplementsToday=live.supplements.filter((item)=>isSupplementDue(item,now,Boolean(todaySession)));
  const todayHabitRows=habits;
  const todayCommitments=[
    ...topTasks.map((task)=>({done:Boolean(task.completedAt)})),
    ...todayHabitRows.filter((habit)=>habit.targetFrequency==="daily").map((habit)=>({done:hasValue(habitLogMap,today,habit.id)})),
    ...(todaySession?[{done:planLogMap.has(`${today}:${live.activePlan?.id}:${todaySession.key}`)}]:[]),
    ...dueSupplementsToday.map((item)=>({done:hasValue(supplementLogMap,today,item.id)})),
  ];
  const spendingTarget=spendingTargetStatus(live,now);
  const scoreMovePoints=[
    ...(todaySession&&!planLogMap.has(`${today}:${live.activePlan?.id}:${todaySession.key}`)?[3]:[]),
    ...(topTasks.length&&topTasks.some((task)=>!task.completedAt)?[2]:[]),
    ...(dueSupplementsToday.length&&dueSupplementsToday.some((item)=>!hasValue(supplementLogMap,today,item.id))?[1]:[]),
    ...(spendingTarget===true?[2]:[]),
  ];
  const todayExecution=todayCommitments.length?pct(todayCommitments.filter((x)=>x.done).length,todayCommitments.length):null;
  const days=buildDays({
    start:rangeStart,end:rangeEnd,today,tasks,habits,activePlan:live.activePlan,supplements:live.supplements,
    habitLogMap,planLogMap,supplementLogMap,nutritionByDay,events:live.events,workSchedules:live.workSchedules,
    goalById,topTasks,timezone:profile.timezone,
  });
  const recentConsistency=days.filter(day=>day.date>=localDate(currentStart)&&day.date<=today&&day.performance!==null);
  const consistency=recentConsistency.length?Math.round(recentConsistency.reduce((sum,day)=>sum+(day.performance??0),0)/recentConsistency.length):null;
  const body=healthOverview.score.overall;
  const finance=financeScore(live,now);
  const goalsScore=activeGoals.length?Math.round(activeGoals.reduce((sum,goal)=>sum+goal.progress,0)/activeGoals.length):null;
  const pillars=[
    {key:"Execution",value:todayExecution,weight:30},
    {key:"Consistency",value:consistency,weight:25},
    {key:"Body",value:body,weight:20},
    {key:"Finance",value:finance,weight:10},
    {key:"Goals",value:goalsScore,weight:15},
  ];
  const currentScore=weightedScore(pillars);
  const projectedScore=Math.min(100,currentScore+scoreMovePoints.reduce((sum,points)=>sum+points,0));
  const calibration=Math.round((pillars.filter((pillar)=>pillar.value!=null).length/pillars.length)*100);


  const weeklyDirection=completionDirection(days,today);
  const streak=performanceStreak(days,today);
  const weeklyWins=activityWins(live,tasks,currentStart,now);
  const remainingCount=scoreMovePoints.length;
  const connectedCalendars=calendarSources(live.integrations,live.events);
  const insight=trajectoryInsight(topTasks,todaySession,planLogMap,today,live.activePlan?.id,remainingCount,projectedScore-currentScore);

  return <TrajectoryCommandCenter
    firstName={firstName}
    today={today}
    currentScore={currentScore}
    projectedScore={projectedScore}
    weeklyDirection={weeklyDirection}
    calibration={calibration}
    streak={streak.current}
    bestStreak={streak.best}
    weeklyWins={weeklyWins}
    remainingCount={remainingCount}
    days={days}
    connectedCalendars={connectedCalendars}
    friendCount={live.friendCount}
    activeChallenges={live.activeChallenges}
    activeAlerts={live.activeAlerts}
    insight={insight}
  />;
}

async function getLiveDashboardData(supabase:Awaited<ReturnType<typeof createClient>>,start:Date,end:Date,timezone:string){
  const startDate=localDate(start),endDate=localDate(end),startIso=dateStart(startDate,timezone).toISOString(),endIso=dateStart(shiftDate(endDate,1),timezone).toISOString();
  const monthStart=new Date();monthStart.setDate(1);monthStart.setHours(0,0,0,0);
  const [habitLogs,workouts,activePlanRes,planLogs,supplements,supplementLogs,metrics,accounts,transactions,budgets,nutritionLogs,events,workSchedules,integrations,connections,challenges,alerts]=await Promise.all([
    supabase.from("habit_logs").select("habit_id,logged_at").gte("logged_at",startDate).lte("logged_at",endDate),
    supabase.from("workouts").select("id,performed_at,duration_minutes").gte("performed_at",startIso).lte("performed_at",endIso),
    supabase.from("workout_plans").select("id,title,goal,days_per_week,session_minutes,schedule,schedule_history,created_at").eq("active",true).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("workout_plan_logs").select("plan_id,session_key,completed_on,duration_minutes").eq("status","completed").gte("completed_on",startDate).lte("completed_on",endDate),
    supabase.from("supplements").select("id,name,dosage,timing,frequency,created_at").eq("active",true).order("created_at"),
    supabase.from("supplement_logs").select("supplement_id,logged_on").gte("logged_on",startDate).lte("logged_on",endDate),
    supabase.from("health_metrics").select("metric_type,value,recorded_at").order("recorded_at",{ascending:false}).limit(120),
    supabase.from("finance_accounts").select("id,balance,account_type"),
    supabase.from("transactions").select("amount,occurred_at").gte("occurred_at",monthStart.toISOString()),
    supabase.from("budgets").select("monthly_limit"),
    supabase.from("nutrition_logs").select("calories,protein_g,carbs_g,fat_g,logged_at").gte("logged_at",startIso).lte("logged_at",endIso),
    supabase.from("calendar_events").select("id,title,start_at,end_at,location,source").gte("start_at",startIso).lte("start_at",endIso).order("start_at"),
    supabase.from("work_schedules").select("label,days_of_week,start_time,end_time,active").eq("active",true),
    supabase.from("integrations").select("provider,status"),
    supabase.from("accountability_connections").select("id,status").eq("status","accepted"),
    supabase.from("challenges").select("id",{count:"exact",head:true}).eq("status","active"),
    supabase.from("reminders").select("id",{count:"exact",head:true}).eq("enabled",true),
  ]);
  return {
    habitLogs:habitLogs.data??[],workouts:workouts.data??[],activePlan:(activePlanRes.data as ActivePlan|null)??null,
    planLogs:planLogs.data??[],supplements:(supplements.data??[]) as Supplement[],supplementLogs:supplementLogs.data??[],metrics:metrics.data??[],
    accounts:accounts.data??[],transactions:transactions.data??[],budgets:budgets.data??[],nutritionLogs:nutritionLogs.data??[],events:events.data??[],
    workSchedules:(workSchedules.data??[]) as WorkSchedule[],integrations:integrations.data??[],friendCount:(connections.data??[]).length,
    activeChallenges:challenges.count??0,activeAlerts:alerts.count??0,
  };
}

function buildDays(args:{start:Date;end:Date;today:string;tasks:Task[];habits:Habit[];activePlan:ActivePlan|null;supplements:Supplement[];habitLogMap:Map<string,Set<string>>;planLogMap:Set<string>;supplementLogMap:Map<string,Set<string>>;nutritionByDay:Map<string,{calories:number;protein:number;carbs:number;fat:number;meals:number}>;events:Array<{id:string;title:string;start_at:string;end_at:string;location:string|null;source:string|null}>;workSchedules:WorkSchedule[];goalById:Map<string,Goal>;topTasks:Task[];timezone:string}){
  const days:DashboardDay[]=[];const cursor=new Date(args.start);cursor.setHours(12,0,0,0);const last=new Date(args.end);last.setHours(12,0,0,0);
  while(cursor<=last){
    const key=localDate(cursor);const isToday=key===args.today;const isFuture=key>args.today;
    const taskPool=isToday?uniqueTasks([...args.tasks.filter((task)=>task.dueAt&&userDate(new Date(task.dueAt),args.timezone)===key),...args.topTasks]):args.tasks.filter((task)=>task.dueAt&&userDate(new Date(task.dueAt),args.timezone)===key||task.completedAt&&userDate(new Date(task.completedAt),args.timezone)===key);
    const tasks:DashboardTask[]=uniqueTasks(taskPool).map((task)=>({id:task.id,title:task.title,tier:task.tier,done:Boolean(task.completedAt&&userDate(new Date(task.completedAt),args.timezone)<=key),goalTitle:task.goalId?args.goalById.get(task.goalId)?.title:null,dueAt:task.dueAt,recommended:isToday&&args.topTasks.some((top)=>top.id===task.id)}));
    const habits=args.habits.map((habit)=>({id:habit.id,title:habit.title,done:hasValue(args.habitLogMap,key,habit.id),streakDays:habit.streakDays,goalTitle:habit.goalId?args.goalById.get(habit.goalId)?.title:null,optional:habit.targetFrequency!=="daily"}));
    const session=sessionForDate(args.activePlan,cursor,args.timezone);const workout=session&&args.activePlan?{planId:args.activePlan.id,sessionKey:session.key,title:session.title,focus:session.focus??null,duration:session.duration,done:args.planLogMap.has(`${key}:${args.activePlan.id}:${session.key}`)}:null;
    const supplements=args.supplements.filter((item)=>userDate(new Date(item.created_at),args.timezone)<=key&&isSupplementDue(item,cursor,Boolean(session))).map((item)=>({id:item.id,name:item.name,dosage:item.dosage,timing:item.timing,done:hasValue(args.supplementLogMap,key,item.id)}));
    const events=args.events.filter((event)=>userDate(new Date(event.start_at),args.timezone)===key).map((event)=>({id:event.id,title:event.title,startAt:event.start_at,endAt:event.end_at,source:event.source,location:event.location}));
    const workBlocks=args.workSchedules.filter((schedule)=>schedule.days_of_week.includes(cursor.getDay())).map((schedule)=>({label:schedule.label,start:schedule.start_time,end:schedule.end_time}));
    const expected=[...tasks.map((item)=>item.done),...habits.filter((item)=>!item.optional).map((item)=>item.done),...(workout?[workout.done]:[]),...supplements.map((item)=>item.done)];
    const performance=isFuture?null:expected.length?pct(expected.filter(Boolean).length,expected.length):null;
    days.push({date:key,performance,tasks,habits,workout,supplements,events,nutrition:args.nutritionByDay.get(key)??null,workBlocks});
    cursor.setDate(cursor.getDate()+1);
  }
  return days;
}

function taskPriority(task:Task,activeGoalIds:Set<string>){let score=tierWeight[task.tier];if(task.goalId&&activeGoalIds.has(task.goalId))score+=100;if(task.dueAt){const hours=(new Date(task.dueAt).getTime()-Date.now())/36e5;if(hours<=0)score+=50;else if(hours<=24)score+=32;else if(hours<=72)score+=16}return score}
function uniqueTasks(tasks:Task[]){const map=new Map<string,Task>();for(const task of tasks)map.set(task.id,task);return[...map.values()]}
function sessionForDate(plan:ActivePlan|null,date:Date,timezone:string){return scheduleForDate(plan,localDate(date),timezone).find(session=>session.dayIndex===date.getDay())??null}
function isSupplementDue(item:Supplement,date:Date,hasTraining:boolean){return supplementDue(item.frequency,date.getDay(),hasTraining)}
function weightedScore(pillars:Array<{value:number|null;weight:number}>){const available=pillars.filter((pillar)=>pillar.value!=null) as Array<{value:number;weight:number}>;const total=available.reduce((sum,item)=>sum+item.weight,0);return total?Math.round(available.reduce((sum,item)=>sum+item.value*item.weight,0)/total):0}
function financeScore(live:Awaited<ReturnType<typeof getLiveDashboardData>>,now:Date){const budget=live.budgets.reduce((sum,row)=>sum+Number(row.monthly_limit??0),0);if(!budget)return live.accounts.length?60:null;const spent=Math.abs(live.transactions.filter((row)=>Number(row.amount)<0).reduce((sum,row)=>sum+Number(row.amount),0));const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();const pace=budget*(now.getDate()/daysInMonth);if(pace<=0)return 100;const ratio=spent/pace;return ratio<=1?Math.round(100-Math.max(0,1-ratio)*8):Math.max(0,Math.round(100-(ratio-1)*70))}
function spendingTargetStatus(live:Awaited<ReturnType<typeof getLiveDashboardData>>,now:Date){const budget=live.budgets.reduce((sum,row)=>sum+Number(row.monthly_limit??0),0);if(!budget)return null;const spent=Math.abs(live.transactions.filter((row)=>Number(row.amount)<0).reduce((sum,row)=>sum+Number(row.amount),0));const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();return spent<=budget*(now.getDate()/daysInMonth)}
function activityWins(live:Awaited<ReturnType<typeof getLiveDashboardData>>,tasks:Task[],start:Date,end:Date){const startTime=start.getTime(),endTime=end.getTime();const inRange=(value:string)=>{const time=new Date(value).getTime();return time>=startTime&&time<=endTime};return live.habitLogs.filter((row)=>inRange(`${row.logged_at}T12:00:00`)).length+live.planLogs.filter((row)=>inRange(`${row.completed_on}T12:00:00`)).length+live.supplementLogs.filter((row)=>inRange(`${row.logged_on}T12:00:00`)).length+tasks.filter((task)=>task.completedAt&&inRange(task.completedAt)).length}
function performanceStreak(days:DashboardDay[],today:string){const eligible=days.filter((day)=>day.date<=today&&day.performance!=null).sort((a,b)=>a.date.localeCompare(b.date));let best=0,run=0,previous:string|null=null;for(const day of eligible){if((day.performance??0)>=75){const consecutive=previous&&dayDiff(previous,day.date)===1;run=consecutive?run+1:1;best=Math.max(best,run);previous=day.date}else{run=0;previous=null}}const map=new Map(days.map((day)=>[day.date,day.performance]));let cursor=new Date(`${today}T12:00:00`);if((map.get(today)??0)<75)cursor.setDate(cursor.getDate()-1);let current=0;while((map.get(localDate(cursor))??0)>=75){current++;cursor.setDate(cursor.getDate()-1)}return{current,best}}
function completionDirection(days:DashboardDay[],today:string){const now=new Date(`${today}T12:00:00`);const elapsed=(now.getDay()+6)%7;const averageFor=(offset:number)=>{const values:number[]=[];for(let i=0;i<=elapsed;i++){const date=new Date(now);date.setDate(now.getDate()-elapsed+i+offset);const value=days.find(day=>day.date===localDate(date))?.performance;if(value!=null)values.push(value)}return values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length):null};const current=averageFor(0),previous=averageFor(-7);return current==null||previous==null?0:current-previous}
function dayDiff(a:string,b:string){return Math.round((new Date(`${b}T12:00:00`).getTime()-new Date(`${a}T12:00:00`).getTime())/86400000)}
function multiMap<T extends Record<string,unknown>>(rows:T[],dayKey:keyof T,valueKey:keyof T){const map=new Map<string,Set<string>>();for(const row of rows){const day=String(row[dayKey]);const value=String(row[valueKey]);if(!map.has(day))map.set(day,new Set());map.get(day)!.add(value)}return map}
function hasValue(map:Map<string,Set<string>>,day:string,value:string){return map.get(day)?.has(value)??false}
function nutritionMap(rows:Array<{calories:number;protein_g:number|string;carbs_g:number|string;fat_g:number|string;logged_at:string}>,timezone:string){const map=new Map<string,{calories:number;protein:number;carbs:number;fat:number;meals:number}>();for(const row of rows){const day=userDate(new Date(row.logged_at),timezone);const current=map.get(day)??{calories:0,protein:0,carbs:0,fat:0,meals:0};current.calories+=Number(row.calories||0);current.protein+=Number(row.protein_g||0);current.carbs+=Number(row.carbs_g||0);current.fat+=Number(row.fat_g||0);current.meals+=1;map.set(day,current)}return map}
function calendarSources(integrations:Array<{provider:string;status:string|null}>,events:Array<{source:string|null}>){const set=new Set<string>();for(const item of integrations){if(item.status!=="connected")continue;if(item.provider==="google_calendar")set.add("Google");if(item.provider==="apple_calendar")set.add("Apple")}for(const event of events){const source=(event.source??"").toLowerCase();if(source.includes("google"))set.add("Google");if(source.includes("apple"))set.add("Apple")}return[...set]}
function trajectoryInsight(tasks:Task[],session:PlanSession|null,planLogs:Set<string>,today:string,planId:string|undefined,remaining:number,gain:number){if(!remaining)return"You closed the planned loop for today. Extra work is optional—protect recovery and tomorrow’s capacity.";if(tasks[0])return `Start with “${tasks[0].title}.” It is the highest-leverage open move in today’s plan${gain>0?` and helps unlock the projected +${gain}`:""}.`;if(session&&planId&&!planLogs.has(`${today}:${planId}:${session.key}`))return `${session.title} is today’s biggest remaining physical commitment. Close it before adding more work.`;return"Close the smallest remaining commitment first. Momentum compounds when Project You+ sees promises actually completed."}
function pct(value:number,total:number){return total>0?Math.round((value/total)*100):0}
function localDate(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
