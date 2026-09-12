import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSystemProposal, type SystemProposal } from "@/lib/onboarding/system-schema";

export type AutoBuildSession={
  id:string;
  status:string;
  proposalStatus:string;
  proposal:SystemProposal;
  activationState:{overall:string;steps:Record<string,string>};
  activatedRecords:Record<string,unknown>;
};

export async function getAutoBuildSession(sessionId:string):Promise<AutoBuildSession|null>{
  if(!sessionId)return null;
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return null;
  const {data,error}=await supabase.from("onboarding_sessions").select("id,user_id,status,proposal_status,generated_plan,activation_state,activated_records").eq("id",sessionId).eq("user_id",user.id).maybeSingle();
  if(error||!data||!isSystemProposal(data.generated_plan))return null;
  const state=data.activation_state&&typeof data.activation_state==="object"?data.activation_state as any:{};
  return {id:String(data.id),status:String(data.status),proposalStatus:String(data.proposal_status),proposal:data.generated_plan as SystemProposal,activationState:{overall:typeof state.overall==="string"?state.overall:"idle",steps:state.steps&&typeof state.steps==="object"?state.steps:{}},activatedRecords:data.activated_records&&typeof data.activated_records==="object"?data.activated_records:{}};
}
