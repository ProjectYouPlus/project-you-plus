import assert from "node:assert/strict";
import test from "node:test";
import { calculateDomainScores } from "../lib/scores/domain-scores";

test("does not invent scores when their sources failed",()=>{
 const result=calculateDomainScores({now:new Date("2026-09-11T12:00:00Z"),plan:null,planLogs:[],nutritionLogs:[],supplements:[],supplementLogs:[],accounts:[],transactions:[],budgets:[],healthSourcesAvailable:false,financeSourcesAvailable:false});
 assert.deepEqual(result,{healthScore:null,financeScore:null,health:null,finance:null});
});

test("calculates finance score from the same inputs used by dashboard and Coach",()=>{
 const result=calculateDomainScores({now:new Date("2026-09-11T12:00:00Z"),plan:null,planLogs:[],nutritionLogs:[],supplements:[],supplementLogs:[],accounts:[{balance:1000,account_type:"checking"}],transactions:[{amount:2000,occurred_at:"2026-09-01T12:00:00Z"},{amount:-500,occurred_at:"2026-09-05T12:00:00Z"}],budgets:[{monthly_limit:1000}],healthSourcesAvailable:true,financeSourcesAvailable:true});
 assert.equal(result.financeScore,86);
 assert.deepEqual(result.finance,{budget:64,cashFlow:100,savings:100,consistency:82,spendingOnTarget:false});
});
