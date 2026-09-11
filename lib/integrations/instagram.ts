import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegrationSecret, saveIntegrationSecret } from "@/lib/integrations/secrets";
import { getSiteUrl } from "@/lib/supabase/env";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
];

type InstagramSecret = { access_token: string; expires_at?: number; instagram_user_id: string };

export function isInstagramConfigured() {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
}

export function instagramRedirectUri() {
  return `${getSiteUrl()}/api/integrations/instagram/callback`;
}

export function instagramAuthorizationUrl(state: string) {
  const clientId = process.env.INSTAGRAM_APP_ID;
  if (!clientId) throw new Error("Instagram app ID is not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: instagramRedirectUri(),
    response_type: "code",
    scope: INSTAGRAM_SCOPES.join(","),
    state,
    enable_fb_login: "0",
    force_authentication: "1",
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

export async function exchangeInstagramCode(code: string) {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!clientId || !clientSecret) throw new Error("Instagram OAuth is not configured");
  const shortResponse = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", redirect_uri: instagramRedirectUri(), code }),
    cache: "no-store",
  });
  const short = await shortResponse.json() as { access_token?: string; user_id?: number | string; error_message?: string };
  if (!shortResponse.ok || !short.access_token || !short.user_id) throw new Error(short.error_message || "Instagram token exchange failed");
  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.search = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: clientSecret, access_token: short.access_token }).toString();
  const longResponse = await fetch(longUrl, { cache: "no-store" });
  const long = await longResponse.json() as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!longResponse.ok || !long.access_token) throw new Error(long.error?.message || "Instagram long-lived token exchange failed");
  return { access_token: long.access_token, expires_in: long.expires_in, instagram_user_id: String(short.user_id) };
}

export async function saveInstagramConnection(userId: string, token: { access_token: string; expires_in?: number; instagram_user_id: string }) {
  const profile = await instagramFetch<{ id: string; user_id?: string; username?: string; name?: string; account_type?: string }>(
    `/me?fields=id,user_id,username,name,account_type`, token.access_token,
  );
  const instagramUserId = String(profile.user_id || profile.id || token.instagram_user_id);
  await saveIntegrationSecret(userId, "instagram", {
    access_token: token.access_token,
    expires_at: Date.now() + Number(token.expires_in || 5184000) * 1000,
    instagram_user_id: instagramUserId,
  });
  const admin = createAdminClient();
  const { error } = await admin.from("integrations").upsert({
    user_id: userId,
    provider: "instagram",
    status: "connected",
    connected_at: new Date().toISOString(),
    metadata: { instagram_user_id: instagramUserId, username: profile.username || null, account_type: profile.account_type || null, scopes: INSTAGRAM_SCOPES, last_synced_at: null },
  }, { onConflict: "user_id,provider" });
  if (error) throw error;
  return profile;
}

export async function getInstagramSecret(userId: string) {
  const secret = await getIntegrationSecret<InstagramSecret>(userId, "instagram");
  if (!secret?.access_token || !secret.instagram_user_id) throw new Error("Instagram is not connected");
  return secret;
}

export async function instagramFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? new URL(path) : new URL(`https://graph.instagram.com/v24.0${path}`);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", token);
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || "Instagram API request failed");
  return data;
}

export async function syncInstagramForOwner(userId: string) {
  const secret = await getInstagramSecret(userId);
  const profile = await instagramFetch<{ id: string; username?: string; followers_count?: number; media_count?: number }>(`/${secret.instagram_user_id}?fields=id,username,followers_count,media_count`, secret.access_token);
  const media = await instagramFetch<{ data?: Array<{ id: string; caption?: string; media_type?: string; timestamp?: string; permalink?: string; like_count?: number; comments_count?: number }> }>(`/${secret.instagram_user_id}/media?fields=id,caption,media_type,timestamp,permalink,like_count,comments_count&limit=50`, secret.access_token);
  const today = new Date().toISOString().slice(0, 10);
  const rows = media.data || [];
  const admin = createAdminClient();
  const { error: metricError } = await admin.from("marketing_daily_metrics").upsert({
    owner_id: userId, metric_date: today, followers: profile.followers_count ?? null,
    likes: rows.reduce((sum, item) => sum + Number(item.like_count || 0), 0),
    comments: rows.reduce((sum, item) => sum + Number(item.comments_count || 0), 0),
    metadata: { source: "instagram_api", media_count: profile.media_count ?? rows.length, synced_at: new Date().toISOString() },
  }, { onConflict: "owner_id,metric_date" });
  if (metricError) throw metricError;
  await admin.from("integrations").update({ status: "connected", metadata: { instagram_user_id: secret.instagram_user_id, username: profile.username || null, scopes: INSTAGRAM_SCOPES, last_synced_at: new Date().toISOString() } }).eq("user_id", userId).eq("provider", "instagram");
  return { username: profile.username || null, followers: profile.followers_count ?? null, media: rows.length };
}

export async function publishInstagramContent(userId: string, item: { id: string; format: string; caption?: string | null; metrics?: Record<string, unknown> | null }) {
  const secret = await getInstagramSecret(userId);
  const mediaUrl = String(item.metrics?.media_url || "");
  if (!/^https:\/\//.test(mediaUrl)) throw new Error("Approved content needs a public HTTPS media_url before publishing");
  const create = new URLSearchParams({ caption: item.caption || "", access_token: secret.access_token });
  if (item.format === "reel") { create.set("media_type", "REELS"); create.set("video_url", mediaUrl); }
  else create.set("image_url", mediaUrl);
  const container = await instagramFetch<{ id: string }>(`/${secret.instagram_user_id}/media`, secret.access_token, { method: "POST", body: create });
  const publish = await instagramFetch<{ id: string }>(`/${secret.instagram_user_id}/media_publish`, secret.access_token, { method: "POST", body: new URLSearchParams({ creation_id: container.id, access_token: secret.access_token }) });
  return publish.id;
}
