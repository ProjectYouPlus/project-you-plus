import { CoachViewport } from "@/components/coach/coach-viewport";
import { CoachChat } from "@/components/coach/coach-chat";
import { getGoals } from "@/lib/data/goals";
import { getTasks } from "@/lib/data/tasks";
import { getHabits } from "@/lib/data/habits";
import { getRecentCoachMessages } from "@/lib/coach/conversation";

export default async function CoachPage() {
  const [goals,tasks,habits,conversation]=await Promise.all([getGoals(),getTasks(),getHabits(),getRecentCoachMessages().catch(()=>[])]);
  const activeGoals=goals.filter(g=>g.status==="active");
  const openTasks=tasks.filter(t=>!t.completedAt);
  const linkedTasks=openTasks.filter(t=>t.goalId).length;
  const linkedHabits=habits.filter(h=>h.goalId).length;
  const contextReady=activeGoals.length+tasks.length+habits.length>0;
  const signal=!activeGoals.length?"Start with one real goal. Without a destination, coaching can only be generic.":!openTasks.length?`Your clearest move is to give “${activeGoals[0].title}” one concrete next action.`:linkedTasks<openTasks.length?`${openTasks.length-linkedTasks} open action${openTasks.length-linkedTasks===1?" is":"s are"} not linked to a goal. Clean that up before adding more work.`:habits.length>0&&linkedHabits===0?"Your tasks have direction, but your habits do not yet support a goal. Link one repeatable behavior to an outcome.":`Your system has ${activeGoals.length} active goal${activeGoals.length===1?"":"s"}, ${openTasks.length} open action${openTasks.length===1?"":"s"}, and ${habits.length} habit${habits.length===1?"":"s"}. Ask me where the leverage is.`;
  const summary=contextReady?`${activeGoals.length} active goal${activeGoals.length===1?"":"s"}, ${openTasks.length} open action${openTasks.length===1?"":"s"}, ${habits.length} habit${habits.length===1?"":"s"}.`:"Your account is still mostly empty. I’ll help you build the system before pretending there is enough data to analyze.";
  const prompts=[openTasks.length?"What should I focus on today?":null,activeGoals.length?"What is keeping me from reaching my goals?":null,"Plan tomorrow.","What changed this week?"].filter((item):item is string=>Boolean(item)).slice(0,4);
  return <CoachViewport><main className="mx-auto flex h-full w-full max-w-[720px] min-h-0 flex-col px-3 pt-3 md:block md:h-auto md:py-shell-narrow">
    <header className="mb-3 shrink-0 px-1 md:mb-6"><div className="py-eyebrow mb-1.5 hidden text-accent-text md:block">Your personal chief of staff</div><h1 className="text-2xl font-semibold tracking-tight md:py-title">Coach</h1><p className="py-subtitle hidden max-w-[620px] md:block">Decide what matters, turn goals into a plan, and learn from the patterns in your real Project You+ context.</p></header>
    <details className="mb-3 shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs text-text-2 md:hidden group-data-[keyboard=true]:hidden"><summary className="cursor-pointer">Your context</summary><p className="mb-1 mt-2 leading-relaxed">{signal}</p></details><section className="py-glass-hero py-animate-in py-stagger-1 mb-4 hidden p-5 md:block"><div className="flex items-start gap-3"><span className="py-pulse-dot mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-2"/><div><div className="py-eyebrow text-[#C8AEFF]">Coach signal</div><p className="m-0 mt-2 text-[14px] font-medium leading-relaxed text-white">{signal}</p></div></div></section>
    <section className="py-glass-soft min-h-0 flex-1 overflow-hidden"><CoachChat contextSummary={summary} contextReady={contextReady} initialMessages={conversation.map(item=>({id:item.id,role:item.role,content:item.content}))} initialPrompts={prompts}/></section>
  </main></CoachViewport>
}
