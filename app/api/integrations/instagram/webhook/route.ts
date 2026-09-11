import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const valid = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  return valid ? new NextResponse(url.searchParams.get("hub.challenge") || "", { status: 200 }) : new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";
  const secret = process.env.INSTAGRAM_APP_SECRET || "";
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (!secret || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return new NextResponse("Forbidden", { status: 403 });
  const body = JSON.parse(raw) as { entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: Record<string, unknown> }> }> };
  const admin = createAdminClient();
  for (const entry of body.entry || []) {
    if (!entry.id) continue;
    const { data: integration } = await admin.from("integrations").select("user_id").eq("provider", "instagram").contains("metadata", { instagram_user_id: entry.id }).maybeSingle();
    if (!integration?.user_id) continue;
    for (const change of entry.changes || []) {
      if (change.field !== "comments") continue;
      const value = change.value || {};
      const externalId = String(value.id || value.comment_id || "");
      const { data: existing } = externalId ? await admin.from("marketing_community_actions").select("id").eq("owner_id", integration.user_id).eq("external_id", externalId).maybeSingle() : { data: null };
      if (existing) continue;
      await admin.from("marketing_community_actions").insert({
        owner_id: integration.user_id, channel: "instagram", action_type: "comment", external_id: externalId || null,
        contact_handle: String(value.from || value.username || "") || null, context: String(value.text || "Instagram comment"),
        priority: 2, status: "open", metadata: value,
      });
    }
  }
  return NextResponse.json({ received: true });
}
