import Link from "next/link";
import { MealScanReview } from "@/components/health/meal-scan-review";

export default function ScanMealPage() {
  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="mb-6 flex items-start gap-3">
        <Link href="/health" className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-[22px] text-text-2" aria-label="Back to Health">‹</Link>
        <div>
          <h1 className="m-0 text-[29px] font-semibold tracking-[-0.035em] text-text-1">Nutrition AI</h1>
          <p className="py-subtitle">Photograph a meal, review the estimate, and add it to your real nutrition history.</p>
        </div>
      </header>
      <MealScanReview />
    </main>
  );
}
