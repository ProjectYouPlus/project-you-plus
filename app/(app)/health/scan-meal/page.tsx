import Link from "next/link";
import { MealScanReview } from "@/components/health/meal-scan-review";

export default function ScanMealPage() {
  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="mb-6 flex items-start gap-3">
        <Link href="/health" className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-[22px] text-text-2">‹</Link>
        <div>
          <div className="py-eyebrow mb-1">Nutrition camera</div>
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.04em] text-text-1">Scan your meal</h1>
          <p className="py-subtitle">Photo → identify → estimate → review → save.</p>
        </div>
      </header>
      <MealScanReview />
    </main>
  );
}
