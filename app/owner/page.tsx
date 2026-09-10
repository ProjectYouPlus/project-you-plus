import Link from "next/link";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";
import { requireAdmin } from "@/lib/owner/access";
import { updateBooleanSetting, updateModuleControl } from "@/lib/actions/owner";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

type DirectoryUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  provider: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  onboarding_completed: boolean;
};

type UserMeta = {
  user_id: string;
  access_tier: string;
  last_seen_at: string | null;
  last_path: string | null;
};

type LoginEvent = {
  id: string;
  user_id: string;
  event_type: string;
  occurred_at: string;
  city: string | null;
  region: string | null;
  country: string | null;
  device_family: string | null;
  browser: string | null;
  os: string | null;
};

type ActivityEvent = {
  user_id: string;
  event_name: string;
  path: string | null;
  occurred_at: string;
};

type AppModule = {
  module_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  rollout_percent: number;
  locked: boolean;
};

type AppSetting = {
  setting_key: string;
  label: string;
  description: string | null;
  value: unknown;
};

type AuditEntry = {
  id: number;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
};

export default async function OwnerPage() {
  const { supabase, role } = await requireAdmin();
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY).toISOString();

  const [usersRes, metaRes, loginsRes, activityRes, modulesRes, settingsRes, auditRes] = await Promise.all([
    supabase.from("user_directory").select("user_id,email,full_name,provider,created_at,last_sign_in_at,onboarding_completed").order("created_at", { ascending: false }),
    supabase.from("user_admin_metadata").select("user_id,access_tier,last_seen_at,last_path"),
    supabase.from("login_events").select("id,user_id,event_type,occurred_at,city,region,country,device_family,browser,os").order("occurred_at", { ascending: false }).limit(120),
    supabase.from("activity_events").select("user_id,event_name,path,occurred_at").gte("occurred_at", since7).order("occurred_at", { ascending: false }).limit(3000),
    supabase.from("app_modules").select("module_key,label,description,enabled,rollout_percent,locked").order("label"),
    supabase.from("app_settings").select("setting_key,label,description,value").order("label"),
    supabase.from("admin_audit_log").select("id,action,target_type,target_id,created_at").order("created_at", { ascending: false }).limit(12),
  ]);

  const users = (usersRes.data ?? []) as DirectoryUser[];
  const metadata = (metaRes.data ?? []) as UserMeta[];
  const logins = (loginsRes.data ?? []) as LoginEvent[];
  const activity = (activityRes.data ?? []) as ActivityEvent[];
  const modules = (modulesRes.data ?? []) as AppModule[];
  const settings = (settingsRes.data ?? []) as AppSetting[];
  const audit = (auditRes.data ?? []) as AuditEntry[];

  const metaByUser = new Map(metadata.map((item) => [item.user_id, item]));
  const userById = new Map(users.map((item) => [item.user_id, item]));
  const latestLoginByUser = new Map<string, LoginEvent>();
  for (const event of logins) if (!latestLoginByUser.has(event.user_id)) latestLoginByUser.set(event.user_id, event);

  const total = users.length;
  const active24 = users.filter((user) => isRecent(metaByUser.get(user.user_id)?.last_seen_at, now - DAY)).length;
  const active7 = users.filter((user) => isRecent(metaByUser.get(user.user_id)?.last_seen_at, now - 7 * DAY)).length;
  const new7 = users.filter((user) => new Date(user.created_at).getTime() >= now - 7 * DAY).length;
  const onboarded = users.filter((user) => user.onboarding_completed).length;
  const signins24 = logins.filter((event) => event.event_type === "sign_in" && new Date(event.occurred_at).getTime() >= now - DAY).length;
  const settingMap = new Map(settings.map((setting) => [setting.setting_key, setting]));
  const signupBars = buildSignupBars(users, now);
  const geography = rank(logins.map(locationLabel).filter((value) => value !== "Unknown"));
  const devices = rank(logins.map((event) => event.device_family).filter(Boolean) as string[]);
  const browsers = rank(logins.map((event) => event.browser).filter(Boolean) as string[]);
  const paths = rank(activity.filter((event) => event.event_name === "page_view" && event.path).map((event) => event.path as string));

  return (
    <main className="min-h-screen bg-bg text-text-1">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[460px] bg-[radial-gradient(circle_at_55%_-10%,rgba(139,92,246,.22),transparent_56%)]" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[246px] flex-col border-r border-border bg-[rgba(5,5,9,.94)] px-4 py-6 backdrop-blur-xl lg:flex">
        <ProjectYouLogo className="px-2 text-[16px] font-semibold" markClassName="h-9 w-9" />
        <div className="mt-8 rounded-2xl border border-accent/20 bg-accent-soft p-3.5">
          <div className="text-[9px] font-bold uppercase tracking-[.18em] text-accent-text">Owner access</div>
          <div className="mt-1 text-[14px] font-semibold text-white">Command Center</div>
          <div className="mt-1 text-[11px] capitalize text-text-2">{role}</div>
        </div>
        <nav className="mt-7 space-y-1 text-[13px] font-medium text-text-2">
          <OwnerLink href="#overview" label="Overview" />
          <OwnerLink href="#users" label="Users" />
          <OwnerLink href="#activity" label="Activity" />
          <OwnerLink href="#controls" label="Controls" />
          <OwnerLink href="#security" label="Security" />
        </nav>
        <Link href="/dashboard" className="mt-auto rounded-xl border border-border px-3 py-2.5 text-[12px] font-semibold text-text-2 transition hover:border-accent/30 hover:text-white">← Back to Project You+</Link>
      </aside>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-20 pt-6 sm:px-6 lg:pl-[278px] lg:pr-8 lg:pt-8">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-accent-text">
              <span className="h-2 w-2 rounded-full bg-positive shadow-[0_0_15px_rgba(54,217,139,.75)]" /> Live owner intelligence
            </div>
            <h1 className="text-[34px] font-bold tracking-[-.045em] sm:text-[42px]">Owner Command Center</h1>
            <p className="mt-2 max-w-[680px] text-[13px] leading-relaxed text-text-2">Growth, retention, sign-in intelligence and live product controls for Project You+.</p>
          </div>
          <Link href="/dashboard" className="w-fit rounded-full border border-accent/30 bg-accent-soft px-4 py-2 text-[11px] font-semibold text-accent-text transition hover:bg-accent/20">Open app</Link>
        </header>

        <section id="overview" className="scroll-mt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Metric label="Total users" value={total} detail={`${new7} new / 7d`} tone="violet" />
            <Metric label="Active 24h" value={active24} detail="Seen in app" tone="green" />
            <Metric label="Active 7d" value={active7} detail={`${percent(active7, total)}% active`} tone="blue" />
            <Metric label="Onboarded" value={`${percent(onboarded, total)}%`} detail={`${onboarded} complete`} tone="amber" />
            <Metric label="Sign-ins 24h" value={signins24} detail="Tracked logins" tone="violet" />
            <Metric label="Events 7d" value={activity.length} detail="Product events" tone="blue" />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.9fr_.9fr]">
            <Panel eyebrow="Last 7 days" title="User growth" description="New account creation by day.">
              <div className="mt-6 flex h-[175px] items-end gap-2">
                {signupBars.map((bar) => (
                  <div key={bar.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="text-[10px] font-semibold text-text-2">{bar.count || ""}</div>
                    <div className="flex h-[118px] w-full items-end rounded-xl border border-border bg-bg/50 p-1.5">
                      <div className="w-full rounded-lg bg-[linear-gradient(180deg,rgba(169,112,255,.95),rgba(139,92,246,.22))]" style={{ height: `${Math.max(bar.height, 3)}%` }} />
                    </div>
                    <div className="text-[9px] uppercase tracking-[.08em] text-text-3">{bar.label}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Sign-in geography" title="Where users are" description="Approximate network location, not GPS.">
              <RankedList rows={geography.slice(0, 5)} empty="Location data appears after tracked sign-ins." />
            </Panel>

            <Panel eyebrow="QA priorities" title="Client mix" description="Devices and browsers used to access Project You+.">
              <MiniList title="Device" rows={devices.slice(0, 4)} />
              <div className="my-5 border-t border-border" />
              <MiniList title="Browser" rows={browsers.slice(0, 4)} />
            </Panel>
          </div>
        </section>

        <section id="users" className="mt-9 scroll-mt-5">
          <Heading eyebrow="Audience" title="User directory" description="Every account, activation state, latest session, location and client context." />
          <div className="overflow-hidden rounded-[22px] border border-border bg-surface shadow-[0_20px_70px_rgba(0,0,0,.16)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] border-collapse text-left">
                <thead className="border-b border-border bg-white/[.015] text-[9px] font-bold uppercase tracking-[.12em] text-text-3">
                  <tr><th className="px-5 py-4">User</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Joined</th><th className="px-4 py-4">Last sign-in</th><th className="px-4 py-4">Last seen</th><th className="px-4 py-4">Location</th><th className="px-4 py-4">Client</th><th className="px-4 py-4">Last screen</th></tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const meta = metaByUser.get(user.user_id);
                    const login = latestLoginByUser.get(user.user_id);
                    return (
                      <tr key={user.user_id} className="border-b border-border last:border-0 hover:bg-accent/[.035]">
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/20 bg-accent-soft text-[11px] font-bold text-accent-text">{initials(user.full_name ?? user.email)}</div><div><div className="max-w-[210px] truncate text-[12.5px] font-semibold">{user.full_name || "Unnamed user"}</div><div className="max-w-[230px] truncate text-[10px] text-text-3">{user.email || "No email"}</div></div></div></td>
                        <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${user.onboarding_completed ? "bg-positive-soft text-positive" : "bg-warn-soft text-warn"}`}>{user.onboarding_completed ? "Onboarded" : "Pending"}</span></td>
                        <td className="px-4 py-4 text-[11px] text-text-2">{formatDate(user.created_at)}</td>
                        <td className="px-4 py-4 text-[11px] text-text-2">{relative(user.last_sign_in_at, now)}</td>
                        <td className="px-4 py-4 text-[11px] text-text-2">{relative(meta?.last_seen_at ?? null, now)}</td>
                        <td className="px-4 py-4"><div className="text-[11px]">{login ? locationLabel(login) : "—"}</div><div className="mt-0.5 text-[9px] text-text-3">{login?.country ?? ""}</div></td>
                        <td className="px-4 py-4"><div className="text-[11px]">{[login?.device_family, login?.browser].filter(Boolean).join(" · ") || "—"}</div><div className="mt-0.5 text-[9px] text-text-3">{login?.os ?? user.provider ?? ""}</div></td>
                        <td className="px-4 py-4 font-mono text-[10px] text-text-2">{meta?.last_path ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="activity" className="mt-9 scroll-mt-5">
          <Heading eyebrow="Behavior" title="Product intelligence" description="What users open, where they return, and the newest authentication activity." />
          <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <Panel eyebrow="Last 7 days" title="Top screens" description="Most viewed signed-in routes."><RankedList rows={paths.slice(0, 8)} empty="Page-view data begins after deployment." mono /></Panel>
            <Panel eyebrow="Security feed" title="Recent sign-ins" description="Newest authentication and session activity.">
              <div className="mt-4 divide-y divide-border">
                {logins.slice(0, 10).map((event) => {
                  const user = userById.get(event.user_id);
                  return <div key={event.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><div className="truncate text-[12px] font-semibold">{user?.full_name || user?.email || "User"}</div><div className="mt-1 truncate text-[10px] text-text-3">{event.event_type.replaceAll("_", " ")} · {locationLabel(event)} · {[event.device_family, event.browser].filter(Boolean).join(" / ") || "unknown client"}</div></div><div className="shrink-0 text-[10px] text-text-3">{relative(event.occurred_at, now)}</div></div>;
                })}
                {!logins.length && <Empty text="Tracked sign-ins will appear here after deployment." />}
              </div>
            </Panel>
          </div>
        </section>

        <section id="controls" className="mt-9 scroll-mt-5">
          <Heading eyebrow="Operate" title="Control center" description="Change key product behavior without touching code." />
          <div className="grid gap-4 xl:grid-cols-[.78fr_1.22fr]">
            <Panel eyebrow="Global" title="Quick settings" description="Live product switches backed by Supabase.">
              <div className="mt-4 space-y-2.5">
                {[
                  ["signup_enabled", "New signups"],
                  ["maintenance_mode", "Maintenance mode"],
                  ["onboarding_required", "Require onboarding"],
                  ["analytics_enabled", "Product analytics"],
                  ["location_analytics_enabled", "Location analytics"],
                ].map(([key, fallback]) => {
                  const setting = settingMap.get(key);
                  const enabled = setting?.value === true;
                  return <form action={updateBooleanSetting} key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-bg/55 p-3.5"><input type="hidden" name="settingKey" value={key} /><input type="hidden" name="value" value={String(!enabled)} /><div><div className="text-[12px] font-semibold">{setting?.label ?? fallback}</div><div className="mt-1 max-w-[350px] text-[10px] leading-relaxed text-text-3">{setting?.description ?? "Global product setting"}</div></div><button type="submit" className={`relative h-7 w-12 shrink-0 rounded-full border transition ${enabled ? "border-accent/50 bg-accent" : "border-border bg-surface"}`} aria-label={`Toggle ${fallback}`}><span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[23px]" : "left-[3px]"}`} /></button></form>;
                })}
              </div>
            </Panel>

            <Panel eyebrow="Switchboard" title="Feature modules" description="Turn areas off instantly or stage percentage rollouts. Core dashboard is locked.">
              <div className="mt-4 grid gap-2.5 md:grid-cols-2">
                {modules.map((module) => (
                  <form action={updateModuleControl} key={module.module_key} className="rounded-2xl border border-border bg-bg/55 p-3.5">
                    <input type="hidden" name="moduleKey" value={module.module_key} />
                    <div className="flex items-start justify-between gap-3">
                      <div><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${module.enabled ? "bg-positive" : "bg-text-3"}`} /><div className="text-[12px] font-semibold">{module.label}</div></div><div className="mt-1 min-h-[30px] text-[10px] leading-relaxed text-text-3">{module.description}</div></div>
                      {module.locked ? <span className="rounded-full border border-border px-2 py-1 text-[8px] font-bold uppercase tracking-[.1em] text-text-3">Core</span> : <button type="submit" name="intent" value="toggle" className={`rounded-full px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[.1em] ${module.enabled ? "bg-positive-soft text-positive" : "border border-border text-text-3"}`}>{module.enabled ? "On" : "Off"}</button>}
                    </div>
                    <div className="mt-3 flex items-center gap-2.5 border-t border-border pt-3"><span className="text-[9px] text-text-3">Rollout</span><input name="rollout" type="number" min="0" max="100" defaultValue={module.rollout_percent} disabled={module.locked} className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-[10px] outline-none focus:border-accent disabled:opacity-50" /><span className="text-[9px] text-text-3">%</span>{!module.locked && <button type="submit" name="intent" value="rollout" className="ml-auto rounded-lg border border-border px-2.5 py-1.5 text-[9px] font-semibold text-text-2 transition hover:border-accent/40 hover:text-white">Save</button>}</div>
                  </form>
                ))}
              </div>
            </Panel>
          </div>
        </section>

        <section id="security" className="mt-9 scroll-mt-5">
          <Heading eyebrow="Governance" title="Security & audit" description="Useful owner intelligence with clear privacy boundaries." />
          <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <Panel eyebrow="Privacy" title="Data posture" description="Defaults designed for a premium consumer product.">
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1"><Security title="Approximate location" text="City/region/country come from network headers. No GPS permission is requested." /><Security title="Owner-only auth metadata" text="Sign-in and IP metadata are protected by admin-only row-level security." /><Security title="Sensitive content stays out" text="Raw health, finance and coach conversations are not shown in this command center." /><Security title="Retention target" text="Exact IP retention is set to a 90-day operational target before automated pruning is added." /></div>
            </Panel>
            <Panel eyebrow="Latest changes" title="Admin audit trail" description="Setting and module changes are recorded automatically.">
              <div className="mt-4 divide-y divide-border">{audit.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-4 py-3"><div><div className="text-[11.5px] font-semibold capitalize">{entry.action} · {humanize(entry.target_type)}</div><div className="mt-0.5 font-mono text-[9.5px] text-text-3">{entry.target_id ?? "system"}</div></div><div className="text-[9.5px] text-text-3">{relative(entry.created_at, now)}</div></div>)}{!audit.length && <Empty text="Your first control change will appear here." />}</div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function OwnerLink({ href, label }: { href: string; label: string }) { return <a href={href} className="block rounded-xl px-3 py-2.5 transition hover:bg-accent-soft hover:text-white">{label}</a>; }

function Metric({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone: "violet" | "green" | "blue" | "amber" }) {
  const line = { violet: "bg-accent", green: "bg-positive", blue: "bg-blue-400", amber: "bg-warn" }[tone];
  return <div className="relative overflow-hidden rounded-[20px] border border-border bg-surface p-4 shadow-[0_18px_55px_rgba(0,0,0,.14)]"><div className={`absolute inset-x-0 top-0 h-px ${line}`} /><div className="text-[9px] font-bold uppercase tracking-[.12em] text-text-3">{label}</div><div className="mt-3 text-[27px] font-bold tracking-[-.045em]">{value}</div><div className={`mt-2 text-[10px] ${tone === "green" ? "text-positive" : "text-text-3"}`}>{detail}</div></div>;
}

function Panel({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) { return <div className="rounded-[22px] border border-border bg-surface p-5 shadow-[0_20px_70px_rgba(0,0,0,.14)]"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-accent-text">{eyebrow}</div><div className="mt-1 text-[16px] font-bold tracking-[-.025em]">{title}</div><div className="mt-1 text-[10.5px] leading-relaxed text-text-3">{description}</div>{children}</div>; }

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="mb-4"><div className="text-[9px] font-bold uppercase tracking-[.17em] text-accent-text">{eyebrow}</div><h2 className="mt-1 text-[22px] font-bold tracking-[-.035em]">{title}</h2><p className="mt-1 text-[11px] text-text-3">{description}</p></div>; }

function RankedList({ rows, empty, mono = false }: { rows: Ranked[]; empty: string; mono?: boolean }) { return <div className="mt-5 space-y-3">{rows.length ? rows.map((row, index) => <div key={row.label} className="grid grid-cols-[24px_1fr_auto] items-center gap-3"><div className="text-[9px] font-bold text-text-3">{String(index + 1).padStart(2, "0")}</div><div><div className={`truncate text-[11.5px] ${mono ? "font-mono" : "font-medium"}`}>{row.label}</div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-accent" style={{ width: `${row.width}%` }} /></div></div><div className="text-[10px] tabular-nums text-text-3">{row.count}</div></div>) : <Empty text={empty} />}</div>; }

function MiniList({ title, rows }: { title: string; rows: Ranked[] }) { return <div className="mt-4"><div className="mb-3 text-[9px] font-bold uppercase tracking-[.12em] text-text-3">{title}</div><div className="space-y-2.5">{rows.length ? rows.map((row) => <div key={row.label} className="flex justify-between gap-3 text-[10.5px]"><span className="truncate text-text-2">{row.label}</span><span className="tabular-nums text-text-3">{row.percent}%</span></div>) : <span className="text-[10px] text-text-3">Waiting for sessions.</span>}</div></div>; }

function Security({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-border bg-bg/55 p-3.5"><div className="flex items-center gap-2 text-[11.5px] font-semibold"><span className="h-2 w-2 rounded-full bg-positive" />{title}</div><div className="mt-1.5 text-[10px] leading-relaxed text-text-3">{text}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-border bg-bg/40 px-4 py-6 text-center text-[10.5px] leading-relaxed text-text-3">{text}</div>; }

type Ranked = { label: string; count: number; percent: number; width: number };
function rank(values: string[]): Ranked[] { const counts = new Map<string, number>(); for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1); const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]); const total = ordered.reduce((sum, item) => sum + item[1], 0) || 1; const max = ordered[0]?.[1] ?? 1; return ordered.map(([label, count]) => ({ label, count, percent: Math.round((count / total) * 100), width: Math.max(8, Math.round((count / max) * 100)) })); }

function buildSignupBars(users: DirectoryUser[], now: number) { const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(now - (6 - index) * DAY); return { key: dateKey(date), label: date.toLocaleDateString("en-US", { weekday: "short" }), count: 0, height: 0 }; }); const byKey = new Map(days.map((day) => [day.key, day])); for (const user of users) { const item = byKey.get(dateKey(new Date(user.created_at))); if (item) item.count += 1; } const max = Math.max(1, ...days.map((day) => day.count)); return days.map((day) => ({ ...day, height: Math.round((day.count / max) * 100) })); }
function locationLabel(event: LoginEvent) { return [event.city, event.region].filter(Boolean).join(", ") || event.country || "Unknown"; }
function initials(value: string | null) { if (!value) return "?"; return value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"; }
function formatDate(value: string) { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function relative(value: string | null, now: number) { if (!value) return "—"; const diff = Math.max(0, now - new Date(value).getTime()); if (diff < 60_000) return "Just now"; if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`; if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h ago`; if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`; return formatDate(value); }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function isRecent(value: string | null | undefined, cutoff: number) { return Boolean(value && new Date(value).getTime() >= cutoff); }
function percent(value: number, total: number) { return total ? Math.round((value / total) * 100) : 0; }
function humanize(value: string) { return value.replaceAll("_", " "); }
