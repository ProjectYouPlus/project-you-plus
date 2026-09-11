import { GrowthDepartmentDashboard } from "@/components/marketing/growth-department-dashboard";
import { DepartmentBudgetControl } from "@/components/marketing/department-budget-control";
import { requireAdmin } from "@/lib/owner/access";

export const dynamic = "force-dynamic";

export default async function MarketingOpsPage() {
  await requireAdmin();

  return (
    <>
      <div className="mx-auto max-w-[1500px] px-4 pt-4 sm:px-6 lg:px-8">
        <DepartmentBudgetControl />
      </div>
      <GrowthDepartmentDashboard />
    </>
  );
}
