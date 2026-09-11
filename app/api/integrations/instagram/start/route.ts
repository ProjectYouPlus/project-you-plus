import { NextResponse } from "next/server";
import { instagramAuthorizationUrl, isInstagramConfigured } from "@/lib/integrations/instagram";
import { requireAdmin } from "@/lib/owner/access";

export const runtime = "nodejs";

export async function GET() {
  await requireAdmin();
  if (!isInstagramConfigured()) return NextResponse.json({ error: "Instagram OAuth credentials are not configured.", code: "INSTAGRAM_NOT_CONFIGURED" }, { status: 503 });
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(instagramAuthorizationUrl(state));
  response.cookies.set("py_instagram_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return response;
}
