"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type NutritionFood = {
  name: string;
  portion: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export async function saveNutritionMeal(input: { mealName: string; foods: NutritionFood[]; source?: string }) {
  const foods = Array.isArray(input.foods) ? input.foods.slice(0, 20) : [];
  if (!foods.length) return { error: "Add at least one food before saving." };

  const totals = foods.reduce((sum, food) => ({
    calories: sum.calories + safe(food.calories),
    protein: sum.protein + safe(food.protein),
    carbs: sum.carbs + safe(food.carbs),
    fat: sum.fat + safe(food.fat),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to save nutrition." };

  const { error } = await supabase.from("nutrition_logs").insert({
    user_id: user.id,
    meal_name: String(input.mealName || "Meal").slice(0, 100),
    calories: Math.round(totals.calories),
    protein_g: round(totals.protein),
    carbs_g: round(totals.carbs),
    fat_g: round(totals.fat),
    foods: foods.map((food) => ({
      name: String(food.name || "Food").slice(0, 100),
      portion: safe(food.portion),
      unit: String(food.unit || "serving").slice(0, 30),
      calories: Math.round(safe(food.calories)),
      protein: round(safe(food.protein)),
      carbs: round(safe(food.carbs)),
      fat: round(safe(food.fat)),
    })),
    source: input.source === "openai" ? "nutrition_ai" : "manual",
  });

  if (error) return { error: error.message };
  revalidatePath("/health");
  revalidatePath("/dashboard");
  revalidatePath("/coach");
  return { error: null };
}

function safe(value: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
function round(value: number) { return Math.round(value * 10) / 10; }
