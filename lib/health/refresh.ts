import { revalidatePath } from "next/cache";
export function refreshHealthViews() {
  for (const path of [
    "/health",
    "/fitness",
    "/supplements",
    "/dashboard",
    "/api/dashboard-scores",
    "/coach",
    "/review",
    "/progress",
    "/today",
  ])
    revalidatePath(path);
}
