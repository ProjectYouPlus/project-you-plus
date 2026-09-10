import Link from "next/link";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";
import { requireAdmin } from "@/lib/owner/access";
import { updateBooleanSetting, updateModuleControl } from "@/lib/actions/owner";

export const dynamic = "force-dynamic";

type DirectoryUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  provider: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  onboarding_completed: boolean;
};

type UserMeta = {
  user_id: string;
  access_tier: string;
  cohort: string | null;
  tags: string[] | null;
  last_seen_at: string | null;
  last_path: string | null;
};

type LoginEvent = {
  id: string;
  user_id: string;
  event_type: string;
  auth_method: string | null;
  occurred_at: string;
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
  device_family: string | null;
  browser: string | null;
  os: string | null;
  path: string | null;
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
  updated_at: string;
};

type AppSetting = {
  setting_key: string;
  label: string;
  description: string | null;
  category: string;
  value: unknown;
  public_readable: boolean;
  updated_at: string;
};

type AuditEntry = {
  id: number;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
};

const DAY = 86_400_000;

export default async function OwnerPage() {
  const { supabase, role } = await requireAdmin();
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY).toISOString();

  const [directoryRes, metaRes, loginRes, activityRes, modulesRes, settingsRes, auditRes] =
    await Promise.all([
      supabase
        .from("user_directory")
        .select("user_id,email,full_name,provider,created_at,last_sign_in_at,email_confirmed_at,onboarding_completed")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_admin_metadata")
        .select("user_id,access_tier,cohort,tags,last_seen_at,last_path"),
      supabase
        .from("login_events")
        .select("id,user_id,event_type,auth_method,occurred_at,city,region,country,timezone,device_family,browser,os,path")
        .order("occurred_at", { ascending: false })
        .limit(80),
      supabase
        .from("activity_events")
        .select("user_id,event_name,path,occurred_at")
        .gte("occurred_at", since7)
        .order("occurred_at", { ascending: false })
        .limit(2500),
      supabase
        .from("app_modules")
        .select("module_key,label,description,enabled,rollout_percent,locked,updated_at")
        .order("label"),
      supabase
        .from("app_settings")
        .select("setting_key,label,description,category,value,public_readable,updated_at")
        .order("category")
        .order("label"),
      supabase
        .from("admin_audit_log")
        .select("id,action,target_type,target_id,created_at")
        .order("created_at", { ascending: false })
        .limit(14),
    ]);

  const users = (directoryRes.data ?? []) as DirectoryUser[];
  const userMeta = (metaRes.data ?? []) as UserMeta[];
  const logins = (loginRes.data ?? []) as LoginEvent[];
  const activity = (activityRes.data ?? []) as ActivityEvent[];
  const modules = (modulesRes.data ?? []) as AppModule[];
  const settings = (settingsRes.data ?? []) as AppSetting[];
  const audit = (auditRes.data ?? []) as AuditEntry[];

  const metaByUser = new Map(userMeta.map((row) => [row.user_id, row]));
  const latestLoginByUser = new Map<string, LoginEvent>();
  for (const login of logins) {
    if (!latestLoginByUser.has(login.user_id)) latestLoginByUser.set(login.user_id, login);
  }

  const totalUsers = users.length;
  const active24h = users.filter((user) => isRecent(metaByUser.get(user.user_id)?.last_seen_at, now - DAY)).length;
  const active7d = users.filter((user) => isRecent(metaByUser.get(user.user_id)?.last_seen_at, now - 7 * DAY)).length;
  const new7d = users.filter((user) => new Date(user.created_at).getTime() >= now - 7 * DAY).length;
  const onboarded = users.filter((user) => user.onboarding_completed).length;
  const signIns24h = logins.filter((row) => row.event_type === "sign_in" && new Date(row.occurred_at).getTime() >= now - DAY).length;
  const onboardingRate = totalUsers ? Math.round((onboarded / totalUsers) * 100) : 0;
  const activeRate = totalUsers ? Math.round((active7d / totalUsers) * 100) : 0;
  const signupBars = buildSignupBars(users, now);
  const geography = topGeography(logins);
  const topPaths = topActivityPaths(activity);
  const browserMix = topDimension(logins.map((row) => row.browser));
  const deviceMix = topDimension(logins.map((row) => row.device_family));
  const settingMap = new Map(settings.map((setting) => [setting.setting_key, setting]));

  return (
    <main className="min-h-screen bg-bg text-text-1">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_50%_-20%,rgba(139,92,246,.22),transparent_55%)]" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[244px] border-r border-border bg-[rgba(5,5,9,.92)] px-4 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        <ProjectYouLogo className="px-2 text-[16px] font-semibold" markClassName="h-9 w-9" />
        <div className="mt-8 rounded-2xl border border-accent/20 bg-accent-soft p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-accent-text">Owner access</div>
          <div className="mt-1 text-[14px] font-semibold text-white">Command Center</div>
          <div className="mt-1 text-[12px] capitalize text-text-2">Role: {role}</div>
        </div>

        <nav className="mt-7 space-y-1 text-[13.5px] text-text-2">
          <OwnerNavLink href="#overview" label="Overview" icon="pulse" />
          <OwnerNavLink href="#users" label="Users" icon="users" />
          <OwnerNavLink href="#activity" label="Activity" icon="activity" />
          <OwnerNavLink href="#controls" label="Controls" icon="switch" />
          <OwnerNavLink href="#security" label="Security" icon="shield" />
        </nav>

        <div className="mt-auto border-t border-border pt-4">
          <Link href="/dashboard" className="flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-text-2 transition hover:bg-surface hover:text-text-1">
            <OwnerIcon name="back" />
            Back to Project You+
          </Link>
        </div>
      </aside>

      <div className="relative mx-auto w-full max-w-[1680px] px-4 pb-20 pt-5 sm:px-6 lg:pl-[276px] lg:pr-8 lg:pt-8">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-accent-text">
              <span className="h-2 w-2 rounded-full bg-positive shadow-[0_0_16px_rgba(54,217,139,.85)]" />
              Live owner intelligence
            </div>
            <h1 className="m-0 text-[34px] font-bold tracking-[-0.045em] sm:text-[42px]">Owner Command Center</h1>
            <p className="mt-2 max-w-[700px] text-[14px] leading-relaxed text-text-2">
              Growth, engagement, sign-in intelligence and product controls for Project You+.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-border bg-surface px-3 py-2 text-[12px] text-text-2">Updated live on refresh</div>
            <Link href="/dashboard" className="rounded-full border border-accent/30 bg-accent-soft px-4 py-2 text-[12px] font-semibold text-accent-text transition hover:bg-accent/20">Open app</Link>
          </div>
        </header>

        <section id="overview" className="scroll-mt-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Total users" value={String(totalUsers)} detail={`${new7d} new in 7 days`} accent="violet" />
            <MetricCard label="Active 24h" value={String(active24h)} detail="Seen in the product" accent="green" />
            <MetricCard label="Active 7d" value={String(active7d)} detail={`${activeRate}% of users`} accent="blue" />
            <MetricCard label="Onboarded" value={`${onboardingRate}%`} detail={`${onboarded} completed`} accent="amber" />
            <MetricCard label="Sign-ins 24h" value={String(signIns24h)} detail="Password logins" accent="violet" />
            <MetricCard label="Events 7d" value={String(activity.length)} detail="Page + session events" accent="blue" />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.85fr_.8fr]">
            <Panel title="User growth" eyebrow="Last 7 days" description="New account creation by day.">
              <div className="mt-6 flex h-[190px] items-end gap-2">
                {signupBars.map((bar) => (
                  <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="text-[11px] font-semibold text-text-2">{bar.count || ""}</div>
                    <div className="flex h-[132px] w-full items-end rounded-xl border border-border bg-[rgba(255,255,255,.018)] p-1.5">
                      <div
                        className="w-full rounded-lg bg-[linear-gradient(180deg,rgba(169,112,255,.95),rgba(139,92,246,.24))] shadow-[0_0_26px_rgba(139,92,246,.16)]"
                        style={{ height: `${Math.max(bar.percent, bar.count ? 12 : 3)}%` }}
                      />
                    </div>
                    <div className="truncate text-[10px] uppercase tracking-[.08em] text-text-3">{bar.label}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Where users are" eyebrow="Sign-in geography" description="Approximate network location, not GPS.">
              <div className="mt-5 space-y-3">
                {geography.length ? geography.map((row, index) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-bg text-[11px] font-bold text-text-2">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-text-1">{row.label}</div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                    <div className="text-[12px] tabular-nums text-text-2">{row.count}</div>
                  </div>
                )) : <EmptyState text="Location data will appear after the next tracked sign-in." />}
              </div>
            </Panel>

            <Panel title="Client mix" eyebrow="Devices" description="Useful for prioritizing QA and app polish.">
              <DimensionBlock label="Device" rows={deviceMix} />
              <div className="my-5 border-t border-border" />
              <DimensionBlock label="Browser" rows={browserMix} />
            </Panel>
          </div>
        </section>

        <section id="users" className="mt-8 scroll-mt-6">
          <SectionHeading eyebrow="Audience" title="User directory" description="Every Project You+ account, activation state, latest session and sign-in context." />
          <div className="overflow-hidden rounded-[22px] border border-border bg-surface shadow-[0_20px_70px_rgba(0,0,0,.18)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-[rgba(255,255,255,.015)] text-[10px] font-bold uppercase tracking-[.12em] text-text-3">
                    <th className="px-5 py-4">User</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Joined</th>
                    <th className="px-4 py-4">Last sign-in</th>
                    <th className="px-4 py-4">Last seen</th>
                    <th className="px-4 py-4">Location</th>
                    <th className="px-4 py-4">Client</th>
                    <th className="px-4 py-4">Last screen</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const meta = metaByUser.get(user.user_id);
                    const login = latestLoginByUser.get(user.user_id);
                    return (
                      <tr key={user.user_id} className="border-b border-border/70 last:border-b-0 hover:bg-[rgba(139,92,246,.035)]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent-soft text-[12px] font-bold text-accent-text">{initials(user.full_name ?? user.email)}</div>
                            <div className="min-w-0">
                              <div className="max-w-[220px] truncate text-[13px] font-semibold text-text-1">{user.full_name || "Unnamed user"}</div>
                              <div className="max-w-[240px] truncate text-[11px] text-text-3">{user.email || "No email"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill positive={user.onboarding_completed} label={user.onboarding_completed ? "Onboarded" : "Pending"} />
                        </td>
                        <td className="px-4 py-4 text-[12px] text-text-2">{formatDate(user.created_at)}</td>
                        <td className="px-4 py-4 text-[12px] text-text-2">{relativeTime(user.last_sign_in_at, now)}</td>
                        <td className="px-4 py-4 text-[12px] text-text-2">{relativeTime(meta?.last_seen_at ?? null, now)}</td>
                        <td className="px-4 py-4">
                          <div className="text-[12px] text-text-1">{locationLabel(login)}</div>
                          <div className="mt-0.5 text-[10px] text-text-3">{login?.country ?? ""}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-[12px] text-text-1">{[login?.device_family, login?.browser].filter(Boolean).join(" · ") || "—"}</div>
                          <div className="mt-0.5 text-[10px] text-text-3">{login?.os ?? user.provider ?? ""}</div>
                        </td>
                        <td className="px-4 py-4 font-mono text-[11px] text-text-2">{meta?.last_path ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="activity" className="mt-8 scroll-mt-6">
          <SectionHeading eyebrow="Behavior" title="Product intelligence" description="See what users actually open and where sessions are coming from." />
          <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <Panel title="Top screens" eyebrow="Last 7 days" description="Most viewed signed-in routes.">
              <div className="mt-5 space-y-3">
                {topPaths.length ? topPaths.map((row, index) => (
                  <div key={row.path} className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
                    <div className="text-[11px] font-semibold text-text-3">{String(index + 1).padStart(2, "0")}</div>
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="truncate font-mono text-[12px] text-text-1">{row.path}</div>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                    <div className="text-[12px] tabular-nums text-text-2">{row.count}</div>
                  </div>
                )) : <EmptyState text="Page-view data begins collecting after this version is deployed." />}
              </div>
            </Panel>

            <Panel title="Recent sign-ins" eyebrow="Security feed" description="Newest authentication and session activity.">
              <div className="mt-4 divide-y divide-border">
                {logins.slice(0, 10).map((login) => {
                  const user = users.find((row) => row.user_id === login.user_id);
                  return (
                    <div key={login.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-bg"><OwnerIcon name="shield" /></div>
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-semibold text-text-1">{user?.full_name || user?.email || "User"}</div>
                          <div className="mt-0.5 truncate text-[11px] text-text-3">
                            {login.event_type.replaceAll("_", " ")} · {locationLabel(login)} · {[login.device_family, login.browser].filter(Boolean).join(" / ") || "unknown client"}
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-text-3">{relativeTime(login.occurred_at, now)}</div>
                    </div>
                  );
                })}
                {!logins.length && <EmptyState text="No tracked sign-ins yet. Existing Supabase last-sign-in timestamps still appear in the user table." />}
              </div>
            </Panel>
          </div>
        </section>

        <section id="controls" className="mt-8 scroll-mt-6">
          <SectionHeading eyebrow="Operate" title="Control center" description="Change important product behavior without editing code or redeploying." />
          <div className="grid gap-4 xl:grid-cols-[.78fr_1.22fr]">
            <Panel title="Quick settings" eyebrow="Global" description="These switches are live configuration values.">
              <div className="mt-4 space-y-2.5">
                {[
                  ["signup_enabled", "New signups"],
                  ["maintenance_mode", "Maintenance mode"],
                  ["onboarding_required", "Require onboarding"],
                  ["analytics_enabled", "Product analytics"],
                  ["location_analytics_enabled", "Location analytics"],
                ].map(([key, fallbackLabel]) => {
                  const setting = settingMap.get(key);
                  const enabled = setting?.value === true;
                  return (
                    <form action={updateBooleanSetting} key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-bg/60 p-3.5">
                      <input type="hidden" name="settingKey" value={key} />
                      <input type="hidden" name="value" value={String(!enabled)} />
                      <div>
                        <div className="text-[12.5px] font-semibold text-text-1">{setting?.label ?? fallbackLabel}</div>
                        <div className="mt-1 max-w-[360px] text-[10.5px] leading-relaxed text-text-3">{setting?.description ?? "Global product setting"}</div>
                      </div>
                      <button type="submit" className={`relative h-7 w-12 shrink-0 rounded-full border transition ${enabled ? "border-accent/50 bg-accent" : "border-border bg-surface"}`} aria-label={`Toggle ${fallbackLabel}`}>
                        <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[23px]" : "left-[3px]"}`} />
                      </button>
                    </form>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Feature modules" eyebrow="Switchboard" description="Turn areas on/off or stage a percentage rollout. Core Today is locked for safety.">
              <div className="mt-4 grid gap-2.5 md:grid-cols-2">
                {modules.map((module) => (
                  <form action={updateModuleControl} key={module.module_key} className="rounded-2xl border border-border bg-bg/55 p-3.5">
                    <input type="hidden" name="moduleKey" value={module.module_key} />
                    <input type="hidden" name="enabled" value={String(module.locked ? true : !module.enabled)} />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${module.enabled ? "bg-positive" : "bg-text-3"}`} />
                          <div className="text-[12.5px] font-semibold text-text-1">{module.label}</div>
                        </div>
                        <div className="mt-1 min-h-[32px] text-[10.5px] leading-relaxed text-text-3">{module.description}</div>
                      </div>
                      {module.locked ? (
                        <span className="rounded-full border border-border px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-text-3">Core</span>
                      ) : (
                        <button type="submit" className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] transition ${module.enabled ? "bg-positive-soft text-positive" : "border border-border text-text-3"}`}>
                          {module.enabled ? "On" : "Off"}
                        </button>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
                      <span className="text-[10px] text-text-3">Rollout</span>
                      <input name="rollout" type="number" min="0" max="100" defaultValue={module.rollout_percent} disabled={module.locked} className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-[11px] text-text-1 outline-none focus:border-accent disabled:opacity-50" />
                      <span className="text-[10px] text-text-3">%</span>
                      {!module.locked && <button type="submit" className="ml-auto rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold text-text-2 transition hover:border-accent/40 hover:text-text-1">Save</button>}
                    </div>
                  </form>
                ))}
              </div>
            </Panel>
          </div>
        </section>

        <section id="security" className="mt-8 scroll-mt-6">
          <SectionHeading eyebrow="Governance" title="Security & audit" description="Owner actions are recorded, and sensitive credentials never enter the browser." />
          <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <Panel title="Privacy posture" eyebrow="Recommended defaults" description="Designed to give you useful business intelligence without exposing private user content.">
              <div className="mt-5 space-y-3">
                <SecurityItem title="Approximate location only" text="City, region and country come from network headers. Project You+ does not request device GPS for owner analytics." />
                <SecurityItem title="Owner-only sign-in data" text="IP and sign-in metadata are protected by admin row-level security and are not readable by normal users." />
                <SecurityItem title="No raw health / finance / coach content" text="The command center measures adoption and engagement instead of centralizing sensitive personal content." />
                <SecurityItem title="90-day IP retention target" text="The data model stores the target now; automated pruning can be added before public launch." />
              </div>
            </Panel>

            <Panel title="Admin audit trail" eyebrow="Latest changes" description="Feature and setting mutations are recorded automatically.">
              <div className="mt-4 divide-y divide-border">
                {audit.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <div className="text-[12px] font-semibold capitalize text-text-1">{entry.action} · {humanize(entry.target_type)}</div>
                      <div className="mt-0.5 font-mono text-[10.5px] text-text-3">{entry.target_id ?? "system"}</div>
                    </div>
                    <div className="text-[10.5px] text-text-3">{relativeTime(entry.created_at, now)}</div>
                  </div>
                ))}
                {!audit.length && <EmptyState text="Your first setting or module change will appear here." />}
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: "violet" | "green" | "blue" | "amber" }) {
  const accents = {
    violet: "from-accent/20 to-transparent text-accent-text",
    green: "from-positive/15 to-transparent text-positive",
    blue: "from-blue-500/15 to-transparent text-blue-300",
    amber: "from-warn/15 to-transparent text-warn",
  } as const;
  return (
    <div className={`relative overflow-hidden rounded-[20px] border border-border bg-surface p-4 shadow-[0_18px_55px_rgba(0,0,0,.16)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:${accents[accent]}`}>
      <div className="text-[10px] font-bold uppercase tracking-[.12em] text-text-3">{label}</div>
      <div className="mt-3 text-[28px] font-bold tracking-[-.045em] text-text-1">{value}</div>
      <div className={`mt-2 text-[10.5px] ${accent === "green" ? "text-positive" : "text-text-3"}`}>{detail}</div>
    </div>
  );
}

function Panel({ title, eyebrow, description, children }: { title: string; eyebrow: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-border bg-surface p-5 shadow-[0_20px_70px_rgba(0,0,0,.16)]">
      <div className="text-[9.5px] font-bold uppercase tracking-[.16em] text-accent-text">{eyebrow}</div>
      <div className="mt-1 text-[17px] font-bold tracking-[-.025em] text-text-1">{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-text-3">{description}</div>
      {children}
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-4">
      <div className="text-[9.5px] font-bold uppercase tracking-[.17em] text-accent-text">{eyebrow}</div>
      <h2 className="mt-1 text-[23px] font-bold tracking-[-.035em] text-text-1">{title}</h2>
      <p className="mt-1 text-[12px] text-text-3">{description}</p>
    </div>
  );
}

function OwnerNavLink({ href, label, icon }: { href: string; label: string; icon: IconName }) {
  return (
    <a href={href} className="flex min-h-[42px] items-center gap-3 rounded-xl px-3 font-medium transition hover:bg-accent-soft hover:text-text-1">
      <OwnerIcon name={icon} />
      {label}
    </a>
  );
}

type IconName = "pulse" | "users" | "activity" | "switch" | "shield" | "back";
function OwnerIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    pulse: <path d="M3 12h4l2.1-5 3.1 10 2.2-5H21" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    activity: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /></>,
    switch: <><rect x="3" y="6" width="18" height="12" rx="6" /><circle cx="15" cy="12" r="3" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h12" /></>,
  };
  return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
}

function StatusPill({ positive, label }: { positive: boolean; label: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[.08em] ${positive ? "bg-positive-soft text-positive" : "bg-warn-soft text-warn"}`}>{label}</span>;
}

function SecurityItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-bg/55 p-3.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-positive-soft text-positive"><OwnerIcon name="shield" /></div>
      <div>
        <div className="text-[12px] font-semibold text-text-1">{title}</div>
        <div className="mt-1 text-[10.5px] leading-relaxed text-text-3">{text}</div>
      </div>
    </div>
  );
}

function DimensionBlock({ label, rows }: { label: string; rows: Array<{ label: string; count: number; percent: number }> }) {
  return (
    <div className="mt-4">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-text-3">{label}</div>
      <div className="space-y-2.5">
        {rows.length ? rows.slice(0, 4).map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto] gap-3 text-[11.5px]">
            <div className="truncate text-text-2">{row.label}</div>
            <div className="tabular-nums text-text-3">{row.count} · {row.percent}%</div>
          </div>
        )) : <div className="text-[11px] text-text-3">Waiting for tracked sessions.</div>}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-bg/40 px-4 py-6 text-center text-[11px] leading-relaxed text-text-3">{text}</div>;
}

function buildSignupBars(users: DirectoryUser[], now: number) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (6 - index) * DAY);
    return {
      key: dateKey(date),
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      count: 0,
      percent: 0,
    };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));
  for (const user of users) {
    const day = byKey.get(dateKey(new Date(user.created_at)));
    if (day) day.count += 1;
  }
  const max = Math.max(1, ...days.map((day) => day.count));
  return days.map((day) => ({ ...day, percent: Math.round((day.count / max) * 100) }));
}

function topGeography(logins: LoginEvent[]) {
  const counts = new Map<string, number>();
  for (const login of logins) {
    if (!login.city && !login.region && !login.country) continue;
    const label = [login.city, login.region].filter(Boolean).join(", ") || login.country || "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = Math.max(1, ...rows.map((row) => row[1]));
  return rows.map(([label, count]) => ({ label, count, percent: Math.max(12, Math.round((count / max) * 100)) }));
}

function topActivityPaths(activity: ActivityEvent[]) {
  const counts = new Map<string, number>();
  for (const event of activity) {
    if (event.event_name !== "page_view" || !event.path) continue;
    counts.set(event.path, (counts.get(event.path) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...rows.map((row) => row[1]));
  return rows.map(([path, count]) => ({ path, count, percent: Math.max(10, Math.round((count / max) * 100)) }));
}

function topDimension(values: Array<string | null>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0) || 1;
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count, percent: Math.round((count / total) * 100) }));
}

function locationLabel(login?: LoginEvent) {
  if (!login) return "—";
  return [login.city, login.region].filter(Boolean).join(", ") || login.country || "Unknown";
}

function initials(value: string | null) {
  if (!value) return "?";
  return value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function relativeTime(value: string | null, now: number) {
  if (!value) return "—";
  const diff = now - new Date(value).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return formatDate(value);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isRecent(value: string | null | undefined, cutoff: number) {
  return Boolean(value && new Date(value).getTime() >= cutoff);
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}
