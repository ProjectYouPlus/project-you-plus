import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeGoogleCalendarCode, saveGoogleCalendarTokens, syncGoogleCalendarForUser } from "@/lib/integrations/google-calendar";
import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const expectedState = cookies().get("py_google_calendar_state")?.value;
  const destination = new URL("/calendar", getSiteUrl());

  if (oauthError) {
    destination.searchParams.set("google", "cancelled");
    return clearState(NextResponse.redirect(destination));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    destination.searchParams.set("google", "invalid_state");
    return clearState(NextResponse.redirect(destination));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return clearState(NextResponse.redirect(new URL("/login", getSiteUrl())));

  try {
    const tokens = await exchangeGoogleCalendarCode(code);
    await saveGoogleCalendarTokens(user.id, { access_token: tokens.access_token!, expires_in: tokens.expires_in, refresh_token: tokens.refresh_token, scope: tokens.scope });
    const result = await syncGoogleCalendarForUser(user.id);
    destination.searchParams.set("google", "connected");
    destination.searchParams.set("synced", String(result.synced));
    return clearState(NextResponse.redirect(destination));
  } catch (error) {
    console.error("Google Calendar OAuth callback error:", error);
    destination.searchParams.set("google", "error");
    return clearState(NextResponse.redirect(destination));
  }
}

function clearState(response: NextResponse) {
  response.cookies.set("py_google_calendar_state", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0, path: "/" });
  return response;
}
