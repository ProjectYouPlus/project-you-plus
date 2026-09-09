import { NextResponse } from "next/server";
import { exchangePlaidPublicToken, isPlaidConfigured } from "@/lib/integrations/plaid";
import { syncPlaidForUser } from "@/lib/integrations/plaid-sync";
import { saveIntegrationSecret } from "@/lib/integrations/secrets";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  if (!isPlaidConfigured()) return NextResponse.json({ error: "Plaid Sandbox credentials are not configured yet." }, { status: 503 });

  try {
    const body = (await request.json()) as { publicToken?: string };
    const publicToken = body.publicToken?.trim();
    if (!publicToken) return NextResponse.json({ error: "Missing Plaid public token." }, { status: 400 });

    const exchanged = await exchangePlaidPublicToken(publicToken);
    await saveIntegrationSecret(user.id, "plaid", { access_token: exchanged.access_token, item_id: exchanged.item_id, transaction_cursor: null });
    const synced = await syncPlaidForUser(user.id);
    return NextResponse.json({ ok: true, accounts: synced.accounts });
  } catch (error) {
    console.error("Plaid exchange error:", error);
    return NextResponse.json({ error: "The bank connection completed, but Project You+ could not finish syncing it." }, { status: 500 });
  }
}
