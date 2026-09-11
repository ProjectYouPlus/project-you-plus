import { NextResponse } from "next/server";
import { executeRecommendation, updateRecommendationState } from "@/lib/ai/recommendations";
type UserRecommendationState="accepted"|"dismissed";
const STATES=new Set<UserRecommendationState>(["accepted","dismissed"]);

export async function PATCH(request:Request,{params}:{params:{id:string}}){
  try{
    const body=await request.json() as {state?:UserRecommendationState};
    if(!body.state||!STATES.has(body.state)) return NextResponse.json({error:"Invalid state."},{status:400});
    return NextResponse.json({recommendation:await updateRecommendationState(params.id,body.state)});
  }catch(error){const message=error instanceof Error?error.message:"Could not update recommendation.";return NextResponse.json({error:message},{status:message==="Not signed in."?401:500});}
}

export async function POST(_request:Request,{params}:{params:{id:string}}){
 try{return NextResponse.json({recommendation:await executeRecommendation(params.id)});}catch(error){const message=error instanceof Error?error.message:"Could not execute recommendation.";return NextResponse.json({error:message},{status:message==="Not signed in."?401:400});}
}
