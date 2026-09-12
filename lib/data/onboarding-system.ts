import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSystemProposal, type SystemProposal } from "@/lib/onboarding/system-schema";
import { findExistingSystemMatches, type ExistingSystemMatch } from "@/lib/onboarding/system-existing";

export type AutoBuildSession={
  id:string;
  status:string;
  proposalStatus:string;
  proposal:SystemProposal;
  activationState:{overall:string;steps:Record<string,string>};
  activatedRecords:Record<string,unknown>;
  existingMatches:ExistingSystemMatch[];
};

export async function getAutoBuildSession(sessionId:string):Promise<AutoBuildSession|null>{
  if(!sessionId)return null;
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return null;
  const [{data,error},goalsRes,habitsRes]=await Promise.all([
    supabase.from("onboarding_sessions").select("id,user_id,status,proposal_status,generated_plan,activation_state,activated_records").eq("id",sessionId).eq("user_id",user.id).maybeSingle(),
    supabase.from("goals").select("id,title,status").eq("user_id",user.id).eq("status","active"),
    supabase.from("habits").select("id,title").eq("user_id",user.id),
  ]);
  if(error||!data||!isSystemProposal(data.generated_plan))return null;
  const proposal=data.generated_plan as SystemProposal;
  const state=data.activation_state&&typeof data.activation_state==="object"?data.activation_state as any:{};
  const existingMatches=findExistingSystemMatches(proposal,(goalsRes.data??[]).map(row=>({id:String(row.id),title:String(row.title),status:String(row.status??"active")})),(habitsRes.data??[]).map(row=>({id:String(row.id),title:String(row.title)})));
  return {id:String(data.id),status:String(data.status),proposalStatus:String(data.proposal_status),proposal,activationState:{overall:typeof state.overall==="string"?state.overall:"idle",steps:state.steps&&typeof state.steps==="object"?state.steps:{}},activatedRecords:data.activated_records&&typeof data.activated_records==="object"?data.activated_records:{},existingMatches};
}
