import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used from Server Components, Route Handlers, and Server Actions.
// Reads the session from cookies so RLS policies see the correct auth.uid().
export async function createClient() {
  const cookieStore = await cookies();

  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };

  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component during render — cookies can't
            // be written here. Session refresh is handled in middleware.ts,
            // so this is safe to ignore.
          }
        },
      },
    }
  );
}
