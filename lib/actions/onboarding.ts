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

/** The questionnaire stays unchanged; only its generation handoff routes into Auto-Build v3. */
export async function generateOnboardingPlan(sessionId:string):Promise<LegacyGenerationResult>{
  const result=await generateAutoBuiltSystem(sessionId);
  if(!("proposal" in result))return {ok:false,error:result.error};
  redirect(`/onboarding/system?session=${encodeURIComponent(sessionId)}`);
}
