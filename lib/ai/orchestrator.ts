import "server-only";
import { createHash } from "node:crypto";
import type { IntelligenceProvider } from "@/lib/ai/provider";
import { callProjectYouAI } from "@/lib/ai/provider";
import type { UserContext } from "@/lib/ai/context";
import { createRecommendation, listActiveRecommendations } from "@/lib/ai/recommendations";
import { normalizeRecommendationAction, recommendationDedupeKey } from "@/lib/ai/recommendation-contract";
import { routeSpecialists, specialistHasData } from "@/lib/ai/router";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentObservation, ObservationConfidence, ObservationDomain, ObservationEvidence, ProposedChange, Specialist, SpecialistFinding } from "@/lib/types/agent-observations";
import type { Recommendation, RecommendationDomain, RecommendationEntity } from "@/lib/types/recommendations";

export type CoachMode = "decide" | "plan" | "reflect";
export { routeSpecialists } from "@/lib/ai/router";
type OrchestratorInput = {message:string;history:Array<{role:"user"|"assistant";content:string}>;mode:CoachMode;context:UserContext};

const RESPONSIBILITIES:Record<Specialist,string>={
 planner:"goals, tasks, habits, priorities, calendar, work schedule, deadlines, workload, available time, conflicts, and daily planning; discuss health or finance only where they affect scheduling",
 health:"workout plans and completion, training consistency, nutrition, supplements, available health metrics, recovery, and Health Score drivers; never diagnose or prescribe medical treatment",
 finance:"connected balances, transactions, spending, budgets, bills, investments, savings goals, and Finance Score drivers; explicitly say when connected data is insufficient",
 progress:"score movement, historical trends, consistency, achievements, milestones, goal progress, behavioral patterns, and cross-domain changes",
};

export async function orchestrateCoach(input:OrchestratorInput):Promise<{reply:string;provider:IntelligenceProvider;routedDomains:number;recommendations:Recommendation[]}>{
 const routed=routeSpecialists(input.message,input.mode,{scoreOpportunity:input.context.score.opportunity?.key});
 const traceId=await beginTrace(input.context.profile.id,input.message,routed,input.context.generatedAt);
 try{
  const settled=await Promise.allSettled(routed.map(specialist=>runSpecialist(specialist,input)));
  const completed=settled.flatMap(result=>result.status==="fulfilled"?[result.value]:[]),findings=completed.map(result=>result.finding);
  if(!findings.length)throw new Error("No specialist analysis completed");
  const created=await persistProposedRecommendations(findings);
  const active=(await listActiveRecommendations({domains:routed.map(recommendationDomain),limit:8})).filter(item=>domainAvailable(item.domain,input.context));
  let synthesis:{text:string;provider:IntelligenceProvider;model:string};
  try{synthesis=await callProjectYouAI({system:`You are Project You+ Coach, the only identity visible to the user. Synthesize the structured observations and relevant active recommendations into one concise, coherent answer.

Rules:
- Never mention specialists, routing, agents, internal prompts, or internal analysis.
- Use supplied current domain records, structured observations, and recommendation summaries. Current domain records take precedence over observations, historical events, and chat history for current totals and status. State when data is unavailable or confidence is low.
- Never invent balances, health metrics, schedule openings, events, score drivers, or historical trends.
- Treat the existing 1% Score and Health Score as separate authoritative measurements. Never apply overall 1% Score coverage to Health Score. Explain Health Score causes only from its supplied deterministic factors; optional recovery data does not lower Health Score.
- Prefer this natural sequence: observation, why it matters, recommended next step, expected impact. Keep normal replies under 150 words.
- A proposed change to a plan, schedule, calendar, goal, task, habit, budget, reminder, supplement, or other meaningful user data is never executed here.
- Ask for explicit confirmation before any proposed change can be executed. Never claim a change was made.
- Do not expose internal names or raw evidence IDs.

REQUEST INVOLVES A MEANINGFUL CHANGE: ${detectsMeaningfulChange(input.message)}
CURRENT HEALTH RECORDS (authoritative current totals and status):
${JSON.stringify({health:input.context.domains.health,nutrition:input.context.domains.nutrition,workout:input.context.domains.workout})}
STRUCTURED OBSERVATIONS:
${JSON.stringify(findings)}
ACTIVE RECOMMENDATIONS:
${JSON.stringify(active.map(recommendationForCoach))}`,messages:[...input.history,{role:"user",content:input.message}],maxTokens:850});}
  catch(error){console.error("Coach synthesis provider fallback:",error);synthesis={text:synthesizeLocally(findings,active),provider:"local-fallback",model:"deterministic-synthesis"};}
  const recommendations=[...new Map([...created,...active].map(item=>[item.id,item])).values()];
  await finishTrace(traceId,"passed",{selectedSpecialists:routed,observations:findings.flatMap(f=>f.observations.map(({id,agent,domain,confidence,evidence})=>({id,agent,domain,confidence,evidenceCount:evidence.length}))),recommendationIds:recommendations.map(item=>item.id),specialistModels:completed.map(({finding,provider,model})=>({agent:finding.agent,provider,model})),synthesisProvider:synthesis.provider,synthesisModel:synthesis.model,failedSpecialists:settled.length-completed.length});
  return{reply:synthesis.text,provider:synthesis.provider,routedDomains:findings.length,recommendations};
 }catch(error){await finishTrace(traceId,"failed",{selectedSpecialists:routed,error:error instanceof Error?error.message:"orchestration failed"});throw error;}
}

export async function runStructuredSpecialistTask(input:{specialist:Specialist;context:UserContext;request:string;schema:string;maxTokens?:number}){
 return callProjectYouAI({system:`You are an invisible Project You+ analysis component responsible only for ${RESPONSIBILITIES[input.specialist]}. Work from the shared UserContext below. Return valid JSON only. Never claim a data change occurred.\n\nOUTPUT SCHEMA:\n${input.schema}\n\nSHARED USER CONTEXT:\n${JSON.stringify(contextFor(input.specialist,input.context))}`,messages:[{role:"user",content:input.request}],maxTokens:input.maxTokens??1200});
}

async function runSpecialist(specialist:Specialist,input:OrchestratorInput){
 const availability={finance:input.context.domains.finance.availability!=="unavailable",health:input.context.domains.health.availability!=="unavailable",workout:input.context.domains.workout.availability!=="unavailable",nutrition:input.context.domains.nutrition.availability!=="unavailable"};
 if(!specialistHasData(specialist,availability)&&specialist==="finance")return{finding:unavailableFinding("finance",input.context.domains.finance.reason??"No connected financial data is available."),provider:"local" as const,model:"deterministic-data-boundary"};
 if(!specialistHasData(specialist,availability)&&specialist==="health")return{finding:unavailableFinding("health","No health metrics, workouts, or nutrition records are connected yet."),provider:"local" as const,model:"deterministic-data-boundary"};
 const relevantContext=contextFor(specialist,input.context),allowedEvidence=collectEvidenceReferences(relevantContext);
 try{const result=await callProjectYouAI({system:`You are an internal Project You+ analysis component responsible only for ${RESPONSIBILITIES[specialist]}.
Return ONLY JSON with this exact shape:
{"observations":[{"id":"short-id","domain":"execution|health|finance|goals|consistency|schedule|progress","observation":"...","evidence":[{"sourceType":"table","sourceId":"real-id-from-context"}],"confidence":"low|medium|high","suggestedAction":"optional","expectedImpact":"optional","relatedEntityIds":["real-id"]}],"unavailable":["..."],"proposedChanges":[{"kind":"...","summary":"...","reasonItMatters":"...","expectedImpact":"...","confidence":"low|medium|high","relatedEntities":[{"type":"task","id":"real-id","label":"optional"}],"observationId":"short-id","requiresConfirmation":true,"actionType":"advice.follow|task.complete|task.reschedule|calendar.reschedule|goal.progress","actionPayload":{}}]}
Use only supplied data and answer the exact question. Current domain data is authoritative for current totals and status. Event history records past actions and may contain values from before an edit; never sum historical event payloads to replace current nutrition totals or treat older event values as conflicting current records. Every medium/high-confidence observation must cite real sourceType/sourceId pairs found in context evidence. Evidence labels and values are assigned by the application; do not supply them. If evidence is missing, return a low-confidence observation and name the missing domain in unavailable. Keep at most 4 observations and 2 proposed changes. Use advice.follow for advice that does not mutate data. For a data change, use only one listed actionType with this payload: task.complete {taskId}; task.reschedule {taskId,dueAt}; calendar.reschedule {eventId,startAt,endAt}; goal.progress {goalId,progress}. Propose a change only when it is useful, evidence-backed, and requires confirmation. Never claim a mutation happened.

RELEVANT CONTEXT:
${JSON.stringify(relevantContext)}`,messages:[{role:"user",content:input.message}],maxTokens:700});
 return{finding:parseFinding(specialist,result.text,allowedEvidence),provider:result.provider,model:result.model};}
 catch(error){console.error(`Coach ${specialist} provider fallback:`,error);return{finding:fallbackFinding(specialist,input.context,input.message),provider:"local-fallback" as const,model:"deterministic-specialist"};}
}

function contextFor(specialist:Specialist,context:UserContext){const d=context.domains;const shared={onePercentScore:context.score.score,onePercentScoreCoveragePct:context.score.coveragePct,scoreRationale:context.score.rationale,strongest:context.score.strongest,opportunity:context.score.opportunity,generatedAt:context.generatedAt};if(specialist==="planner")return{...shared,profile:d.profile,goals:d.goals,tasks:d.tasks,habits:d.habits,calendar:d.calendar,workSchedule:d.workSchedule,workout:d.workout};if(specialist==="health")return{generatedAt:context.generatedAt,scoreDefinition:"Health Score measures scheduled training completion, diet logging, scheduled supplement completion, and their consistency. It is separate from the overall 1% Score and its coverage. Optional recovery does not lower Health Score.",workout:d.workout,nutrition:d.nutrition,supplements:d.supplements,health:d.health,recentPerformance:d.recentPerformance,eventHistory:d.eventHistory};if(specialist==="finance")return{...shared,finance:d.finance,recentScores:d.recentScores};return{...shared,health:d.health,scoreDefinition:"onePercentScoreCoveragePct describes only the overall 1% Score. Never use it as Health Score coverage. Health Score causes are supplied in health.data.factors.",recentScores:d.recentScores,recentPerformance:d.recentPerformance,achievements:d.achievements,progression:d.progression,eventHistory:d.eventHistory};}

function parseFinding(agent:Specialist,raw:string,allowedEvidence:Set<string>):SpecialistFinding{
 const parsed=JSON.parse(raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```$/i,"").trim())as Record<string,unknown>;
 const observations=Array.isArray(parsed.observations)?parsed.observations.slice(0,4).flatMap((item,index)=>parseObservation(agent,item,index,allowedEvidence)):[];
 const unavailable=strings(parsed.unavailable,8),proposedChanges=Array.isArray(parsed.proposedChanges)?parsed.proposedChanges.slice(0,2).flatMap(item=>parseProposedChange(item,observations,allowedEvidence)):[];
 if(!observations.length&&unavailable.length)observations.push({id:hash(`${agent}:${unavailable.join("|")}`).slice(0,16),agent,domain:defaultDomain(agent),observation:`There is not enough connected ${agent} data to answer this confidently.`,evidence:[],confidence:"low",relatedEntityIds:[]});
 return{agent,observations,unavailable,proposedChanges};
}
function parseObservation(agent:Specialist,value:unknown,index:number,allowed:Set<string>):AgentObservation[]{if(!isRecord(value)||typeof value.observation!=="string"||!value.observation.trim())return[];const evidence=Array.isArray(value.evidence)?value.evidence.slice(0,12).flatMap(item=>parseEvidence(item,allowed)):[];const observation=value.observation.trim().slice(0,600),id=typeof value.id==="string"&&value.id.trim()?value.id.trim().slice(0,80):hash(`${agent}:${index}:${observation}`).slice(0,16);return[{id,agent,domain:observationDomain(value.domain,agent),observation,evidence,confidence:evidence.length?modelConfidence(value.confidence):"low",suggestedAction:textValue(value.suggestedAction,400),expectedImpact:textValue(value.expectedImpact,400),relatedEntityIds:strings(value.relatedEntityIds,20).filter(id=>[...allowed].some(ref=>ref.endsWith(`:${id}`)))}];}
function parseEvidence(value:unknown,allowed:Set<string>):ObservationEvidence[]{if(!isRecord(value)||typeof value.sourceType!=="string"||typeof value.sourceId!=="string"||!allowed.has(`${value.sourceType}:${value.sourceId}`))return[];return[{label:`Verified ${value.sourceType} record`,sourceType:value.sourceType,sourceId:value.sourceId}];}
function parseProposedChange(value:unknown,observations:AgentObservation[],allowed:Set<string>):ProposedChange[]{if(!isRecord(value)||typeof value.kind!=="string"||typeof value.summary!=="string"||typeof value.reasonItMatters!=="string"||typeof value.expectedImpact!=="string")return[];const requestedId=typeof value.observationId==="string"?value.observationId:undefined,basis=observations.find(item=>item.id===requestedId)??observations.find(item=>item.confidence!=="low"&&item.evidence.length);if(!basis||basis.confidence==="low"||!basis.evidence.length)return[];const entities=Array.isArray(value.relatedEntities)?value.relatedEntities.slice(0,20).flatMap(item=>parseEntity(item,allowed)):[],action=normalizeRecommendationAction(value.actionType,value.actionPayload,allowed);if(!action)return[];return[{kind:value.kind.slice(0,100),summary:value.summary.slice(0,500),reasonItMatters:value.reasonItMatters.slice(0,500),expectedImpact:value.expectedImpact.slice(0,500),confidence:confidence(value.confidence),relatedEntities:entities,observationId:basis.id,requiresConfirmation:true,...action}];}
function parseEntity(value:unknown,allowed:Set<string>):RecommendationEntity[]{if(!isRecord(value)||typeof value.type!=="string"||typeof value.id!=="string"||![...allowed].some(ref=>ref.endsWith(`:${value.id}`)))return[];return[{type:value.type,id:value.id,...(typeof value.label==="string"?{label:value.label.slice(0,160)}:{})}];}

async function persistProposedRecommendations(findings:SpecialistFinding[]){const work=findings.flatMap(finding=>finding.proposedChanges.map(proposal=>({finding,proposal,basis:finding.observations.find(item=>item.id===proposal.observationId)}))).filter(item=>item.basis&&item.basis.confidence!=="low"&&item.basis.evidence.length);return Promise.all(work.map(({finding,proposal,basis})=>{const evidence=basis!.evidence.map(item=>({table:item.sourceType!,id:item.sourceId!,detail:item.label}));return createRecommendation({domain:recommendationDomain(finding.agent),observation:basis!.observation,supportingEvidence:evidence,reasonItMatters:proposal.reasonItMatters,suggestedAction:proposal.summary,expectedImpact:proposal.expectedImpact,confidence:proposal.confidence,relatedEntities:proposal.relatedEntities,source:"coach",sourceAgent:finding.agent,actionType:proposal.actionType,actionPayload:proposal.actionPayload,dedupeKey:recommendationDedupeKey({sourceAgent:finding.agent,actionType:proposal.actionType,actionPayload:proposal.actionPayload,relatedEntities:proposal.relatedEntities,evidence})});}));}
function recommendationForCoach(item:Recommendation){return{id:item.id,domain:item.domain,observation:item.observation,suggestedAction:item.suggestedAction,expectedImpact:item.expectedImpact,confidence:item.confidence,state:item.state,relatedEntities:item.relatedEntities};}
function unavailableFinding(agent:Specialist,reason:string):SpecialistFinding{return{agent,observations:[{id:hash(`${agent}:${reason}`).slice(0,16),agent,domain:defaultDomain(agent),observation:reason,evidence:[],confidence:"low",relatedEntityIds:[]}],unavailable:[reason],proposedChanges:[]};}
function fallbackFinding(agent:Specialist,context:UserContext,message:string):SpecialistFinding{
 if(agent==="planner"){
  const task=context.tasks.filter(item=>!item.completedAt).sort((a,b)=>taskRank(a.tier)-taskRank(b.tier))[0],event=context.schedule.find(item=>new Date(item.endAt)>new Date());
  if(task){const evidence=contextEvidence(context.domains.tasks,"Highest-priority open task",task.title,task.id);return{agent,observations:[{id:hash(`planner:${task.id}`).slice(0,16),agent,domain:"execution",observation:`${task.title} is the highest-priority open task in your current plan.`,evidence,confidence:evidence.length?"high":"low",suggestedAction:`Make “${task.title}” the next focused action${event?` while protecting your commitment “${event.title}”`:""}.`,expectedImpact:"Moves the most important tracked work forward without adding another commitment.",relatedEntityIds:[task.id]}],unavailable:[],proposedChanges:[]};}
  return unavailableFinding(agent,"No open tasks are available to prioritize yet.");
 }
 if(agent==="health"){
  const health=context.domains.health.data;if(health){const evidence=contextEvidence(context.domains.health,"Health Score",health.score);return{agent,observations:[{id:hash(`health:${health.score}`).slice(0,16),agent,domain:"health",observation:`Your Health Score is ${health.score}. Training is ${health.drivers.training}, diet is ${health.drivers.diet}, protocol is ${health.drivers.protocol}, and consistency is ${health.drivers.consistency}.`,evidence,confidence:evidence.length?"medium":"low",suggestedAction:"Improve the lowest measured Health Score driver with one repeatable action this week.",expectedImpact:"Targets the largest measured health opportunity without guessing about missing inputs.",relatedEntityIds:evidence.flatMap(item=>item.sourceId?[item.sourceId]:[])}],unavailable:context.domains.health.reason?[context.domains.health.reason]:[],proposedChanges:[]};}
  const key=context.score.score.breakdown.fitness!=null?"fitness":context.score.score.breakdown.sleep!=null?"sleep":null;
  if(key){const evidence=contextEvidence(context.domains.health,`${key} score`,context.score.score.breakdown[key]);return{agent,observations:[{id:hash(`health:${key}:${context.score.score.breakdown[key]}`).slice(0,16),agent,domain:"health",observation:context.score.rationale[key]??`Your ${key} score is ${context.score.score.breakdown[key]}.`,evidence,confidence:evidence.length?"medium":"low",suggestedAction:key==="fitness"?"Complete the next scheduled workout and keep the plan on its selected days.":"Protect the next sleep window and log the result.",expectedImpact:`Creates a real signal that can improve the ${key} trend.`,relatedEntityIds:evidence.flatMap(item=>item.sourceId?[item.sourceId]:[])}],unavailable:evidence.length?[]:["More health history is needed for a confident trend."],proposedChanges:[]};}
  return unavailableFinding(agent,"No health score inputs are available yet.");
 }
 if(agent==="finance"){
  const finance=context.domains.finance.data;if(!finance)return unavailableFinding(agent,context.domains.finance.reason??"No connected financial data is available.");const amount=purchaseAmount(message),evidence=contextEvidence(context.domains.finance,"Connected finance summary",finance.cashBalance??finance.totalConnectedBalance);const balance=finance.cashBalance;
  const observation=amount!=null&&balance!=null?`Your Finance Score is ${finance.score}. Your connected cash balance is ${money(balance)}; the ${money(amount)} purchase would use ${Math.round(amount/Math.max(1,balance)*100)}% of it.`:`Your Finance Score is ${finance.score}. Project You+ has ${finance.accountCount} connected financial account${finance.accountCount===1?"":"s"}, but affordability also depends on upcoming bills, budget room, and savings priorities.`;
  return{agent,observations:[{id:hash(`finance:${amount}:${balance}`).slice(0,16),agent,domain:"finance",observation,evidence,confidence:evidence.length&&balance!=null?"medium":"low",suggestedAction:"Check the purchase against cash balance, remaining budget, upcoming bills, and the savings target before committing.",expectedImpact:"Protects cash flow instead of judging affordability from one balance alone.",relatedEntityIds:evidence.flatMap(item=>item.sourceId?[item.sourceId]:[])}],unavailable:balance==null?["No checking, savings, cash, or depository balance is available."]:[],proposedChanges:[]};
 }
 const opportunity=context.score.opportunity;if(opportunity){const source=opportunity.key==="money"?context.domains.finance:opportunity.key==="fitness"||opportunity.key==="sleep"?context.domains.health:context.domains.recentScores;const evidence=contextEvidence(source,`${opportunity.key} score`,opportunity.value);return{agent,observations:[{id:hash(`progress:${opportunity.key}:${opportunity.value}`).slice(0,16),agent,domain:"progress",observation:`${opportunity.key} is the weakest measured score domain at ${opportunity.value}.`,evidence,confidence:evidence.length?"medium":"low",suggestedAction:`Choose one repeatable action that improves ${opportunity.key} this week.`,expectedImpact:"Improving the weakest measured domain is the clearest current path to a stronger overall score.",relatedEntityIds:evidence.flatMap(item=>item.sourceId?[item.sourceId]:[])}],unavailable:evidence.length?[]:["More saved score history is needed to explain a change confidently."],proposedChanges:[]};}
 return unavailableFinding(agent,"There is not enough calibrated score history to identify a meaningful change yet.");
}
function synthesizeLocally(findings:SpecialistFinding[],active:Recommendation[]){const observations=findings.flatMap(item=>item.observations).sort((a,b)=>confidenceRank(b.confidence)-confidenceRank(a.confidence)),best=observations[0];if(!best)return"I don’t have enough connected data to answer that yet. Add the relevant plan or records and I’ll reassess without guessing.";const activeRecommendation=active.find(item=>item.domain===best.agent)||active[0],action=activeRecommendation?.suggestedAction??best.suggestedAction,impact=activeRecommendation?.expectedImpact??best.expectedImpact;return[best.observation,action?`My recommendation: ${action}`:null,impact?`Expected impact: ${impact}`:null,activeRecommendation?.state==="pending"?"Confirm it before Project You+ changes anything.":null].filter(Boolean).join(" ");}
function contextEvidence(domain:{evidence:Array<{table:string;ids:string[]}>},label:string,value?:string|number,id?:string):ObservationEvidence[]{const row=id?domain.evidence.find(item=>item.ids.includes(id)):domain.evidence[0],sourceId=id??row?.ids[0];return row&&sourceId?[{label,value,sourceType:row.table,sourceId}]:[];}
function taskRank(tier:string){return tier==="critical"?0:tier==="important"?1:2;}
function confidenceRank(value:ObservationConfidence){return value==="high"?3:value==="medium"?2:1;}
function purchaseAmount(message:string){const match=message.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);return match?Number(match[1].replace(/,/g,"")):null;}
function money(value:number){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);}
function domainAvailable(domain:RecommendationDomain,context:UserContext){if(domain==="finance")return context.domains.finance.availability!=="unavailable";if(domain==="health")return context.domains.health.availability!=="unavailable"||context.domains.workout.availability!=="unavailable"||context.domains.nutrition.availability!=="unavailable";return true;}
function collectEvidenceReferences(value:unknown){const refs=new Set<string>();const visit=(item:unknown)=>{if(Array.isArray(item)){item.forEach(visit);return}if(!isRecord(item))return;if(typeof item.table==="string"&&Array.isArray(item.ids))for(const id of item.ids)if(typeof id==="string")refs.add(`${item.table}:${id}`);Object.values(item).forEach(visit)};visit(value);return refs;}
function recommendationDomain(agent:Specialist):RecommendationDomain{return agent;}
function strings(value:unknown,limit:number){return Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim())).slice(0,limit):[];}
function confidence(value:unknown):ObservationConfidence{return value==="high"?"high":value==="medium"?"medium":"low";}
function modelConfidence(value:unknown):ObservationConfidence{return value==="high"||value==="medium"?"medium":"low";}
function observationDomain(value:unknown,agent:Specialist):ObservationDomain{const allowed:ObservationDomain[]=["execution","health","finance","goals","consistency","schedule","progress"];return allowed.includes(value as ObservationDomain)?value as ObservationDomain:defaultDomain(agent);}
function defaultDomain(agent:Specialist):ObservationDomain{return agent==="planner"?"execution":agent;}
function textValue(value:unknown,limit:number){return typeof value==="string"&&value.trim()?value.trim().slice(0,limit):undefined;}
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value&&typeof value==="object"&&!Array.isArray(value));}
function detectsMeaningfulChange(message:string){return/\b(add|create|change|move|reschedule|schedule|update|delete|remove|cancel|set|increase|decrease|replace|complete|log|connect)\b/i.test(message);}
function hash(value:string){return createHash("sha256").update(value).digest("hex");}
async function beginTrace(userId:string,message:string,selected:Specialist[],contextGeneratedAt:string){try{const{data,error}=await createAdminClient().from("ai_agent_runs").insert({agent_key:"orchestrator",requested_by:userId,run_type:"coach_orchestration",title:"Coach orchestration",status:"running",started_at:new Date().toISOString(),metadata:{selectedSpecialists:selected,messageHash:hash(message).slice(0,24),contextGeneratedAt}}).select("id").maybeSingle();if(error)throw error;return data?.id as number|undefined}catch(error){console.error("Coach trace start failed:",error);return undefined;}}
async function finishTrace(id:number|undefined,status:"passed"|"failed",metadata:Record<string,unknown>){if(id==null)return;try{const{error}=await createAdminClient().from("ai_agent_runs").update({status,summary:status==="passed"?"Coach orchestration completed.":"Coach orchestration failed.",metadata,finished_at:new Date().toISOString()}).eq("id",id);if(error)throw error}catch(error){console.error("Coach trace completion failed:",error);}}
