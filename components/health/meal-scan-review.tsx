"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveNutritionMeal, type NutritionFood } from "@/lib/actions/nutrition";

type AnalysisResult = {
  mealName: string;
  confidence: number;
  foods: NutritionFood[];
  note: string;
};

type Stage = "capture" | "analyzing" | "review";

const EMPTY_FOOD: NutritionFood = {
  name: "",
  portion: 1,
  unit: "serving",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

export function MealScanReview({
  inline = false,
  initialMeal,
  onSaved,
}: {
  inline?: boolean;
  initialMeal?: { id: string; mealName: string; foods: NutritionFood[] };
  onSaved?: () => void;
} = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>(initialMeal ? "review" : "capture");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [mealName, setMealName] = useState(initialMeal?.mealName ?? "Meal");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [foods, setFoods] = useState<NutritionFood[]>(initialMeal?.foods ?? []);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"openai" | "manual">("manual");
  const [isSaving, setIsSaving] = useState(false);

  const totals = useMemo(
    () =>
      foods.reduce(
        (sum, food) => ({
          calories: sum.calories + Number(food.calories || 0),
          protein: sum.protein + Number(food.protein || 0),
          carbs: sum.carbs + Number(food.carbs || 0),
          fat: sum.fat + Number(food.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [foods],
  );

  async function chooseFile(file?: File) {
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setError("Choose a JPEG, PNG, or WEBP meal photo.");
      return;
    }
    if (file.size > 14 * 1024 * 1024) {
      setError("That photo is too large. Choose a photo under 14 MB.");
      return;
    }

    try {
      const dataUrl = await compressImage(file);
      setImageDataUrl(dataUrl);
      setStage("analyzing");
      const response = await fetch("/api/nutrition-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = (await response.json()) as {
        result?: AnalysisResult;
        mode?: "openai";
        error?: string;
        code?: string;
      };
      if (!response.ok || !data.result)
        throw new Error(
          data.error || "Nutrition AI could not analyze this image.",
        );
      setMealName(data.result.mealName || "Meal");
      setConfidence(data.result.confidence);
      setNote(data.result.note || "Review the estimate before saving.");
      setFoods(data.result.foods || []);
      setSource("openai");
      setStage("review");
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Nutrition AI could not analyze this image.",
      );
      setMealName("Meal");
      setFoods([{ ...EMPTY_FOOD }]);
      setConfidence(null);
      setNote(
        "Enter the foods manually or retry the photo. Nothing will be saved until you confirm it.",
      );
      setSource("manual");
      setStage("review");
    }
  }

  function updateFood(
    index: number,
    key: keyof NutritionFood,
    value: string | number,
  ) {
    setFoods((current) =>
      current.map((food, i) =>
        i === index
          ? {
              ...food,
              [key]:
                key === "name" || key === "unit"
                  ? value
                  : Math.max(0, Number(value) || 0),
            }
          : food,
      ),
    );
  }

  function removeFood(index: number) {
    setFoods((current) => current.filter((_, i) => i !== index));
  }

  function reset() {
    setStage("capture");
    setImageDataUrl(null);
    setMealName("Meal");
    setConfidence(null);
    setFoods([]);
    setNote("");
    setError(null);
    setSource("manual");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function save() {
    if (!foods.length || foods.some((food) => !food.name.trim())) {
      setError("Name each food before saving.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const result = await saveNutritionMeal({
        mealName,
        foods,
        source,
        id: initialMeal?.id,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (!inline) router.push("/health?mealSaved=1");
      onSaved?.();
      reset();
      router.refresh();
    } catch {
      setError("Could not save this meal. Please retry.");
    } finally {
      setIsSaving(false);
    }
  }

  if (stage === "capture") {
    return (
      <div className="space-y-4">
        <label role="button" tabIndex={0} aria-label="Open camera" onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }} className="py-glass-hero py-pressable flex min-h-[330px] cursor-pointer flex-col items-center justify-center p-7 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/10 bg-white/[.06] text-[28px] text-white">
            ◎
          </span>
          <span className="mt-5 text-[24px] font-semibold tracking-[-.03em] text-white">
            Photograph your meal
          </span>
          <span className="mt-2 max-w-[310px] text-[13px] leading-relaxed text-[#C9C5D4]">
            Nutrition AI identifies visible foods and estimates portions and
            macros. You review every result before it becomes part of your day.
          </span>
          <span className="py-liquid-button mt-6">Open camera</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
        </label>
        <label role="button" tabIndex={0} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.querySelector("input")?.click();
          }
        }} className="py-button-secondary flex min-h-[44px] cursor-pointer items-center justify-center">
          Choose photo
          <input
            aria-label="Choose meal photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
        </label>
        <button
          onClick={() => {
            setFoods([{ ...EMPTY_FOOD }]);
            setMealName("Meal");
            setSource("manual");
            setStage("review");
          }}
          className="py-button-secondary w-full"
        >
          Enter meal manually
        </button>
        {error && (
          <p className="m-0 px-2 text-center text-[12px] text-danger">
            {error}
          </p>
        )}
        <p className="m-0 px-3 text-center text-[11px] leading-relaxed text-text-3">
          Photo-based nutrition is an estimate, not a laboratory measurement.
          Hidden oils, sauces, ingredients, and portion depth can change the
          result.
        </p>
      </div>
    );
  }

  if (stage === "analyzing") {
    return (
      <section className="py-glass-hero flex min-h-[390px] flex-col items-center justify-center p-7 text-center">
        {imageDataUrl && (
          <img
            src={imageDataUrl}
            alt="Meal being analyzed"
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}
        <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/20 backdrop-blur-xl">
          <span className="py-pulse-dot h-3 w-3 rounded-full bg-accent-2" />
        </div>
        <h2 className="relative z-10 m-0 mt-5 text-[23px] font-semibold tracking-[-.03em] text-white">
          Nutrition AI is reading your plate
        </h2>
        <p className="relative z-10 m-0 mt-2 max-w-[300px] text-[12px] leading-relaxed text-[#C9C5D4]">
          Identifying foods, estimating portions, and building a reviewable
          macro estimate.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {imageDataUrl && (
        <section className="py-glass-soft overflow-hidden">
          <div className="relative h-[210px] bg-[var(--surface-2)]">
            <img
              src={imageDataUrl}
              alt="Meal preview"
              className="h-full w-full object-cover"
            />
            {confidence != null && (
              <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10.5px] font-semibold text-white backdrop-blur-xl">
                {Math.round(confidence * 100)}% visual confidence
              </span>
            )}
          </div>
          <div className="p-4">
            <input
              value={mealName}
              onChange={(event) => setMealName(event.target.value)}
              className="w-full bg-transparent text-[21px] font-semibold tracking-[-.025em] text-text-1 outline-none"
              aria-label="Meal name"
            />
            <p className="m-0 mt-1.5 text-[11.5px] leading-relaxed text-text-3">
              {note}
            </p>
          </div>
        </section>
      )}

      {!imageDataUrl && (
        <section className="py-glass-soft p-4">
          <h2 className="m-0 text-[19px] font-semibold text-text-1">
            Manual nutrition entry
          </h2>
          <input
            value={mealName}
            onChange={(event) => setMealName(event.target.value)}
            className="py-input mt-3"
            aria-label="Meal name"
          />
        </section>
      )}

      {error && (
        <div className="rounded-[14px] border border-danger/20 bg-danger/10 px-4 py-3 text-[11.5px] leading-relaxed text-danger">
          {error}
        </div>
      )}

      <section className="py-glass-soft overflow-hidden px-4">
        {foods.map((food, index) => (
          <div
            key={index}
            className="border-t border-white/[.06] py-4 first:border-0"
          >
            <div className="flex items-center gap-2">
              <input
                aria-label={`Food ${index + 1} name`}
                value={food.name}
                onChange={(event) =>
                  updateFood(index, "name", event.target.value)
                }
                placeholder="Food"
                className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-text-1 outline-none"
              />
              <button
                onClick={() => removeFood(index)}
                className="text-[10.5px] font-medium text-text-3"
              >
                Remove
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-[9.5px] text-text-3">
                Portion
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={food.portion}
                  onChange={(event) =>
                    updateFood(index, "portion", event.target.value)
                  }
                  className="py-input mt-1 min-h-[40px] py-2 text-[12px]"
                />
              </label>
              <label className="text-[9.5px] text-text-3">
                Unit
                <input
                  value={food.unit}
                  onChange={(event) =>
                    updateFood(index, "unit", event.target.value)
                  }
                  className="py-input mt-1 min-h-[40px] py-2 text-[12px]"
                />
              </label>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {(
                [
                  ["calories", "kcal"],
                  ["protein", "P"],
                  ["carbs", "C"],
                  ["fat", "F"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-[9px] text-text-3">
                  {label}
                  <input
                    type="number"
                    min="0"
                    step={key === "calories" ? "1" : "0.1"}
                    value={food[key]}
                    onChange={(event) =>
                      updateFood(index, key, event.target.value)
                    }
                    className="mt-1 w-full rounded-[11px] border border-white/[.07] bg-white/[.035] px-2 py-2 text-[11px] text-text-1 outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => setFoods((current) => [...current, { ...EMPTY_FOOD }])}
          className="mb-4 mt-1 text-[11.5px] font-semibold text-accent-text"
        >
          + Add another food
        </button>
      </section>

      <section className="py-glass-hero p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[12px] text-[#C9C5D4]">Estimated meal</div>
            <div className="mt-1 text-[34px] font-bold tracking-[-.04em] text-white">
              {Math.round(totals.calories)}{" "}
              <span className="text-[14px] font-medium text-[#C9C5D4]">
                kcal
              </span>
            </div>
          </div>
          <div className="text-right text-[11.5px] leading-5 text-[#C9C5D4]">
            P {round(totals.protein)}g<br />C {round(totals.carbs)}g · F{" "}
            {round(totals.fat)}g
          </div>
        </div>
        <p className="m-0 mt-3 text-[11px] leading-relaxed text-[#AAA4B7]">
          Saving adds this meal to your Diet Tracker history and makes it
          available to Dashboard and Coach.
        </p>
      </section>

      <button
        onClick={save}
        disabled={isSaving || !foods.length}
        className="py-liquid-button w-full disabled:opacity-50"
      >
        {isSaving ? "Saving nutrition…" : "Save meal"}
      </button>
      <button onClick={reset} className="py-button-secondary w-full">
        {imageDataUrl ? "Use another photo" : "Cancel"}
      </button>
    </div>
  );
}

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Could not read this photo. Try another image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    bitmap.close();
  }
}
function round(value: number) {
  return Math.round(value * 10) / 10;
}
