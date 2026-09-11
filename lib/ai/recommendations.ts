import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NewRecommendation, Recommendation, RecommendationAgent, RecommendationConfidence, RecommendationDomain, RecommendationEntity, RecommendationEvidence, RecommendationState } from "@/lib/types/recommendations";

const SELECT="id,domain,observation,evidence,reason,suggested_action,expected_impact,confidence,status,related_entities,source_agent,action_type,action_payload,created_at,updated_at,accepted_at,dismissed_at,completed_at";
type Row={id:string;domain:RecommendationDomain;observation:string;evidence:RecommendationEvidence[];reason:string;suggested_action:string;expected_impact:string|null;confidence:RecommendationConfidence;status:RecommendationState;related_entities:RecommendationEntity[];source_agent:RecommendationAgent;action_type:string|null;action_payload:Record<string,unknown>|null;created_at:string;updated_at:string;accepted_at:string|null;dismissed_at:string|null;completed_at:string|null};

export async function listRecommendations(options:{state?:RecommendationState;limit?:number}={}):Promise<Recommendation[]>{
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Not signed in.");
 let query=supabase.from("ai_recommendations").select(SELECT).order("created_at",{ascending:false}).limit(Math.min(50,Math.max(1,options.limit??20)));if(options.state)query=query.eq("status",options.state);
 const {data,error}=await query;if(error)throw new Error(error.message);return(data??[]).map(row=>mapRow(row as Row));
}

export async function listActiveRecommendations(options:{domains?:RecommendationDomain[];limit?:number}={}):Promise<Recommendation[]>{
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Not signed in.");
 let query=supabase.from("ai_recommendations").select(SELECT).in("status",["pending","accepted"]).order("created_at",{ascending:false}).limit(Math.min(20,Math.max(1,options.limit??8)));if(options.domains?.length)query=query.in("domain",options.domains);
 const{data,error}=await query;if(error)throw new Error(error.message);return(data??[]).map(row=>mapRow(row as Row));
}

export async function createRecommendation(input:NewRecommendation):Promise<Recommendation>{
 validate(input);const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Not signed in.");
 if(input.dedupeKey){const{data:existing,error:existingError}=await supabase.from("ai_recommendations").select(SELECT).eq("dedupe_key",input.dedupeKey).in("status",["pending","accepted"]).limit(1).maybeSingle();if(existingError)throw new Error(existingError.message);if(existing)return mapRow(existing as Row);}
 const record={user_id:user.id,domain:input.domain,observation:input.observation,evidence:input.supportingEvidence,reason:input.reasonItMatters,suggested_action:input.suggestedAction,expected_impact:input.expectedImpact,confidence:input.confidence,related_entities:input.relatedEntities,source_agent:input.sourceAgent??(input.domain==="general"?"coach":input.domain),action_type:input.actionType??input.source,action_payload:input.actionPayload??{},requires_confirmation:true,dedupe_key:input.dedupeKey??null};
 const {data,error}=await supabase.from("ai_recommendations").insert(record).select(SELECT).maybeSingle();if(!error&&data)return mapRow(data as Row);
 if(error?.code==="23505"&&input.dedupeKey){const{data:existing,error:existingError}=await supabase.from("ai_recommendations").select(SELECT).eq("dedupe_key",input.dedupeKey).in("status",["pending","accepted"]).single();if(existingError)throw new Error(existingError.message);return mapRow(existing as Row);}
 throw new Error(error?.message??"Recommendation was not created.");
}

export async function updateRecommendationState(id:string,state:Extract<RecommendationState,"accepted"|"dismissed">):Promise<Recommendation>{
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Not signed in.");const {data,error}=await supabase.rpc("transition_ai_recommendation",{p_id:id,p_target:state});if(error)throw new Error(error.message);const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error("Recommendation not found.");return mapRow(row as Row);
}

export async function executeRecommendation(id:string):Promise<Recommendation>{
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Not signed in.");const{data,error}=await supabase.rpc("execute_ai_recommendation",{p_id:id});if(error)throw new Error(error.message);const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error("Recommendation not found.");return mapRow(row as Row);
}

function validate(input:NewRecommendation){if(!input.observation.trim()||!input.reasonItMatters.trim()||!input.suggestedAction.trim()||!input.expectedImpact.trim())throw new Error("Recommendation fields are required.");if(input.supportingEvidence.length>30||input.relatedEntities.length>20)throw new Error("Recommendation references exceed the supported limit.");}
function mapRow(row:Row):Recommendation{return{id:row.id,domain:row.domain,observation:row.observation,supportingEvidence:row.evidence??[],reasonItMatters:row.reason,suggestedAction:row.suggested_action,expectedImpact:row.expected_impact??"",confidence:row.confidence,state:row.status,relatedEntities:row.related_entities??[],source:sourceFrom(row.action_type),sourceAgent:row.source_agent??"coach",actionType:row.action_type??"advice.follow",actionPayload:row.action_payload??{},createdAt:row.created_at,updatedAt:row.updated_at,acceptedAt:row.accepted_at,dismissedAt:row.dismissed_at,completedAt:row.completed_at}}
function sourceFrom(value:string|null):Recommendation["source"]{return value==="weekly_review"||value==="progress"||value==="system"?value:"coach"}
