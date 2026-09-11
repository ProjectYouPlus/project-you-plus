import { calculateHealthScore, type HealthScoreInput } from "../health/score";
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
  const month=new Date(now.getFullYear(),now.getMonth(),1);const tx=input.transactions.filter(x=>new Date(x.occurred_at)>=month);
  const income=tx.filter(x=>Number(x.amount)>0).reduce((sum,x)=>sum+Number(x.amount),0),spend=Math.abs(tx.filter(x=>Number(x.amount)<0).reduce((sum,x)=>sum+Number(x.amount),0));
  const budget=input.budgets.reduce((sum,x)=>sum+Number(x.monthly_limit||0),0);const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();const budgetPace=budget*(now.getDate()/daysInMonth);
  const budgetScore=budget>0&&budgetPace>0?clamp(spend<=budgetPace?100-(1-spend/budgetPace)*8:100-(spend/budgetPace-1)*70):null;
  const cashFlow=income>0?clamp((income-spend)/income*100):null;const savings=income>0?clamp((income-spend)/income*100+50):null;
  const debt=Math.abs(input.accounts.filter(x=>["credit","loan","liability"].includes(String(x.account_type))).reduce((sum,x)=>sum+Math.min(0,Number(x.balance||0)),0));
  const cash=input.accounts.filter(x=>!["credit","loan","liability"].includes(String(x.account_type))).reduce((sum,x)=>sum+Math.max(0,Number(x.balance||0)),0);const position=cash+debt>=0?80:35;
  const consistency=average([budgetScore,cashFlow,savings,position]);finance={budget:budgetScore,cashFlow,savings,consistency,spendingOnTarget:budget>0?spend<=budgetPace:null};
  financeScore=weightedAverage([{value:budgetScore,weight:30},{value:cashFlow,weight:30},{value:savings,weight:20},{value:consistency,weight:20}])??position;
 }
 return{healthScore,financeScore,health,finance};
}

function clamp(value:number){return Math.max(0,Math.min(100,Math.round(value)));}
function average(values:Array<number|null>){const available=values.filter((value):value is number=>value!=null);return available.length?Math.round(available.reduce((sum,value)=>sum+value,0)/available.length):null;}
function weightedAverage(values:Array<{value:number|null;weight:number}>){const available=values.filter((item):item is {value:number;weight:number}=>item.value!=null);const weight=available.reduce((sum,item)=>sum+item.weight,0);return weight?Math.round(available.reduce((sum,item)=>sum+item.value*item.weight,0)/weight):null;}
function isDue(frequency:string,day:number){if(frequency==="daily")return true;if(frequency==="weekdays")return day>=1&&day<=5;if(frequency.startsWith("weekly_"))return frequency===`weekly_${["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][day]}`;if(frequency==="weekly")return day===1;return false;}
function localDate(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
