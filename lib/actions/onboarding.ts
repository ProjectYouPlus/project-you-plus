"use server";

import { redirect } from "next/navigation";
import * as core from "./onboarding-core";
import { generateAutoBuiltSystem } from "@/lib/actions/onboarding-system";
import type { OnboardingProposal } from "@/lib/onboarding/schema";
export type { OnboardingSessionView } from "./onboarding-core";

type LegacyGenerationResult =
  | { ok:false; error:string }
  | { ok:true; proposal:OnboardingProposal; generationState:{overall:string;modules:Record<string,string>}; usedFallback?:boolean };

export async function getOrCreateOnboardingSession(mode:Parameters<typeof core.getOrCreateOnboardingSession>[0]="initial"){
  return core.getOrCreateOnboardingSession(mode);
}
export async function saveOnboardingProgress(input:Parameters<typeof core.saveOnboardingProgress>[0]){
  return core.saveOnboardingProgress(input);
}
export async function draftOnboardingGoals(input:Parameters<typeof core.draftOnboardingGoals>[0]){
  return core.draftOnboardingGoals(input);
}
export async function saveOnboardingProposal(input:Parameters<typeof core.saveOnboardingProposal>[0]){
  return core.saveOnboardingProposal(input);
}
export async function activateOnboardingSystem(sessionId:string){
  return core.activateOnboardingSystem(sessionId);
}
export async function recordOnboardingEvent(event:string,metadata:Record<string,unknown>={}){
  return core.recordOnboardingEvent(event,metadata);
}

/** The questionnaire stays unchanged; only its generation handoff routes into Auto-Build v3. */
export async function generateOnboardingPlan(sessionId:string):Promise<LegacyGenerationResult>{
  const result=await generateAutoBuiltSystem(sessionId);
  if(!("proposal" in result))return {ok:false,error:result.error};
  redirect(`/onboarding/system?session=${encodeURIComponent(sessionId)}`);
}
