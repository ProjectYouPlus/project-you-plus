import { requireAdmin } from "@/lib/owner/access";
import { getOwnerApprovalCount } from "@/lib/owner/approval-count";
import { OwnerPanel, OwnerSectionShell, EmptyState } from "@/components/owner/owner-section-shell";
import { updateModuleControl } from "@/lib/actions/owner";

export const dynamic = "force-dynamic";

type Module={module_key:string;label:string;description:string|null;enabled:boolean;rollout_percent:number;locked:boolean;updated_at:string};

export default async function OwnerControlsPage(){
  const {supabase,user}=await requireAdmin();
  const [modulesRes,approvalCount]=await Promise.all([
    supabase.from("app_modules").select("module_key,label,description,enabled,rollout_percent,locked,updated_at").order("label"),
    getOwnerApprovalCount(supabase),
  ]);
  const modules=(modulesRes.data??[]) as Module[];
  const displayName=(user.user_metadata?.full_name as string|undefined)||user.email||"Owner";
  return <OwnerSectionShell active="controls" title="Feature Controls" subtitle="Enable, disable, and roll out Project You+ modules without editing code." displayName={displayName} approvalCount={approvalCount}>
    <OwnerPanel title="Product Modules" subtitle="Locked modules cannot be disabled from the dashboard.">
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map((m)=><article key={m.module_key} className="rounded-xl border border-[#26344b] bg-[#0a1320] p-4"><div className="flex items-start justify-between gap-4"><div><div className="text-[12px] font-semibold">{m.label}</div><div className="mt-1 text-[8px] uppercase tracking-[.12em] text-[#71809a]">{m.module_key}</div></div><span className={`rounded-full px-2 py-1 text-[8px] ${m.enabled?"bg-emerald-500/10 text-emerald-300":"bg-white/5 text-[#7f8aa0]"}`}>{m.enabled?"Enabled":"Disabled"}</span></div><p className="mt-3 min-h-[38px] text-[9px] leading-relaxed text-[#9da8bc]">{m.description||"No description configured."}</p><div className="mt-3 flex items-center justify-between text-[9px]"><span className="text-[#8b96aa]">Rollout</span><span>{m.rollout_percent}%</span></div><form action={updateModuleControl} className="mt-2 flex gap-2"><input type="hidden" name="moduleKey" value={m.module_key}/><input type="hidden" name="intent" value="rollout"/><input name="rollout" type="number" min="0" max="100" defaultValue={m.rollout_percent} disabled={m.locked} className="min-w-0 flex-1 rounded-lg border border-[#33415c] bg-[#09111d] px-3 py-2 text-[9px] outline-none disabled:opacity-40"/><button disabled={m.locked} className="rounded-lg border border-[#5f47b7] bg-[#211644] px-3 py-2 text-[9px] disabled:opacity-40">Set</button></form><form action={updateModuleControl} className="mt-2"><input type="hidden" name="moduleKey" value={m.module_key}/><input type="hidden" name="intent" value="toggle"/><button disabled={m.locked} className="w-full rounded-lg border border-[#43536f] bg-[#101a29] px-3 py-2 text-[9px] disabled:opacity-40">{m.locked?"Locked core module":m.enabled?"Disable module":"Enable module"}</button></form><div className="mt-2 text-[8px] text-[#617087]">Updated {new Date(m.updated_at).toLocaleString()}</div></article>)}{modules.length===0?<EmptyState>No product modules are configured.</EmptyState>:null}</div>
    </OwnerPanel>
  </OwnerSectionShell>;
}
