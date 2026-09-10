import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password"];

const MODULE_PATHS: Array<[prefix: string, moduleKey: string]> = [
  ["/health", "health"],
  ["/money", "money"],
  ["/finance", "money"],
  ["/coach", "coach"],
  ["/fitness", "fitness"],
  ["/supplements", "supplements"],
  ["/accountability", "accountability"],
  ["/reminders", "reminders"],
  ["/integrations", "integrations"],
];

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isLandingPath = path === "/" || path === "/welcome";
  const isAuthCallback = path === "/auth/confirm" || path === "/auth/callback";
  const isOnboardingPath = path.startsWith("/onboarding");
  const isOwnerPath = path.startsWith("/owner");
  const isMaintenancePath = path === "/maintenance";
  const isApiPath = path.startsWith("/api/");

  function redirectWithCookies(url: URL) {
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  }

  if (!user && !isPublicPath && !isLandingPath && !isAuthCallback && !isMaintenancePath) {
    if (isApiPath) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = isOnboardingPath ? "/signup" : "/login";
    return redirectWithCookies(url);
  }

  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return redirectWithCookies(url);
  }

  if (user && !isOwnerPath && !isMaintenancePath && !isAuthCallback && !isApiPath) {
    const moduleKey = moduleKeyForPath(path);
    const [maintenanceRes, moduleRes] = await Promise.all([
      supabase
        .from("app_settings")
        .select("value")
        .eq("setting_key", "maintenance_mode")
        .maybeSingle(),
      moduleKey
        ? supabase
            .from("app_modules")
            .select("enabled,rollout_percent")
            .eq("module_key", moduleKey)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (maintenanceRes.data?.value === true) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return redirectWithCookies(url);
    }

    const module = moduleRes.data;
    if (
      moduleKey &&
      module &&
      (!module.enabled || rolloutBucket(user.id, moduleKey) >= module.rollout_percent)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("module", "unavailable");
      return redirectWithCookies(url);
    }
  }

  return response;
}

function moduleKeyForPath(path: string) {
  return MODULE_PATHS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;
}

function rolloutBucket(userId: string, moduleKey: string) {
  const input = `${userId}:${moduleKey}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}
