import { redirect } from "next/navigation";
import { MarketingOpsDashboard } from "@/components/marketing/marketing-ops-dashboard";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const allowlist = ownerEmails();
  const email = user.email?.toLowerCase();
  if (!email || allowlist.length === 0 || !allowlist.includes(email)) {
    redirect("/today");
  }

  return <MarketingOpsDashboard />;
}
