import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateDomainScores } from "@/lib/scores/domain-scores";
import { getHealthOverview } from "@/lib/data/health";
export async function GET(){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const now=new Date(),month=new Date(now.getFullYear(),now.getMonth(),1);
 const [overview,accounts,transactions,budgets]=await Promise.all([getHealthOverview(),client.from("finance_accounts").select("balance,account_type"),client.from("transactions").select("amount,occurred_at").gte("occurred_at",month.toISOString()),client.from("budgets").select("monthly_limit")]);
 const finance=calculateDomainScores({now,plan:null,planLogs:[],nutritionLogs:[],supplements:[],supplementLogs:[],accounts:accounts.data??[],transactions:transactions.data??[],budgets:budgets.data??[],healthSourcesAvailable:false,financeSourcesAvailable:!accounts.error&&!transactions.error&&!budgets.error});
 const score=overview.score;
 return NextResponse.json({...finance,healthScore:score.overall,health:score.overall===null?null:{training:score.training,diet:score.diet,protocol:score.supplements,consistency:score.consistency}});
}
