import { addReminder, deleteReminder, setReminderEnabled } from "@/lib/actions/reminders";
import { getHabits } from "@/lib/data/habits";
import { getTasks } from "@/lib/data/tasks";
import { createClient } from "@/lib/supabase/server";

export default async function RemindersPage() {
  const [tasks, habits] = await Promise.all([getTasks(), getHabits()]);
  const supabase = await createClient();
  const { data: reminders } = await supabase.from("reminders").select("id,target_type,target_id,title,remind_at,time_of_day,recurrence,enabled").order("created_at", { ascending: false });
  const openTasks = tasks.filter((task) => !task.completedAt);

  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="mb-7"><h1 className="py-title">Alerts</h1><p className="py-subtitle">Attach reminders to the actions and habits that matter. Push notifications will build on this same schedule layer.</p></header>

    <form action={addReminder} className="py-glass-soft p-4">
      <h2 className="m-0 text-[18px] font-semibold text-text-1">New alert</h2>
      <div className="mt-4 space-y-2.5">
        <select name="target" className="py-input text-[12px]" defaultValue="custom:">
          <option value="custom:">Custom reminder</option>
          {openTasks.length > 0 && <optgroup label="Tasks">{openTasks.map((task) => <option key={task.id} value={`task:${task.id}`}>{task.title}</option>)}</optgroup>}
          {habits.length > 0 && <optgroup label="Habits">{habits.map((habit) => <option key={habit.id} value={`habit:${habit.id}`}>{habit.title}</option>)}</optgroup>}
        </select>
        <input name="title" required className="py-input" placeholder="Reminder, e.g. Finish proposal" />
        <select name="recurrence" className="py-input text-[12px]" defaultValue="once"><option value="once">One time</option><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option></select>
        <div className="grid grid-cols-2 gap-2.5"><label className="text-[10px] text-text-3">One-time date<input name="remindAt" type="datetime-local" className="py-input mt-1 min-h-[44px] py-2 text-[12px]" /></label><label className="text-[10px] text-text-3">Repeat time<input name="timeOfDay" type="time" className="py-input mt-1 min-h-[44px] py-2 text-[12px]" /></label></div>
      </div>
      <button className="py-liquid-button mt-3 w-full">Create alert</button>
      <p className="m-0 mt-2 text-[10px] leading-relaxed text-text-3">For a one-time alert, choose a date. For repeating alerts, choose a repeat setting and time.</p>
    </form>

    <section className="mt-7"><h2 className="m-0 mb-3 text-[20px] font-semibold tracking-[-.025em] text-text-1">Your alerts</h2>{(reminders ?? []).length ? <div className="py-glass-soft divide-y divide-white/[.06] px-4">{(reminders ?? []).map((reminder) => <div key={reminder.id} className="flex items-center gap-3 py-4"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${reminder.enabled ? "bg-accent-2" : "bg-text-3"}`} /><div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold text-text-1">{reminder.title}</div><div className="mt-0.5 text-[10.5px] capitalize text-text-3">{reminder.target_type} · {formatReminder(reminder)}</div></div><form action={setReminderEnabled.bind(null, reminder.id, !reminder.enabled)}><button className="text-[10.5px] font-semibold text-text-2">{reminder.enabled ? "Pause" : "Resume"}</button></form><form action={deleteReminder.bind(null, reminder.id)}><button className="text-[10.5px] font-semibold text-text-3">Delete</button></form></div>)}</div> : <div className="py-glass-soft p-4 text-[12px] leading-relaxed text-text-3">No alerts yet. Start with one task deadline or one habit you want to protect.</div>}</section>
  </main>;
}

function formatReminder(reminder: { remind_at: string | null; time_of_day: string | null; recurrence: string }) {
  if (reminder.recurrence === "once" && reminder.remind_at) return new Date(reminder.remind_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (reminder.time_of_day) return `${reminder.recurrence.replaceAll("_", " ")} at ${new Date(`2000-01-01T${reminder.time_of_day}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return reminder.recurrence;
}
