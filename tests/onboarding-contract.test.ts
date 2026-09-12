import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_ANSWERS, buildFallbackProposal, sanitizeAnswers, validateProposal } from "../lib/onboarding/schema";

function healthAnswers(){
  return sanitizeAnswers({
    ...EMPTY_ANSWERS,
    direction:{domains:["health"],primaryDomain:"health"},
    friction:{categories:["lack_of_time"],note:""},
    goals:[{clientId:"goal-1",raw:"Train consistently",title:"Train consistently",domain:"health",desiredOutcome:"Train consistently",priority:1,status:"draft"}],
    life:{...EMPTY_ANSWERS.life,work:{...EMPTY_ANSWERS.life.work,type:"none"}},
    health:{...EMPTY_ANSWERS.health,included:true,deferred:false,objective:"build_consistency",experience:"intermediate",trainingDaysPerWeek:3,preferredDays:[1,3,5],workoutDurationMinutes:45,setting:"gym"},
    finance:{deferred:true,primaryGoal:null,secondaryGoals:[],optionalDetail:""},
    coaching:{style:"balanced",checkInFrequency:"daily",checkInWindow:"morning",weeklyReviewDay:0,weeklyReviewTime:"18:00",reminderIntent:false},
  });
}

test("validated health proposal cannot silently change confirmed training frequency",()=>{
  const answers=healthAnswers();
  const plan=buildFallbackProposal(answers);
  const result=validateProposal({...plan,healthPlan:{...plan.healthPlan!,daysPerWeek:4}},answers);
  assert.equal(result.ok,false);
});

test("validated health proposal cannot schedule outside selected preferred days",()=>{
  const answers=healthAnswers();
  const plan=buildFallbackProposal(answers);
  const altered={...plan,healthPlan:{...plan.healthPlan!,schedule:plan.healthPlan!.schedule.map((session,index)=>index===0?{...session,dayIndex:2,day:"Tuesday"}:session)}};
  const result=validateProposal(altered,answers);
  assert.equal(result.ok,false);
});

test("weekly review generation must preserve the user's confirmed time",()=>{
  const answers=healthAnswers();
  const plan=buildFallbackProposal(answers);
  const result=validateProposal({...plan,weeklyReview:{...plan.weeklyReview,time:"19:00"}},answers);
  assert.equal(result.ok,false);
});
