import { NextResponse } from "next/server";
import { googleCalendarRedirectUri, isGoogleCalendarConfigured } from "@/lib/integrations/google-calendar";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    configured: isGoogleCalendarConfigured(),
    redirectUri: googleCalendarRedirectUri(),
  });
}
