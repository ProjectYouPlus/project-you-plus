import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attribution, UUID, validateSignup } from "@/lib/website/attribution";
import { limitPublicRequest, PublicRequestError, readPublicRequest } from "@/lib/website/server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const input = await readPublicRequest(request);
    if (input.website) throw new PublicRequestError("Please try again without autofilling the hidden field.");
    let signup; try { signup = validateSignup(input); } catch (error) { throw new PublicRequestError((error as Error).message); }
    await limitPublicRequest(request, "signup");
    const sessionId = typeof input.session_id === "string" && UUID.test(input.session_id) ? input.session_id : randomUUID();
    const { data, error } = await createAdminClient().rpc("register_beta_waitlist", { p_signup: { ...signup, ...attribution(input) }, p_session_id: sessionId });
    if (error) { console.error("Beta signup storage failed", error.code); throw new Error("Storage unavailable"); }
    return NextResponse.json({ status: data ? "joined" : "already_joined" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof PublicRequestError;
    return NextResponse.json({ error: known ? error.message : "We couldn’t save your place just yet. Please try again in a moment." }, { status: known ? error.status : 503, headers: { "Cache-Control": "no-store", ...(known && error.status === 429 ? { "Retry-After": "60" } : {}) } });
  }
}
