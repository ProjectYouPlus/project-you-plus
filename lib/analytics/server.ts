import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthEventType = "sign_in" | "sign_up" | "email_confirm" | "session_start";

type RequestContext = {
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  userAgent: string | null;
  deviceFamily: string | null;
  browser: string | null;
  os: string | null;
};

export async function getBooleanSetting(supabase: SupabaseClient, key: string, fallback: boolean) {
  const { data, error } = await supabase.from("app_settings").select("value").eq("setting_key", key).maybeSingle();
  if (error || data == null) return fallback;
  return typeof data.value === "boolean" ? data.value : fallback;
}

export async function recordAuthEvent(
  supabase: SupabaseClient,
  eventType: AuthEventType,
  options: { authMethod?: string; path?: string | null } = {}
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const locationEnabled = await getBooleanSetting(supabase, "location_analytics_enabled", true);
  const context = await getRequestContext();

  const payload = {
    user_id: user.id,
    event_type: eventType,
    auth_method: options.authMethod ?? latestAuthMethod(user),
    city: locationEnabled ? context.city : null,
    region: locationEnabled ? context.region : null,
    country: locationEnabled ? context.country : null,
    timezone: locationEnabled ? context.timezone : null,
    latitude: locationEnabled ? context.latitude : null,
    longitude: locationEnabled ? context.longitude : null,
    ip_address: null,
    user_agent: context.userAgent,
    device_family: context.deviceFamily,
    browser: context.browser,
    os: context.os,
    path: options.path ?? null,
  };

  await supabase.from("login_events").insert(payload);
}

async function getRequestContext(): Promise<RequestContext> {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const parsed = parseUserAgent(userAgent);

  return {
    city: decodeHeader(requestHeaders.get("x-vercel-ip-city")),
    region: decodeHeader(requestHeaders.get("x-vercel-ip-country-region")),
    country: decodeHeader(requestHeaders.get("x-vercel-ip-country")),
    timezone: decodeHeader(requestHeaders.get("x-vercel-ip-timezone")),
    latitude: toNumber(requestHeaders.get("x-vercel-ip-latitude")),
    longitude: toNumber(requestHeaders.get("x-vercel-ip-longitude")),
    userAgent,
    deviceFamily: parsed.deviceFamily,
    browser: parsed.browser,
    os: parsed.os,
  };
}

function decodeHeader(value: string | null) {
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return value; }
}

function toNumber(value: string | null) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseUserAgent(userAgent: string | null) {
  const ua = userAgent ?? "";
  const deviceFamily = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? "Tablet" : /iPhone|iPod|Android.*Mobile|Mobile/i.test(ua) ? "Mobile" : ua ? "Desktop" : null;
  const browser = /Edg\//i.test(ua) ? "Edge" : /Chrome\//i.test(ua) && !/Edg\//i.test(ua) ? "Chrome" : /Firefox\//i.test(ua) ? "Firefox" : /Safari\//i.test(ua) && !/Chrome\//i.test(ua) ? "Safari" : ua ? "Other" : null;
  const os = /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Mac OS X|Macintosh/i.test(ua) ? "macOS" : /Windows/i.test(ua) ? "Windows" : /Linux/i.test(ua) ? "Linux" : ua ? "Other" : null;
  return { deviceFamily, browser, os };
}

function latestAuthMethod(user: { app_metadata?: Record<string, unknown> }) {
  const provider = user.app_metadata?.provider;
  return typeof provider === "string" ? provider : "email";
}
