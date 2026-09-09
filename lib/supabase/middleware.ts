import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof response.cookies.set>[2];
  };

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if it's expired — required for Server Components
  // to see a valid session. Do not remove this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isLandingPath = path === "/" || path === "/welcome";
  const isAuthCallback = path === "/auth/confirm" || path === "/auth/callback";
  const isOnboardingPath = path.startsWith("/onboarding");

  function redirectWithCookies(url: URL) {
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  }

  if (!user && !isPublicPath && !isLandingPath && !isAuthCallback) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = isOnboardingPath ? "/signup" : "/login";
    return redirectWithCookies(url);
  }

  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    return redirectWithCookies(url);
  }

  return response;
}
