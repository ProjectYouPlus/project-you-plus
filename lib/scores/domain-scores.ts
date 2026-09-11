import { calculateHealthScore, type HealthScoreInput } from "../health/score";
import { calculateFinanceOverview } from "../finance/overview";
export type HealthScoreDrivers = { training:number|null; diet:number|null; protocol:number|null; consistency:number|null };
export type FinanceScoreDrivers = { budget:number|null; cashFlow:number|null; savings:number|null; consistency:number|null; spendingOnTarget:boolean|null };
export type DomainScores = { healthScore:number|null; financeScore:number|null; health:HealthScoreDrivers|null; finance:FinanceScoreDrivers|null };

type WorkoutPlan = { id:string; schedule:unknown } | null;
type WorkoutLog = { plan_id:string; session_key:string; completed_on:string };
type NutritionLog = { logged_at:string };
type Supplement = { id:string; frequency:string };
type SupplementLog = { supplement_id:string; logged_on:string };
type Account = { balance:number|string|null; account_type:string|null };
type Transaction = { amount:number|string|null; occurred_at:string };
type Budget = { monthly_limit:number|string|null };

export function calculateDomainScores(input:{now:Date;timezone?:string;healthAvailability?:{training:boolean;diet:boolean;supplements:boolean};plan:WorkoutPlan;planLogs:WorkoutLog[];nutritionLogs:NutritionLog[];supplements:Supplement[];supplementLogs:SupplementLog[];accounts:Account[];transactions:Transaction[];budgets:Budget[];healthSourcesAvailable:boolean;financeSourcesAvailable:boolean}):DomainScores{
 const {now}=input;
 const result=calculateHealthScore({now,timezone:input.timezone,plan:input.plan as HealthScoreInput["plan"],planLogs:input.planLogs,nutritionLogs:input.nutritionLogs,supplements:input.supplements,supplementLogs:input.supplementLogs,available:input.healthAvailability??{training:input.healthSourcesAvailable,diet:input.healthSourcesAvailable,supplements:input.healthSourcesAvailable}});
 const healthScore=result.overall;
 const health=healthScore===null?null:{training:result.training,diet:result.diet,protocol:result.supplements,consistency:result.consistency};
 let financeScore:number|null=null,finance:FinanceScoreDrivers|null=null;
 if(input.financeSourcesAvailable&&(input.accounts.length||input.transactions.length||input.budgets.length)){
  const periodStart=`${now.toISOString().slice(0,7)}-01`;
  const overview=calculateFinanceOverview({now,timezone:input.timezone??"UTC",accounts:input.accounts.map((row,index)=>({id:`account-${index}`,name:`Account ${index+1}`,account_type:row.account_type,balance:row.balance,institution:null,connected_via:null,mask:null,last_synced_at:null})),transactions:input.transactions.map((row,index)=>({id:`transaction-${index}`,account_id:null,amount:row.amount??0,category:null,merchant:null,occurred_at:row.occurred_at,pending:false})),budgets:input.budgets.map((row,index)=>({id:`budget-${index}`,category:"Overall",monthly_limit:row.monthly_limit??0,period_start:periodStart})),bills:[],holdings:[],goals:[],goalHistory:[]});
  financeScore=overview.score.overall;
  finance={budget:overview.score.budget,cashFlow:overview.score.cashFlow,savings:overview.score.savings,consistency:overview.score.consistency,spendingOnTarget:overview.metrics.spendingPacePct===null?null:overview.metrics.spendingPacePct<=100};
 }
 return{healthScore,financeScore,health,finance};
}
