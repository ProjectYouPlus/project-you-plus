import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isDemoMode } from "@/lib/demo-mode";

const SERVICE_AUTH_PATHS = new Set([
  "/api/marketing-ops/runtime/tick",
]);

export async function middleware(request: NextRequest) {
  // Service-to-service runtime endpoints perform their own cryptographic bearer
  // validation in the route handler. They must reach that handler without a user session.
  if (SERVICE_AUTH_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();

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
