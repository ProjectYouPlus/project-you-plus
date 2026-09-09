import { NextResponse } from "next/server";
import { callOpenAIStructuredVision, isOpenAIConfigured } from "@/lib/ai/openai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export type NutritionAIResult = {
  mealName: string;
  confidence: number;
  foods: Array<{
    name: string;
    portion: number;
    unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  note: string;
};

const NUTRITION_SCHEMA = {
  type: "object",
  properties: {
    mealName: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    foods: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          portion: { type: "number", minimum: 0 },
          unit: { type: "string" },
          calories: { type: "number", minimum: 0 },
          protein: { type: "number", minimum: 0 },
          carbs: { type: "number", minimum: 0 },
          fat: { type: "number", minimum: 0 },
        },
        required: ["name", "portion", "unit", "calories", "protein", "carbs", "fat"],
        additionalProperties: false,
      },
    },
    note: { type: "string" },
  },
  required: ["mealName", "confidence", "foods", "note"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again to use Nutrition AI." }, { status: 401 });

  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: "Nutrition AI cloud vision is not configured yet.", code: "AI_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { imageDataUrl?: string };
    const imageDataUrl = body.imageDataUrl?.trim();
    if (!imageDataUrl || !/^data:image\/(png|jpe?g|webp);base64,/i.test(imageDataUrl)) {
      return NextResponse.json({ error: "Choose a JPEG, PNG, or WEBP meal photo." }, { status: 400 });
    }
    if (imageDataUrl.length > 20_000_000) {
      return NextResponse.json({ error: "That image is too large. Try a smaller photo." }, { status: 413 });
    }

    const result = await callOpenAIStructuredVision<NutritionAIResult>({
      schemaName: "project_you_nutrition_analysis",
      schema: NUTRITION_SCHEMA as unknown as Record<string, unknown>,
      imageDataUrl,
      instructions: "You are Nutrition AI inside Project You+. Analyze meal photos for general nutrition logging. Identify only food you can reasonably see. Estimate portions and macros conservatively. Do not pretend visual estimates are exact, diagnose health conditions, or make medical claims. Return values for the entire estimated portion of each listed food.",
      prompt: "Analyze this meal photo. Identify the foods, estimate visible portions, calories, protein, carbohydrates, and fat for each item. Give the meal a short natural name. Confidence should reflect how clear the photo and portions are. The note should briefly call out the biggest uncertainty, such as cooking oil, sauce, hidden ingredients, or portion depth.",
      maxOutputTokens: 1400,
    });

    return NextResponse.json({ result: sanitize(result), mode: "openai" });
  } catch (error) {
    console.error("Nutrition AI analysis error:", error);
    return NextResponse.json({ error: "Nutrition AI could not analyze that photo. You can retry or enter the meal manually." }, { status: 500 });
  }
}

function sanitize(result: NutritionAIResult): NutritionAIResult {
  return {
    mealName: String(result.mealName || "Meal").slice(0, 80),
    confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0)),
    foods: (result.foods ?? []).slice(0, 12).map((food) => ({
      name: String(food.name || "Food").slice(0, 80),
      portion: round(Math.max(0.01, Number(food.portion) || 1), 2),
      unit: String(food.unit || "serving").slice(0, 24),
      calories: Math.round(Math.max(0, Number(food.calories) || 0)),
      protein: round(Math.max(0, Number(food.protein) || 0), 1),
      carbs: round(Math.max(0, Number(food.carbs) || 0), 1),
      fat: round(Math.max(0, Number(food.fat) || 0), 1),
    })),
    note: String(result.note || "Review the estimate before saving.").slice(0, 240),
  };
}

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
