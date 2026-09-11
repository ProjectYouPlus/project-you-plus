export type NutritionFood = {
  name: string;
  portion: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export function validateFoods(value: unknown): NutritionFood[] {
  if (!Array.isArray(value) || !value.length || value.length > 20)
    throw new Error("Add between 1 and 20 foods.");
  return value.map((food) => {
    if (
      !food ||
      typeof food !== "object" ||
      typeof food.name !== "string" ||
      !food.name.trim() ||
      typeof food.unit !== "string" ||
      !food.unit.trim()
    )
      throw new Error("Name each food and serving unit.");
    for (const key of ["portion", "calories", "protein", "carbs", "fat"]) {
      if (
        typeof food[key] !== "number" ||
        !Number.isFinite(food[key]) ||
        food[key] < 0 ||
        food[key] > 20000
      )
        throw new Error("Enter valid amounts and macros.");
    }
    if (food.portion <= 0)
      throw new Error("Serving size must be greater than zero.");
    return {
      ...food,
      name: food.name.trim().slice(0, 100),
      unit: food.unit.trim().slice(0, 30),
    };
  });
}
export function macroTotals(foods: NutritionFood[]) {
  return foods.reduce(
    (sum, food) => ({
      calories: sum.calories + food.calories,
      protein: sum.protein + food.protein,
      carbs: sum.carbs + food.carbs,
      fat: sum.fat + food.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
