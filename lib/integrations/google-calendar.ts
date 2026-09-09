import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegrationSecret, saveIntegrationSecret } from "@/lib/integrations/secrets";
import { getSiteUrl } from "@/lib/supabase/env";

type GoogleSecret = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  scope?: string;
};

type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export function isGoogleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function googleCalendarRedirectUri() {
  return `${getSiteUrl()}/api/integrations/google-calendar/callback`;
}

export function googleCalendarAuthorizationUrl(state: string) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) throw new Error("Google Calendar client ID is not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleCalendarRedirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCalendarCode(code: string) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Calendar OAuth is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: googleCalendarRedirectUri(), grant_type: "authorization_code" }),
    cache: "no-store",
  });
  const data = await response.json() as { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Google token exchange failed");
  return data;
}

export async function saveGoogleCalendarTokens(userId: string, tokens: { access_token: string; expires_in?: number; refresh_token?: string; scope?: string }) {
  const existing = await getIntegrationSecret<GoogleSecret>(userId, "google_calendar");
  await saveIntegrationSecret(userId, "google_calendar", {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || existing?.refresh_token,
    expires_at: Date.now() + Math.max(60, Number(tokens.expires_in || 3600) - 60) * 1000,
    scope: tokens.scope || existing?.scope,
  });
}

export async function syncGoogleCalendarForUser(userId: string) {
  const accessToken = await getGoogleAccessToken(userId);
  const timeMin = new Date(); timeMin.setDate(timeMin.getDate() - 1);
  const timeMax = new Date(); timeMax.setDate(timeMax.getDate() + 90);
  const params = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "2500", showDeleted: "true" });
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const data = await response.json() as { items?: GoogleEvent[]; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || "Google Calendar sync failed");

  const admin = createAdminClient();
  let synced = 0;
  for (const event of data.items ?? []) {
    if (!event.id) continue;
    if (event.status === "cancelled") {
      await admin.from("calendar_events").delete().eq("user_id", userId).eq("source", "google").eq("external_id", event.id);
      continue;
    }
    const startAt = googleDate(event.start);
    const endAt = googleDate(event.end);
    if (!startAt || !endAt) continue;
    const payload = { user_id: userId, source: "google", external_id: event.id, calendar_id: "primary", title: event.summary || "Busy", start_at: startAt, end_at: endAt, location: event.location || null, synced_at: new Date().toISOString() };
    const { data: existing } = await admin.from("calendar_events").select("id").eq("user_id", userId).eq("source", "google").eq("external_id", event.id).maybeSingle();
    if (existing?.id) await admin.from("calendar_events").update(payload).eq("id", existing.id);
    else await admin.from("calendar_events").insert(payload);
    synced += 1;
  }
  await admin.from("integrations").upsert({ user_id: userId, provider: "google_calendar", status: "connected", connected_at: new Date().toISOString(), metadata: { access: "read_only", calendar: "primary", last_synced_at: new Date().toISOString() } }, { onConflict: "user_id,provider" });
  return { synced };
}

async function getGoogleAccessToken(userId: string) {
  const secret = await getIntegrationSecret<GoogleSecret>(userId, "google_calendar");
  if (!secret) throw new Error("Google Calendar is not connected");
  if (secret.access_token && Number(secret.expires_at || 0) > Date.now()) return secret.access_token;
  if (!secret.refresh_token) throw new Error("Google Calendar connection needs to be renewed");
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Calendar OAuth is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: secret.refresh_token, grant_type: "refresh_token" }), cache: "no-store" });
  const data = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Google token refresh failed");
  await saveGoogleCalendarTokens(userId, { access_token: data.access_token, expires_in: data.expires_in, refresh_token: secret.refresh_token, scope: secret.scope });
  return data.access_token;
}

function googleDate(value?: { dateTime?: string; date?: string }) {
  if (value?.dateTime) return new Date(value.dateTime).toISOString();
  if (value?.date) return new Date(`${value.date}T00:00:00`).toISOString();
  return null;
}
