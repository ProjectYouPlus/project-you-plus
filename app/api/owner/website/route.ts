import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWebsiteOverview } from '@/lib/website/overview';
import { canViewWebsite, websiteDays } from '@/lib/website/overview-types';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export async function GET(request: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to view website analytics.' }, { status: 401, headers });
  const { data: admin } = await db.from('admin_users').select('role').eq('user_id',user.id).eq('active',true).maybeSingle();
  if (!admin || !canViewWebsite(admin.role)) return NextResponse.json({ error: 'Owner or administrator access required.' }, { status: 403, headers });
  const data = await getWebsiteOverview(websiteDays(request.nextUrl.searchParams.get('days')));
  return NextResponse.json(data ? { data } : { error: 'Website analytics could not load. Please retry.' }, { status: data ? 200 : 503, headers });
}
