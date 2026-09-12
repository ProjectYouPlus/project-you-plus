export type TrafficSource = "instagram" | "tiktok" | "direct" | "referral" | "other";
export type Attribution = { source: TrafficSource; referral_source: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; landing_page: string };
const clean = (value: unknown, limit = 120) => typeof value === "string" ? value.trim().slice(0, limit) || null : null;
export function attribution(input: Record<string, unknown>): Attribution {
  const utm_source = clean(input.utm_source), utm_medium = clean(input.utm_medium), utm_campaign = clean(input.utm_campaign);
  let ref: string | null = null;
  try { ref = new URL(String(input.referral_source || "")).hostname.toLowerCase(); } catch { /* No external referrer. */ }
  if (ref === "projectyouplus.com" || ref === "www.projectyouplus.com" || ref === "localhost" || ref === "127.0.0.1" || ref?.endsWith(".vercel.app")) ref = null;
  const campaign = utm_source?.toLowerCase();
  const source: TrafficSource = ["instagram", "ig"].includes(campaign || "") || (!campaign && (ref === "instagram.com" || ref?.endsWith(".instagram.com"))) ? "instagram"
    : campaign === "tiktok" || (!campaign && (ref === "tiktok.com" || ref?.endsWith(".tiktok.com"))) ? "tiktok"
    : campaign === "referral" ? "referral" : campaign === "direct" ? "direct" : campaign ? "other" : ref ? "referral" : "direct";
  return { source, referral_source: ref, utm_source, utm_medium, utm_campaign, landing_page: "/" };
}
export function validateSignup(input: Record<string, unknown>) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!name || name.length > 100) throw new Error("Please enter your name (up to 100 characters).");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address.");
  const goal = typeof input.improvement_goal === "string" ? input.improvement_goal.trim() : "";
  if (goal.length > 1000) throw new Error("Please keep your improvement goal under 1,000 characters.");
  const willingness = input.willingness_to_pay == null || input.willingness_to_pay === "" ? null : input.willingness_to_pay;
  if (willingness !== null && !["yes", "maybe", "no"].includes(String(willingness))) throw new Error("Please choose Yes, Maybe or No, or leave the question unanswered.");
  return { name, email, improvement_goal: goal || null, willingness_to_pay: willingness as "yes" | "maybe" | "no" | null };
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
