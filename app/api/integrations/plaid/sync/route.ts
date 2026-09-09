import { NextResponse } from "next/server";
import { syncPlaidForUser } from "@/lib/integrations/plaid-sync";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  try {
    const result = await syncPlaidForUser(user.id);
    return NextResponse.json({ ok: true, accounts: result.accounts });
  } catch (error) {
    console.error("Plaid sync error:", error);
    return NextResponse.json({ error: "Could not refresh connected financial accounts." }, { status: 500 });
  }
}
