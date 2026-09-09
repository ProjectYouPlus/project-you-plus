import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createBrowserClient } from "@supabase/ssr";

// Used from Client Components (forms, interactive widgets). Safe to call
// repeatedly — @supabase/ssr manages the singleton internally.
export function createClient() {
  return createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublicKey()
  );
}
