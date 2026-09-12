import { DepartmentBudgetControl } from "@/components/marketing/department-budget-control";
import { GrowthDepartmentDashboard } from "@/components/marketing/growth-department-dashboard";
import { MarketingRuntimeStatus } from "@/components/marketing/runtime-status";
import { OwnerSectionShell } from "@/components/owner/owner-section-shell";
import { requireAdmin } from "@/lib/owner/access";
import { getOwnerApprovalCount } from "@/lib/owner/approval-count";

export const dynamic = "force-dynamic";

export default async function OwnerMarketingPage() {
  const { supabase, user } = await requireAdmin();
  const approvalCount = await getOwnerApprovalCount(supabase);
  const displayName = (user.user_metadata?.full_name as string | undefined) || user.email || "Owner";

  return (
    <OwnerSectionShell
      active="marketing"
      title="Growth Command Center"
      subtitle="Project You+ organic growth, content intelligence, community and distribution."
      displayName={displayName}
      approvalCount={approvalCount}
    >
      <div className="-mt-3 mb-4 text-[10px] font-semibold uppercase tracking-[.22em] text-[#b7a2ff]">Marketing Operations</div>
      <MarketingRuntimeStatus />
      <DepartmentBudgetControl />
      <GrowthDepartmentDashboard />
    </OwnerSectionShell>
  );
}
