import { redirect } from "next/navigation";
import { GrowthDepartmentDashboard } from "@/components/marketing/growth-department-dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function ownerEmails() {
  return (process.env.PROJECT_YOU_OWNER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export default async function MarketingOpsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email?.toLowerCase();
  if (!email || !ownerEmails().includes(email)) redirect("/today");

  return <GrowthDepartmentDashboard />;
}
