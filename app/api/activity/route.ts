import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBooleanSetting, recordAuthEvent } from "@/lib/analytics/server";

const ALLOWED_EVENTS = new Set(["session_start", "page_view"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const analyticsEnabled = await getBooleanSetting(supabase, "analytics_enabled", true);
  if (!analyticsEnabled) return new NextResponse(null, { status: 204 });

  const body = await request.json().catch(() => null) as
    | { eventName?: string; path?: string }
    | null;

  const eventName = body?.eventName ?? "";
  const path = sanitizePath(body?.path);

  if (!ALLOWED_EVENTS.has(eventName)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const { error } = await supabase.from("activity_events").insert({
    user_id: user.id,
    event_name: eventName,
    path,
  });

  if (error) {
    return NextResponse.json({ error: "Unable to record event" }, { status: 500 });
  }

  if (eventName === "session_start") {
    await recordAuthEvent(supabase, "session_start", { path });
  }

  return new NextResponse(null, { status: 204 });
}

function sanitizePath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value.slice(0, 240);
}
