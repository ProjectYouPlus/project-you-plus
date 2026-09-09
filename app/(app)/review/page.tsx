import { buildProjectYouContext } from "@/lib/ai/context";
import { fallbackWeeklyReview } from "@/lib/ai/fallbacks";
import { WeeklyReviewPanel } from "@/components/coach/weekly-review-panel";

export default async function ReviewPage() {
  const context = await buildProjectYouContext();
  const review = fallbackWeeklyReview(context);

  return (
    <main className="py-shell-narrow">
      <div className="py-eyebrow mb-2 text-accent-text">PROJECT YOU+ WEEKLY REVIEW</div>
      <h1 className="py-title">Your week, interpreted</h1>
      <p className="mb-7 mt-0 max-w-[640px] text-[14px] leading-relaxed text-text-2">A grounded summary of your score, goals, tasks, and habits—plus the single biggest opportunity to improve next week.</p>
      <WeeklyReviewPanel initialReview={review} />
    </main>
  );
}
