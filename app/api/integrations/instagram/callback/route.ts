import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeInstagramCode, saveInstagramConnection, syncInstagramForOwner } from "@/lib/integrations/instagram";
import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/owner/integrations", getSiteUrl());
  const state = url.searchParams.get("state");
  const expected = cookies().get("py_instagram_state")?.value;
  if (url.searchParams.get("error")) { destination.searchParams.set("instagram", "cancelled"); return clear(NextResponse.redirect(destination)); }
  if (!url.searchParams.get("code") || !state || !expected || state !== expected) { destination.searchParams.set("instagram", "invalid_state"); return clear(NextResponse.redirect(destination)); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return clear(NextResponse.redirect(new URL("/login", getSiteUrl())));
  try {
    const token = await exchangeInstagramCode(url.searchParams.get("code")!);
    await saveInstagramConnection(user.id, token);
    await syncInstagramForOwner(user.id);
    destination.searchParams.set("instagram", "connected");
  } catch (error) {
    console.error("Instagram OAuth callback error:", error);
    destination.searchParams.set("instagram", "error");
  }
  return clear(NextResponse.redirect(destination));
}

function clear(response: NextResponse) {
  response.cookies.set("py_instagram_state", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0, path: "/" });
  return response;
}
