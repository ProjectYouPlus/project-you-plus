import { createHash } from "node:crypto";

export const EXECUTABLE_ACTIONS=["advice.follow","task.complete","task.reschedule","calendar.reschedule","goal.progress","workout.schedule_move"] as const;
export type ExecutableActionType=typeof EXECUTABLE_ACTIONS[number];

export function normalizeRecommendationAction(actionType:unknown,payload:unknown,allowedReferences:Set<string>):{actionType:ExecutableActionType;actionPayload:Record<string,unknown>}|null{
 if(typeof actionType!=="string"||!EXECUTABLE_ACTIONS.includes(actionType as ExecutableActionType)||!isRecord(payload))return null;
 if(actionType==="advice.follow")return{actionType,actionPayload:{}};
 if(actionType==="task.complete")return referenced(actionType,"tasks","taskId",payload,allowedReferences);
 if(actionType==="task.reschedule"){
  const base=referenced(actionType,"tasks","taskId",payload,allowedReferences),dueAt=isoDate(payload.dueAt);return base&&dueAt?{...base,actionPayload:{...base.actionPayload,dueAt}}:null;
 }
 if(actionType==="calendar.reschedule"){
  const base=referenced(actionType,"calendar_events","eventId",payload,allowedReferences),startAt=isoDate(payload.startAt),endAt=isoDate(payload.endAt);return base&&startAt&&endAt&&endAt>startAt?{...base,actionPayload:{...base.actionPayload,startAt,endAt}}:null;
 }
 if(actionType==="goal.progress"){
  const base=referenced(actionType,"goals","goalId",payload,allowedReferences),progress=Number(payload.progress);return base&&Number.isInteger(progress)&&progress>=0&&progress<=100?{...base,actionPayload:{...base.actionPayload,progress}}:null;
 }
 if(actionType==="workout.schedule_move"){
  const base=referenced(actionType,"workout_plans","planId",payload,allowedReferences);
  const sessionKey=typeof payload.sessionKey==="string"?payload.sessionKey.trim():"";
  const days=Array.isArray(payload.days)?payload.days.map(Number):[];
  const fromDayIndex=Number(payload.fromDayIndex),toDayIndex=Number(payload.toDayIndex);
  const validDays=days.length>0&&days.length<=6&&days.every(day=>Number.isInteger(day)&&day>=0&&day<=6)&&new Set(days).size===days.length;
  return base&&sessionKey&&validDays&&Number.isInteger(fromDayIndex)&&Number.isInteger(toDayIndex)&&fromDayIndex>=0&&fromDayIndex<=6&&toDayIndex>=0&&toDayIndex<=6&&fromDayIndex!==toDayIndex
   ?{...base,actionPayload:{...base.actionPayload,sessionKey:sessionKey.slice(0,100),days,fromDayIndex,toDayIndex}}
   :null;
 }
 return null;
}

export function recommendationDedupeKey(input:{sourceAgent:string;actionType:string;actionPayload:Record<string,unknown>;relatedEntities:Array<{type:string;id:string}>;evidence?:Array<{table:string;id:string}>}){
 const entities=[...input.relatedEntities].map(item=>[item.type,item.id]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const evidence=[...(input.evidence??[])].map(item=>[item.table,item.id]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const payload=sortObject(input.actionPayload);const canonical=JSON.stringify([input.sourceAgent,input.actionType,payload,entities,evidence]);return`coach:${createHash("sha256").update(canonical).digest("hex").slice(0,32)}`;
}

function referenced(actionType:ExecutableActionType,table:string,key:string,payload:Record<string,unknown>,allowed:Set<string>){const id=typeof payload[key]==="string"?payload[key] as string:"";return id&&allowed.has(`${table}:${id}`)?{actionType,actionPayload:{[key]:id}}:null;}
function isoDate(value:unknown){if(typeof value!=="string")return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString();}
function sortObject(value:Record<string,unknown>){return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));}
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value&&typeof value==="object"&&!Array.isArray(value));}
