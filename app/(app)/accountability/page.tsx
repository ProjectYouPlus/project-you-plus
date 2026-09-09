import { createChallenge, inviteFriendToChallenge, respondAccountabilityRequest, respondChallengeInvite, saveSocialProfile, sendAccountabilityRequest } from "@/lib/actions/accountability";
import { createClient } from "@/lib/supabase/server";

type SocialProfile = { user_id: string; handle: string | null; display_name: string | null; discoverable: boolean; share_streaks: boolean; share_score: boolean };
type Connection = { id: string; requester_id: string; addressee_id: string; status: string };
type ChallengeMember = { user_id: string; points: number };
type Challenge = { id: string; creator_id: string; title: string; description: string | null; metric: string; starts_on: string; ends_on: string; challenge_members?: ChallengeMember[] };

export default async function AccountabilityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const since = new Date(); since.setDate(since.getDate() - 90); since.setHours(0,0,0,0);
  const [profileRes, connectionsRes, challengesRes, invitesRes, habitLogsRes, workoutsRes, tasksRes] = await Promise.all([
    supabase.from("social_profiles").select("user_id,handle,display_name,discoverable,share_streaks,share_score").eq("user_id", user.id).maybeSingle(),
    supabase.from("accountability_connections").select("id,requester_id,addressee_id,status").order("created_at", { ascending: false }),
    supabase.from("challenges").select("id,creator_id,title,description,metric,starts_on,ends_on,challenge_members(user_id,points)").eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("challenge_invites").select("id,challenge_id,inviter_id,invitee_id,status,challenges(title,metric,ends_on)").eq("invitee_id", user.id).eq("status", "pending"),
    supabase.from("habit_logs").select("logged_at").gte("logged_at", localDate(since)),
    supabase.from("workouts").select("performed_at").gte("performed_at", since.toISOString()),
    supabase.from("tasks").select("completed_at").not("completed_at", "is", null).gte("completed_at", since.toISOString()),
  ]);

  const profile = profileRes.data as SocialProfile | null;
  const connections = (connectionsRes.data ?? []) as Connection[];
  const friendIds = connections.filter((item) => item.status === "accepted").map((item) => item.requester_id === user.id ? item.addressee_id : item.requester_id);
  const pendingIncoming = connections.filter((item) => item.status === "pending" && item.addressee_id === user.id);
  const relevantProfileIds = Array.from(new Set([...friendIds, ...pendingIncoming.map((item) => item.requester_id)]));
  const { data: friendProfilesData } = relevantProfileIds.length ? await supabase.from("social_profiles").select("user_id,handle,display_name,discoverable,share_streaks,share_score").in("user_id", relevantProfileIds) : { data: [] as SocialProfile[] };
  const profiles = new Map(((friendProfilesData ?? []) as SocialProfile[]).map((item) => [item.user_id, item]));

  const activityDates = [
    ...(habitLogsRes.data ?? []).map((row) => String(row.logged_at)),
    ...(workoutsRes.data ?? []).map((row) => localDate(new Date(row.performed_at))),
    ...(tasksRes.data ?? []).map((row) => localDate(new Date(row.completed_at))),
  ];
  const streak = calculateStreak(activityDates);
  const weekStart = new Date(); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate() - 6);
  const weeklyPoints = (habitLogsRes.data ?? []).filter((row) => new Date(`${row.logged_at}T12:00:00`) >= weekStart).length * 5
    + (workoutsRes.data ?? []).filter((row) => new Date(row.performed_at) >= weekStart).length * 15
    + (tasksRes.data ?? []).filter((row) => new Date(row.completed_at) >= weekStart).length * 10;
  const challenges = (challengesRes.data ?? []) as unknown as Challenge[];
  const allMemberIds = Array.from(new Set(challenges.flatMap((challenge) => (challenge.challenge_members ?? []).map((member) => member.user_id))));
  const missingMemberProfiles = allMemberIds.filter((id) => !profiles.has(id) && id !== user.id);
  if (missingMemberProfiles.length) {
    const { data } = await supabase.from("social_profiles").select("user_id,handle,display_name,discoverable,share_streaks,share_score").in("user_id", missingMemberProfiles);
    for (const item of (data ?? []) as SocialProfile[]) profiles.set(item.user_id, item);
  }
  if (profile) profiles.set(user.id, profile);

  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="mb-7"><h1 className="py-title">Accountability</h1><p className="py-subtitle">Build consistency with people you trust. Competition uses actions, habits, and workouts—not private health or financial data.</p></header>

    <section className="py-glass-hero p-5"><div className="grid grid-cols-3 gap-4"><Stat value={String(streak.current)} label="day streak" /><Stat value={String(streak.best)} label="best streak" /><Stat value={String(weeklyPoints)} label="points / 7d" /></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-accent-2" style={{width:`${Math.min(100,(streak.current/14)*100)}%`}} /></div><p className="m-0 mt-3 text-[11px] leading-relaxed text-[#BDB7C9]">A streak day counts when you complete at least one tracked task, habit, or workout. Today does not break yesterday’s streak until the day is over.</p></section>

    {!profile ? <form action={saveSocialProfile} className="py-glass-soft mt-5 p-4"><h2 className="m-0 text-[18px] font-semibold text-text-1">Create your accountability profile</h2><p className="m-0 mt-1.5 text-[11.5px] leading-relaxed text-text-3">Friends only see what you choose to share. Your finances, nutrition, weight, health metrics, and private goals stay private.</p><div className="mt-4 space-y-2.5"><input name="displayName" className="py-input" placeholder="Display name"/><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-3">@</span><input name="handle" required className="py-input pl-8" placeholder="yourhandle"/></div><label className="flex items-center gap-2.5 text-[11.5px] text-text-2"><input type="checkbox" name="discoverable" defaultChecked className="h-4 w-4 accent-violet-500"/>Let friends find me by handle</label></div><button className="py-liquid-button mt-4 w-full">Create profile</button></form> : <section className="py-glass-soft mt-5 p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-[14px] font-semibold text-text-1">{profile.display_name || "Your profile"}</div><div className="mt-0.5 text-[11px] text-accent-text">@{profile.handle}</div></div><span className="py-glass-pill">{friendIds.length} friend{friendIds.length===1?"":"s"}</span></div></section>}

    {profile && <section className="mt-7"><h2 className="m-0 text-[20px] font-semibold text-text-1">Friends</h2><form action={sendAccountabilityRequest} className="mt-3 flex gap-2"><input name="handle" className="py-input min-w-0 flex-1" placeholder="Friend’s @handle"/><button className="py-button-secondary shrink-0">Add</button></form>{pendingIncoming.length>0&&<div className="py-glass-soft mt-3 px-4">{pendingIncoming.map((connection)=>{const person=profiles.get(connection.requester_id);return <div key={connection.id} className="flex items-center gap-3 border-t border-white/[.06] py-3.5 first:border-0"><div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-text-1">{person?.display_name||person?.handle||"Project You+ member"}</div><div className="text-[10.5px] text-text-3">wants to hold each other accountable</div></div><form action={respondAccountabilityRequest.bind(null,connection.id,"accepted")}><button className="text-[11px] font-semibold text-accent-text">Accept</button></form><form action={respondAccountabilityRequest.bind(null,connection.id,"declined")}><button className="text-[11px] text-text-3">Decline</button></form></div>})}</div>}{friendIds.length>0&&<div className="py-glass-soft mt-3 divide-y divide-white/[.06] px-4">{friendIds.map((id)=>{const person=profiles.get(id);return <div key={id} className="flex items-center gap-3 py-3.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[.05] text-[11px] font-semibold text-text-1">{initials(person?.display_name||person?.handle||"PY")}</span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-text-1">{person?.display_name||person?.handle||"Friend"}</div><div className="text-[10.5px] text-text-3">@{person?.handle||"private"}</div></div><span className="text-[10.5px] font-semibold text-positive">Connected</span></div>})}</div>}</section>}

    <section className="mt-8"><div className="flex items-end justify-between gap-3"><div><h2 className="m-0 text-[20px] font-semibold text-text-1">Challenges</h2><p className="m-0 mt-1 text-[11px] text-text-3">Compete on consistency without exposing sensitive life data.</p></div></div>
      <form action={createChallenge} className="py-glass-soft mt-3 p-4"><div className="grid gap-2.5"><input name="title" required className="py-input" placeholder="7-Day Discipline Challenge"/><select name="metric" defaultValue="consistency_points" className="py-input text-[12px]"><option value="consistency_points">Consistency points</option><option value="workouts">Workouts completed</option><option value="habit_days">Habit check-ins</option><option value="task_wins">Tasks completed</option></select><select name="days" defaultValue="7" className="py-input text-[12px]"><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></div><button className="py-liquid-button mt-3 w-full">Start challenge</button></form>
      {(invitesRes.data ?? []).map((invite:any)=><div key={invite.id} className="py-glass-soft mt-3 p-4"><div className="text-[13.5px] font-semibold text-text-1">{invite.challenges?.title||"Challenge invitation"}</div><div className="mt-1 text-[10.5px] text-text-3">You were invited to compete.</div><div className="mt-3 flex gap-3"><form action={respondChallengeInvite.bind(null,invite.id,true)}><button className="text-[11.5px] font-semibold text-accent-text">Join challenge</button></form><form action={respondChallengeInvite.bind(null,invite.id,false)}><button className="text-[11.5px] text-text-3">Decline</button></form></div></div>)}
      {challenges.map((challenge)=><div key={challenge.id} className="py-glass-soft mt-3 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[14px] font-semibold text-text-1">{challenge.title}</div><div className="mt-1 text-[10.5px] capitalize text-text-3">{challenge.metric.replaceAll("_"," ")} · through {new Date(`${challenge.ends_on}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</div></div><span className="py-glass-pill">{challenge.challenge_members?.length||0} players</span></div><div className="mt-4 space-y-2">{[...(challenge.challenge_members??[])].sort((a,b)=>b.points-a.points).map((member,index)=>{const person=profiles.get(member.user_id);return <div key={member.user_id} className="flex items-center gap-3"><span className="w-5 text-[11px] font-bold text-text-3">{index+1}</span><span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text-1">{member.user_id===user.id?"You":person?.display_name||person?.handle||"Friend"}</span><span className="text-[12px] font-bold text-accent-text">{member.points}</span></div>})}</div>{friendIds.length>0&&<div className="mt-4 flex flex-wrap gap-2">{friendIds.filter((friendId)=>!(challenge.challenge_members??[]).some((member)=>member.user_id===friendId)).map((friendId)=>{const person=profiles.get(friendId);return <form key={friendId} action={inviteFriendToChallenge.bind(null,challenge.id,friendId)}><button className="rounded-full border border-white/[.08] bg-white/[.03] px-3 py-1.5 text-[10.5px] font-semibold text-text-2">Invite {person?.display_name||`@${person?.handle||"friend"}`}</button></form>})}</div>}</div>)}
    </section>
  </main>;
}

function calculateStreak(values:string[]){const dates=Array.from(new Set(values.map((value)=>value.slice(0,10)))).sort();let best=0,run=0,previous:number|null=null;for(const value of dates){const time=new Date(`${value}T12:00:00`).getTime();if(previous!=null&&Math.round((time-previous)/86400000)===1)run+=1;else run=1;best=Math.max(best,run);previous=time}const set=new Set(dates);const cursor=new Date();cursor.setHours(12,0,0,0);if(!set.has(localDate(cursor))){cursor.setDate(cursor.getDate()-1)}let current=0;while(set.has(localDate(cursor))){current++;cursor.setDate(cursor.getDate()-1)}return{current,best}}
function localDate(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function initials(value:string){return value.split(/\s+/).map((part)=>part[0]).join("").slice(0,2).toUpperCase()}
function Stat({value,label}:{value:string;label:string}){return <div><div className="text-[31px] font-bold tracking-[-.045em] text-white">{value}</div><div className="mt-0.5 text-[10px] text-[#AAA4B7]">{label}</div></div>}
