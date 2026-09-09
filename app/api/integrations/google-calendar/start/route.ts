import { NextResponse } from "next/server";
import { googleCalendarAuthorizationUrl, isGoogleCalendarConfigured } from "@/lib/integrations/google-calendar";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  if (!isGoogleCalendarConfigured()) return NextResponse.json({ error: "Google Calendar OAuth credentials are not configured yet.", code: "GOOGLE_CALENDAR_NOT_CONFIGURED" }, { status: 503 });
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(googleCalendarAuthorizationUrl(state));
  response.cookies.set("py_google_calendar_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return response;
}
