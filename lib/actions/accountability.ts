"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const METRICS = new Set(["consistency_points", "workouts", "habit_days", "task_wins"]);

export async function saveSocialProfile(formData: FormData) {
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 60);
  const discoverable = String(formData.get("discoverable") ?? "") === "on";
  if (handle.length < 3) return { error: "Choose a handle with at least 3 characters." };
  if (!/^[a-z0-9._-]+$/.test(handle)) return { error: "Use letters, numbers, periods, underscores, or hyphens." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };

  const { error } = await supabase.from("social_profiles").upsert({ user_id: user.id, handle, display_name: displayName || null, discoverable, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: error.code === "23505" ? "That handle is already taken." : error.message };
  revalidatePath("/accountability");
  return { error: null };
}

export async function sendAccountabilityRequest(formData: FormData) {
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  if (!handle) return { error: "Enter a friend’s handle." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { data: profile } = await supabase.from("social_profiles").select("user_id,handle").ilike("handle", handle).maybeSingle();
  if (!profile) return { error: "No discoverable Project You+ profile matched that handle." };
  if (profile.user_id === user.id) return { error: "That is your own profile." };
  const { error } = await supabase.from("accountability_connections").insert({ requester_id: user.id, addressee_id: profile.user_id, status: "pending" });
  if (error) return { error: error.code === "23505" ? "You already have a request or connection with this person." : error.message };
  revalidatePath("/accountability");
  return { error: null };
}

export async function respondAccountabilityRequest(connectionId: string, status: "accepted" | "declined") {
  const supabase = await createClient();
  const { error } = await supabase.from("accountability_connections").update({ status, updated_at: new Date().toISOString() }).eq("id", connectionId);
  if (error) return { error: error.message };
  revalidatePath("/accountability");
  return { error: null };
}

export async function createChallenge(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const description = String(formData.get("description") ?? "").trim().slice(0, 240) || null;
  const metric = String(formData.get("metric") ?? "consistency_points");
  const days = Math.max(3, Math.min(90, Number(formData.get("days") ?? 7)));
  if (!title) return { error: "Name the challenge." };
  if (!METRICS.has(metric)) return { error: "Choose a valid challenge type." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const startsOn = new Date();
  const endsOn = new Date(startsOn); endsOn.setDate(endsOn.getDate() + days - 1);
  const { data: challenge, error } = await supabase.from("challenges").insert({ creator_id: user.id, title, description, metric, starts_on: isoDate(startsOn), ends_on: isoDate(endsOn), status: "active", privacy: "friends" }).select("id").single();
  if (error || !challenge) return { error: error?.message || "Could not create challenge." };
  const member = await supabase.from("challenge_members").insert({ challenge_id: challenge.id, user_id: user.id, points: 0 });
  if (member.error) return { error: member.error.message };
  revalidatePath("/accountability");
  return { error: null };
}

export async function inviteFriendToChallenge(challengeId: string, friendUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { error } = await supabase.from("challenge_invites").insert({ challenge_id: challengeId, inviter_id: user.id, invitee_id: friendUserId, status: "pending" });
  if (error) return { error: error.code === "23505" ? "That friend is already invited." : error.message };
  revalidatePath("/accountability");
  return { error: null };
}

export async function respondChallengeInvite(inviteId: string, accept: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { data: invite } = await supabase.from("challenge_invites").select("challenge_id,invitee_id").eq("id", inviteId).maybeSingle();
  if (!invite || invite.invitee_id !== user.id) return { error: "Invite not found." };
  const status = accept ? "accepted" : "declined";
  const { error } = await supabase.from("challenge_invites").update({ status, updated_at: new Date().toISOString() }).eq("id", inviteId);
  if (error) return { error: error.message };
  if (accept) {
    const joined = await supabase.from("challenge_members").upsert({ challenge_id: invite.challenge_id, user_id: user.id, points: 0 }, { onConflict: "challenge_id,user_id" });
    if (joined.error) return { error: joined.error.message };
  }
  revalidatePath("/accountability");
  return { error: null };
}

function normalizeHandle(value: string) { return value.trim().toLowerCase().replace(/^@/, "").slice(0, 24); }
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
