"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Food = { name: string; portion: number; unit: string; calories: number; protein: number; carbs: number; fat: number };

const INITIAL: Food[] = [
  { name: "Grilled chicken", portion: 6, unit: "oz", calories: 280, protein: 52, carbs: 0, fat: 6 },
  { name: "White rice", portion: 1, unit: "cup", calories: 205, protein: 4, carbs: 45, fat: 0 },
  { name: "Black beans", portion: 0.5, unit: "cup", calories: 114, protein: 8, carbs: 20, fat: 0 },
  { name: "Avocado", portion: 0.25, unit: "whole", calories: 80, protein: 1, carbs: 4, fat: 7 },
];

export function MealScanReview() {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [foods, setFoods] = useState(INITIAL);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => foods.reduce((sum, food) => ({
    calories: sum.calories + food.calories,
    protein: sum.protein + food.protein,
    carbs: sum.carbs + food.carbs,
    fat: sum.fat + food.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [foods]);

  function chooseFile(file?: File) {
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setAnalyzed(true);
  }

  function changePortion(index: number, delta: number) {
    setFoods((items) => items.map((food, i) => {
      if (i !== index) return food;
      const next = Math.max(0.25, Math.round((food.portion + delta) * 4) / 4);
      const ratio = next / food.portion;
      return {
        ...food,
        portion: next,
        calories: Math.round(food.calories * ratio),
        protein: Math.round(food.protein * ratio),
        carbs: Math.round(food.carbs * ratio),
        fat: Math.round(food.fat * ratio),
      };
    }));
  }

  function save() {
    setSaving(true);
    window.localStorage.setItem("project-you-last-meal", JSON.stringify({ foods, totals, savedAt: new Date().toISOString() }));
    setTimeout(() => {
      router.push("/health?mealSaved=1");
      router.refresh();
    }, 350);
  }

  if (!analyzed) {
    return (
      <div className="space-y-4">
        <label className="py-accent-card flex min-h-[300px] cursor-pointer flex-col items-center justify-center p-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-[32px] text-accent-text">◎</span>
          <span className="mt-5 text-[20px] font-semibold text-text-1">Take a photo of your meal</span>
          <span className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-text-2">Project You+ will identify the foods, estimate portions, and build a macro estimate for you to review.</span>
          <span className="py-button-primary mt-5">Open camera</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
        </label>
        <p className="m-0 px-2 text-center text-[11.5px] leading-relaxed text-text-3">Estimates can be imperfect. You always review and edit before anything is saved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="py-card overflow-hidden">
        <div className="relative h-[190px] bg-[var(--surface-2)]">
          {imageUrl ? <img src={imageUrl} alt="Meal preview" className="h-full w-full object-cover" /> : null}
          <span className="absolute right-3 top-3 rounded-full bg-[rgba(5,5,9,.72)] px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">92% confidence</span>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-accent-text">AI analysis</div>
          <div className="mt-1 text-[18px] font-semibold text-text-1">Chicken rice bowl</div>
          <div className="mt-1 text-[12px] text-text-2">Review portions before saving.</div>
        </div>
      </section>

      <section className="py-card px-4">
        {foods.map((food, index) => (
          <div key={food.name} className="py-list-row">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-text-1">{food.name}</div>
              <div className="mt-0.5 text-[11.5px] text-text-2">{food.calories} kcal · {food.protein}g protein</div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-[var(--surface-2)] p-1">
              <button onClick={() => changePortion(index, -0.25)} className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-text-2">−</button>
              <span className="min-w-[50px] text-center text-[11.5px] font-semibold text-text-1">{food.portion} {food.unit}</span>
              <button onClick={() => changePortion(index, 0.25)} className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-text-2">+</button>
            </div>
          </div>
        ))}
      </section>

      <section className="py-accent-card p-[18px]">
        <div className="flex items-end justify-between">
          <div>
            <div className="py-eyebrow text-accent-text">Estimated total</div>
            <div className="mt-1 text-[30px] font-bold tracking-[-0.04em] text-text-1">{totals.calories} kcal</div>
          </div>
          <div className="text-right text-[11.5px] leading-5 text-text-2">P {totals.protein}g<br />C {totals.carbs}g · F {totals.fat}g</div>
        </div>
        <div className="mt-4 rounded-[14px] bg-[rgba(255,255,255,.04)] p-3 text-[12px] leading-relaxed text-text-2">After this meal you&apos;ll be at roughly <span className="font-semibold text-text-1">2,319 kcal</span> and <span className="font-semibold text-text-1">193g protein</span> today.</div>
      </section>

      <button onClick={save} disabled={saving} className="py-button-primary w-full disabled:opacity-60">{saving ? "Saving macros…" : "Save meal & update today"}</button>
      <button onClick={() => setAnalyzed(false)} className="py-button-secondary w-full">Use another photo</button>
    </div>
  );
}
