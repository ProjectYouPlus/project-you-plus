import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { websiteDays, type WebsiteOverview } from './overview-types';
// Call only after checking the current authenticated user's owner/admin role.
export async function getWebsiteOverview(days = 30): Promise<WebsiteOverview | null> {
  try {
    const { data, error } = await createAdminClient().rpc('website_owner_overview', { p_days: websiteDays(days) });
    if (error || !data) { console.error('Website overview unavailable', error?.code); return null; }
    return data as WebsiteOverview;
  } catch { return null; }
}
