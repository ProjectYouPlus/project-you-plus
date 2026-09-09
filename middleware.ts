import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isDemoMode } from "@/lib/demo-mode";

export async function middleware(request: NextRequest) {
  // Demo mode has no real session to protect — every route is open so the
  // app is fully browsable immediately. Flip NEXT_PUBLIC_DEMO_MODE=false
  // once Supabase is connected and this guard becomes live.
  if (isDemoMode) return NextResponse.next();

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and image optimization files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
