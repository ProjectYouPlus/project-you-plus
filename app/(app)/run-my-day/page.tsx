import { buildProjectYouContext } from "@/lib/ai/context";
import { fallbackRunMyDay } from "@/lib/ai/fallbacks";
import { RunMyDayPageView } from "@/components/today/run-my-day-page-view";

export default async function RunMyDayPage() {
  const context = await buildProjectYouContext();
  return <RunMyDayPageView initialPlan={fallbackRunMyDay(context)} />;
}
