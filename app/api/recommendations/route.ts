import { NextResponse } from "next/server";
import { listRecommendations } from "@/lib/ai/recommendations";
import type { RecommendationState } from "@/lib/types/recommendations";

const STATES=new Set<RecommendationState>(["pending","accepted","dismissed","completed"]);

export async function GET(request:Request){
  const {searchParams}=new URL(request.url);const rawState=searchParams.get("state");
  if(rawState&&!STATES.has(rawState as RecommendationState)) return NextResponse.json({error:"Invalid state."},{status:400});
  try{return NextResponse.json({recommendations:await listRecommendations({state:(rawState||undefined) as RecommendationState|undefined,limit:Number(searchParams.get("limit")||20)})});}
  catch(error){const message=error instanceof Error?error.message:"Could not load recommendations.";return NextResponse.json({error:message},{status:message==="Not signed in."?401:500});}
}
