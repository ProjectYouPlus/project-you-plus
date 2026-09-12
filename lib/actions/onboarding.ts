"use server";

import { redirect } from "next/navigation";
import { generateAutoBuiltSystem } from "@/lib/actions/onboarding-system";
import type { OnboardingProposal } from "@/lib/onboarding/schema";

export {
  activateOnboardingSystem,
  draftOnboardingGoals,
  getOrCreateOnboardingSession,
  recordOnboardingEvent,
  saveOnboardingProgress,
  saveOnboardingProposal,
} from "./onboarding-core";
export type { OnboardingSessionView } from "./onboarding-core";

type LegacyGenerationResult =
  | { ok:false; error:string }
  | { ok:true; proposal:OnboardingProposal; generationState:{overall:string;modules:Record<string,string>}; usedFallback?:boolean };

/**
 * The existing questionnaire still owns onboarding. Only its generation handoff changes:
 * answers are passed into the shared-context Auto-Build engine, then the user is routed
 * to the richer proposal review surface. Failure keeps the user in the existing flow.
 */
export async function generateOnboardingPlan(sessionId:string):Promise<LegacyGenerationResult>{
  const result=await generateAutoBuiltSystem(sessionId);
  if(!result.ok)return result;
  redirect(`/onboarding/system?session=${encodeURIComponent(sessionId)}`);
  return {ok:true,proposal:result.proposal as unknown as OnboardingProposal,generationState:result.generationState,usedFallback:result.usedFallback};
}
