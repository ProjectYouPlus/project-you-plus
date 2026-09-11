import { createClient } from "@/lib/supabase/server";

export async function requireMarketingOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, user: null, supabase };

  const { data: admin } = await supabase
    .from("admin_users")
    .select("active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  return { allowed: Boolean(admin), user, supabase };
}

export type MarketingMetric = {
  followers?: number | null;
  reach?: number | null;
  profile_visits?: number | null;
  website_clicks?: number | null;
  shares?: number | null;
  saves?: number | null;
  comments?: number | null;
  likes?: number | null;
  signups?: number | null;
};

export function calculateGrowthScore(metrics: MarketingMetric[], publishedLast7Days: number) {
  if (!metrics.length) return { score: 0, label: "Needs data", components: { velocity: 0, engagement: 0, conversion: 0, momentum: 0 } };
  const latest = metrics[0] || {};
  const previous = metrics[Math.min(metrics.length - 1, 6)] || {};
  const reach = Math.max(1, latest.reach || 0);
  const engagement = Math.min(100, (((latest.shares || 0) * 4 + (latest.saves || 0) * 3 + (latest.comments || 0) * 2 + (latest.likes || 0)) / reach) * 500);
  const conversion = Math.min(100, (((latest.signups || 0) * 8 + (latest.website_clicks || 0) * 2 + (latest.profile_visits || 0)) / reach) * 250);
  const velocity = Math.min(100, (publishedLast7Days / 14) * 100);
  const followerBase = Math.max(1, previous.followers || latest.followers || 1);
  const momentum = Math.max(0, Math.min(100, (((latest.followers || 0) - (previous.followers || 0)) / followerBase) * 5000 + 35));
  const score = Math.round(velocity * 0.3 + engagement * 0.3 + conversion * 0.25 + momentum * 0.15);
  return { score, label: score >= 80 ? "Compounding" : score >= 60 ? "Strong" : score >= 40 ? "Building" : "Needs focus", components: { velocity: Math.round(velocity), engagement: Math.round(engagement), conversion: Math.round(conversion), momentum: Math.round(momentum) } };
}
