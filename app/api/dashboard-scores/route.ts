import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHealthOverview } from "@/lib/data/health";
import { getFinanceOverview } from "@/lib/data/finance";
export async function GET(){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const [overview,financeOverview]=await Promise.all([getHealthOverview(),getFinanceOverview()]);
 const score=overview.score;
 return NextResponse.json({financeScore:financeOverview.score.overall,finance:{budget:financeOverview.score.budget,cashFlow:financeOverview.score.cashFlow,savings:financeOverview.score.savings,consistency:financeOverview.score.consistency},healthScore:score.overall,health:score.overall===null?null:{training:score.training,diet:score.diet,protocol:score.supplements,consistency:score.consistency}});
}
