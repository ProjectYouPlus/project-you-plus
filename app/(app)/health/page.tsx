import { getHealthOverview } from "@/lib/data/health";
import { HealthScoreHeader } from "@/components/health/score-header";
import { TrainingSection } from "@/components/health/training-section";
import { DietTracker } from "@/components/health/diet-tracker";
import { SupplementsSection } from "@/components/health/supplements-section";
import { VitalsRecovery } from "@/components/health/vitals-recovery";
export default async function HealthPage() {
  const overview = await getHealthOverview();
  return (
    <main className="py-mobile-shell space-y-6 md:py-shell-narrow">
      <HealthScoreHeader overview={overview} />
      <TrainingSection
        key={JSON.stringify(overview.training.activePlan?.schedule)}
        training={overview.training}
        error={overview.errors.training}
      />
      <DietTracker
        nutrition={overview.nutrition}
        error={overview.errors.nutrition}
      />
      {overview.errors.targets && <p role="alert" className="text-xs text-text-3">Nutrition targets are temporarily unavailable.</p>}
      <SupplementsSection
        items={overview.supplements}
        reminders={overview.reminders}
        error={overview.errors.supplements}
      />
      {overview.errors.reminders && <p role="alert" className="text-xs text-text-3">Reminder settings are temporarily unavailable. Reopen Health before changing them.</p>}
      <VitalsRecovery
        timezone={overview.timezone}
        metrics={overview.metrics}
        error={overview.errors.recovery}
      />
    </main>
  );
}
