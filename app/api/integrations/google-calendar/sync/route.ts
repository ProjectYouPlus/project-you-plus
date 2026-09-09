import { NextResponse } from "next/server";
import { syncGoogleCalendarForUser } from "@/lib/integrations/google-calendar";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  try {
    const result = await syncGoogleCalendarForUser(user.id);
    return NextResponse.json({ ok: true, synced: result.synced });
  } catch (error) {
    console.error("Google Calendar sync error:", error);
    return NextResponse.json({ error: "Could not refresh Google Calendar." }, { status: 500 });
  }
}
