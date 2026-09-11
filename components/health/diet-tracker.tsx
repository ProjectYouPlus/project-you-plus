"use client";
import { useState } from "react";
import type { HealthOverview, Meal } from "@/lib/data/health";
import { MealScanReview } from "./meal-scan-review";
import { saveNutritionTargets } from "@/lib/actions/health-plan";
import { useRouter } from "next/navigation";
export function DietTracker({
  nutrition,
  error,
}: {
  nutrition: HealthOverview["nutrition"];
  error: boolean;
}) {
  const [entry, setEntry] = useState(false),
    [editing, setEditing] = useState<Meal | null>(null),
    [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  return (
    <section id="diet" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-xl font-semibold">Diet Tracker</h2>
        <button
          className="py-glass-pill min-h-[44px]"
          onClick={() => {
            setEditing(null);
            setEntry(!entry);
          }}
        >
          + Add meal
        </button>
      </div>
      {error ? (
        <p role="alert" className="py-glass-soft p-4 text-sm">
          Meals are temporarily unavailable.
        </p>
      ) : (
        <div className="py-glass-soft p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
              <div key={key}>
                <p className="m-0 text-xs capitalize text-text-3">{key}</p>
                <p className="mt-1 text-lg font-semibold">
                  {Math.round(nutrition.totals[key])}
                  {key !== "calories" ? "g" : ""}
                  <span className="block text-xs font-normal text-text-3">
                    {nutrition.targets
                      ? `/ ${nutrition.targets[key]}${key !== "calories" ? "g" : " kcal"}`
                      : "No target set"}
                  </span>
                </p>
              </div>
            ))}
          </div>
          <details className="mt-3 border-t border-border pt-3">
            <summary className="text-xs text-accent-text cursor-pointer">
              {nutrition.targets ? "Edit" : "Set"} your nutrition targets
            </summary>
            <form
              className="mt-3"
              action={async (form) => {
                const result = await saveNutritionTargets(form);
                setMessage(result.error ?? "Targets saved");
                if (!result.error) router.refresh();
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                {(["calories", "protein", "carbs", "fat"] as const).map(
                  (key) => (
                    <label key={key} className="text-xs capitalize">
                      {key}
                      <input
                        name={key}
                        type="number"
                        min="0"
                        max="20000"
                        required
                        defaultValue={nutrition.targets?.[key]}
                        className="py-input mt-1 w-full"
                      />
                    </label>
                  ),
                )}
              </div>
              <button className="py-button-secondary mt-3">Save targets</button>
              {message && (
                <p role="status" className="text-xs">
                  {message}
                </p>
              )}
            </form>
          </details>
          <div className="mt-3 divide-y divide-border">
            {nutrition.meals.length ? (
              nutrition.meals.map((meal) => (
                <div key={meal.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words text-sm font-semibold">
                        {meal.meal_name}
                      </div>
                      <div className="mt-1 text-xs text-text-3">
                        {meal.calories} kcal · P {meal.protein_g}g · C{" "}
                        {meal.carbs_g}g · F {meal.fat_g}g
                      </div>
                    </div>
                    <button
                      className="min-h-[44px] text-xs text-accent-text"
                      onClick={() => {
                        setEditing(meal);
                        setEntry(true);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-3">No meals logged today.</p>
            )}
          </div>
        </div>
      )}
      {entry && (
        <div className="py-glass-soft p-3">
          <div className="mb-3 flex justify-between">
            <h3 className="m-0 font-semibold">
              {editing ? "Edit meal" : "Nutrition AI · Photo or manual entry"}
            </h3>
            <button
              className="text-xs text-text-3"
              onClick={() => setEntry(false)}
            >
              Close
            </button>
          </div>
          <MealScanReview
            key={editing?.id ?? "new"}
            inline
            initialMeal={
              editing
                ? {
                    id: editing.id,
                    mealName: editing.meal_name,
                    foods: editing.foods,
                  }
                : undefined
            }
            onSaved={() => {
              setEntry(false);
              setEditing(null);
            }}
          />
        </div>
      )}
    </section>
  );
}
