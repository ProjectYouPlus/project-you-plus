import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/owner/access";
import {
  deleteHiggsfieldSecret,
  higgsfieldImageModelPath,
  higgsfieldVideoModelPath,
  saveHiggsfieldSecret,
  testHiggsfieldCredentials,
} from "@/lib/integrations/higgsfield";

export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  const form = await request.formData();
  const action = String(form.get("action") || "connect");
  const redirect = new URL("/owner/integrations", request.url);

  try {
    if (action === "disconnect") {
      await deleteHiggsfieldSecret(user.id);
      await supabase.from("integrations").upsert({
        user_id: user.id,
        provider: "higgsfield",
        status: "disconnected",
        connected_at: null,
        metadata: { api_mode: "cloud", disconnected_at: new Date().toISOString() },
      }, { onConflict: "user_id,provider" });
      redirect.searchParams.set("higgsfield", "disconnected");
      return NextResponse.redirect(redirect, 303);
    }

    const apiKeyId = String(form.get("apiKeyId") || "").trim();
    const apiKeySecret = String(form.get("apiKeySecret") || "").trim();
    if (!apiKeyId || !apiKeySecret) throw new Error("Enter both the Higgsfield API key ID and secret.");

    const secret = { api_key_id: apiKeyId, api_key_secret: apiKeySecret };
    const test = await testHiggsfieldCredentials(secret);
    await saveHiggsfieldSecret(user.id, secret);
    await supabase.from("integrations").upsert({
      user_id: user.id,
      provider: "higgsfield",
      status: "connected",
      connected_at: new Date().toISOString(),
      metadata: {
        api_mode: "cloud",
        image_model_path: higgsfieldImageModelPath(),
        video_model_path: higgsfieldVideoModelPath(),
        healthcheck_model_path: test.modelPath,
        healthcheck_estimated_credits: test.credits,
        healthcheck_estimated_usd: test.usd,
        last_checked_at: new Date().toISOString(),
      },
    }, { onConflict: "user_id,provider" });

    redirect.searchParams.set("higgsfield", "connected");
    return NextResponse.redirect(redirect, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect Higgsfield.";
    redirect.searchParams.set("higgsfield_error", message.slice(0, 180));
    return NextResponse.redirect(redirect, 303);
  }
}
