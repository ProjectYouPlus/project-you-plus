import { NextResponse } from "next/server";
import { createPlaidLinkToken, isPlaidConfigured } from "@/lib/integrations/plaid";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  if (!isPlaidConfigured()) return NextResponse.json({ error: "Plaid Sandbox credentials are not configured yet.", code: "PLAID_NOT_CONFIGURED" }, { status: 503 });
  try {
    const result = await createPlaidLinkToken(user.id);
    return NextResponse.json({ linkToken: result.link_token, expiration: result.expiration });
  } catch (error) {
    console.error("Plaid link token error:", error);
    return NextResponse.json({ error: "Could not start the secure bank connection." }, { status: 500 });
  }
}
