import { createClient } from "@/lib/supabase/server";
import { addSupplement, logSupplementToday, setSupplementActive } from "@/lib/actions/supplements";

export default async function SupplementsPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: supplements }, { data: logs }] = await Promise.all([
    supabase.from("supplements").select("id,name,dosage,timing,frequency,notes,active").order("created_at"),
    supabase.from("supplement_logs").select("supplement_id,logged_on").eq("logged_on", today),
  ]);
  const rows = supplements ?? [];
  const logged = new Set((logs ?? []).map((row) => row.supplement_id));
  const active = rows.filter((row) => row.active);

  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="py-animate-in mb-7"><div className="py-eyebrow text-accent-text">Health protocol</div><h1 className="py-title">Supplements</h1><p className="py-subtitle">Keep your daily protocol organized and visible on Dashboard. Project You+ tracks what you choose; it does not prescribe medications or replace professional medical guidance.</p></header>
    <section className="py-glass-hero py-animate-in py-stagger-1 p-5"><div className="flex items-start justify-between gap-4"><div><div className="py-eyebrow text-[#C8AEFF]">Today</div><div className="mt-2 text-[35px] font-bold tracking-[-.05em] text-white">{active.filter((item)=>logged.has(item.id)).length}/{active.length}</div><p className="m-0 mt-1 text-[12px] text-[#C2BED0]">scheduled supplements logged</p></div><span className="py-glass-pill text-[#C8AEFF]">Protocol</span></div></section>
    <section className="py-animate-in py-stagger-2 mt-5"><div className="mb-3"><div className="py-eyebrow">Schedule</div><h2 className="m-0 mt-1 text-[22px] font-semibold tracking-[-.03em] text-text-1">What you take</h2></div>{active.length ? <div className="py-glass-soft divide-y divide-white/[.06] px-4">{active.map((item)=>{const done=logged.has(item.id);const logAction=logSupplementToday.bind(null,item.id);const offAction=setSupplementActive.bind(null,item.id,false);return <div key={item.id} className="flex items-center gap-3 py-4"><form action={logAction}><button disabled={done} className={`py-check ${done?"py-check-done":""}`}>{done?"✓":""}</button></form><div className="min-w-0 flex-1"><div className={`text-[14px] font-semibold ${done?"text-text-3 line-through":"text-text-1"}`}>{item.name}</div><div className="mt-0.5 text-[11px] capitalize text-text-3">{item.dosage||"Dose not set"} · {item.timing} · {item.frequency.replaceAll("_"," ")}</div></div><form action={offAction}><button className="text-[10.5px] font-semibold text-text-3">Pause</button></form></div>})}</div> : <div className="py-glass-soft p-4 text-[12.5px] text-text-2">No supplements added yet. Add only what is already part of your chosen routine.</div>}</section>
    <form action={addSupplement} className="py-glass-soft py-animate-in py-stagger-3 mt-6 p-4"><div className="py-eyebrow text-accent-text">Add to protocol</div><div className="mt-3 space-y-2.5"><input name="name" required className="py-input" placeholder="Supplement name"/><input name="dosage" className="py-input" placeholder="Dose, e.g. 5 g or 2 capsules"/><div className="grid grid-cols-2 gap-2.5"><select name="timing" defaultValue="morning" className="py-input text-[12px]"><option value="morning">Morning</option><option value="with_food">With food</option><option value="pre_workout">Pre-workout</option><option value="post_workout">Post-workout</option><option value="evening">Evening</option></select><select name="frequency" defaultValue="daily" className="py-input text-[12px]"><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="training_days">Training days</option><option value="as_needed">As needed</option></select></div><input name="notes" className="py-input" placeholder="Optional note"/></div><button className="py-liquid-button mt-3 w-full">Add supplement</button></form>
  </main>;
}
