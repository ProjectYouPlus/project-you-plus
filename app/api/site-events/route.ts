import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attribution, UUID } from "@/lib/website/attribution";
import { limitPublicRequest, PublicRequestError, readPublicRequest } from "@/lib/website/server";
const EVENTS = new Set(["homepage_visit", "hero_beta_cta_click", "bottom_beta_cta_click", "nav_beta_cta_click", "waitlist_form_started"]);
export async function POST(request: NextRequest) {
  try {
    const input = await readPublicRequest(request);
    if (!EVENTS.has(String(input.event)) || !UUID.test(String(input.session_id)) || !UUID.test(String(input.event_id))) throw new PublicRequestError("Invalid event.");
    await limitPublicRequest(request, "event");
    const { error } = await createAdminClient().from("website_events").upsert({ id: input.event_id, session_id: input.session_id, event: input.event, ...attribution(input) }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("Event storage unavailable");
    return new NextResponse(null, { status: 204 });
  } catch (error) { return NextResponse.json({ error: "Event unavailable" }, { status: error instanceof PublicRequestError ? error.status : 503 }); }
}
