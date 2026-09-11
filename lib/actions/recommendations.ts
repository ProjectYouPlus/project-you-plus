"use server";

import { revalidatePath } from "next/cache";
import { executeRecommendation, updateRecommendationState } from "@/lib/ai/recommendations";
type UserRecommendationState = "accepted" | "dismissed";

export async function setRecommendationState(id:string,state:UserRecommendationState){
  if(!["accepted","dismissed"].includes(state)) return {error:"Choose a valid recommendation state."};
  try{
    const recommendation=await updateRecommendationState(id,state);
    revalidatePath("/dashboard");revalidatePath("/coach");
    return {error:null,recommendation};
  }catch(error){return {error:error instanceof Error?error.message:"Could not update recommendation."};}
}

export async function confirmAndExecuteRecommendation(id:string){try{const recommendation=await executeRecommendation(id);revalidatePath("/dashboard");revalidatePath("/coach");revalidatePath("/tasks");revalidatePath("/calendar");revalidatePath("/goals");return{error:null,recommendation};}catch(error){return{error:error instanceof Error?error.message:"Could not execute recommendation."};}}
