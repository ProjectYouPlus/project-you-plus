export type WebsiteOverview = {
  days: number; since: string; updated_at: string;
  visits: number; signups: number; converted_visits: number; cta_visits: number; form_starts: number; total_waitlist: number; waiting: number;
  daily: { date: string; visits: number; signups: number }[];
  sources: { source: string; visits: number; signups: number; converted: number }[];
  campaigns: { source: string; medium: string; campaign: string; visits: number; signups: number }[];
  recent: { id: string; name: string; email: string; improvement_goal: string | null; source: string; utm_campaign: string | null; signup_status: string; created_at: string }[];
};
export function websiteDays(value: unknown) { return ['7','30','90'].includes(String(value)) ? Number(value) : 30; }
export function canViewWebsite(role: string) { return role === 'owner' || role === 'admin'; }
export function conversionRate(converted: number, visits: number) { return visits > 0 ? `${(converted / visits * 100).toFixed(1)}%` : '—'; }
