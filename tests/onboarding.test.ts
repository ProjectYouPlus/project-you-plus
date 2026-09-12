import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_ANSWERS,
  buildFallbackGoalDrafts,
  buildFallbackProposal,
  sanitizeAnswers,
  validateProposal,
  validateStage,
} from "../lib/onboarding/schema";

function completeAnswers(){
  return sanitizeAnswers({
    ...EMPTY_ANSWERS,
    direction:{domains:["health","money"],primaryDomain:"health"},
    friction:{categories:["lack_of_time"],note:""},
    goals:[{clientId:"goal-1",raw:"Get in shape",title:"Get in shape",domain:"health",desiredOutcome:"Get in shape",priority:1,status:"draft"}],
    life:{...EMPTY_ANSWERS.life,work:{...EMPTY_ANSWERS.life.work,type:"fixed",days:[1,2,3,4,5],startTime:"09:00",endTime:"17:00"},wakeSleep:{mode:"varies",wakeTime:"07:00",sleepTime:"23:00"}},
    health:{...EMPTY_ANSWERS.health,included:true,deferred:false,objective:"build_consistency",experience:"beginner",trainingDaysPerWeek:3,preferredDays:[1,3,5],workoutDurationMinutes:45,setting:"gym",nutritionObjective:"consistent_eating"},
    finance:{deferred:false,primaryGoal:"emergency_fund",secondaryGoals:[],optionalDetail:""},
    coaching:{style:"balanced",checkInFrequency:"daily",checkInWindow:"morning",weeklyReviewDay:0,weeklyReviewTime:"18:00",reminderIntent:true},
  });
}

test("direction requires a primary choice only when multiple domains are selected",()=>{
  const one=sanitizeAnswers({...EMPTY_ANSWERS,direction:{domains:["health"],primaryDomain:null}});
  assert.equal(validateStage("direction",one),null);
  assert.equal(one.direction.primaryDomain,"health");
  const two=sanitizeAnswers({...EMPTY_ANSWERS,direction:{domains:["health","money"],primaryDomain:null}});
  assert.match(validateStage("direction",two)??"",/matters most/i);
});

test("health and finance can be intentionally deferred without blocking completion",()=>{
  const answers=completeAnswers();
  answers.health.included=false;answers.health.deferred=true;
  answers.finance.deferred=true;answers.finance.primaryGoal=null;
  assert.equal(validateStage("health",answers),null);
  assert.equal(validateStage("finance",answers),null);
});

test("fixed work schedules preserve overnight shifts",()=>{
  const answers=completeAnswers();
  answers.life.work.startTime="22:00";answers.life.work.endTime="06:00";
  assert.equal(validateStage("life",answers),null);
  assert.equal(answers.life.work.endTime,"06:00");
});

test("goal fallback preserves wording and never invents target amounts or dates",()=>{
  const [goal]=buildFallbackGoalDrafts(["Save money"],["money"],"money");
  assert.equal(goal.title,"Save money");
  assert.equal(goal.measurableTarget,null);
  assert.equal(goal.targetDate,null);
});

test("deterministic fallback creates a manageable first week and honors training availability",()=>{
  const answers=completeAnswers();
  const plan=buildFallbackProposal(answers);
  assert.ok(plan.goals.length>=1&&plan.goals.length<=3);
  assert.ok(plan.habits.length<=3);
  assert.ok(plan.priorities.length>=1&&plan.priorities.length<=3);
  assert.equal(plan.healthPlan?.daysPerWeek,3);
  assert.equal(plan.healthPlan?.sessionMinutes,45);
  assert.deepEqual(plan.healthPlan?.schedule.map(x=>x.dayIndex),[1,3,5]);
  assert.equal(plan.financialFocus?.goalType,"emergency_fund");
  assert.equal(plan.weeklyReview.day,0);
});

test("proposal validator rejects overstuffed first-week priorities",()=>{
  const answers=completeAnswers();
  const plan=buildFallbackProposal(answers);
  const invalid={...plan,priorities:[...plan.priorities,{clientId:"p2",title:"Two",dueWindow:"this_week",rationale:"x"},{clientId:"p3",title:"Three",dueWindow:"this_week",rationale:"x"},{clientId:"p4",title:"Four",dueWindow:"this_week",rationale:"x"}]};
  const result=validateProposal(invalid,answers);
  assert.equal(result.ok,false);
});

test("sanitization caps selections and strips unsupported enum values",()=>{
  const answers=sanitizeAnswers({direction:{domains:["health","money","career","business","fake"],primaryDomain:"fake"},friction:{categories:["lack_of_time","bogus"]}});
  assert.deepEqual(answers.direction.domains,["health","money","career"]);
  assert.equal(answers.direction.primaryDomain,null);
  assert.deepEqual(answers.friction.categories,["lack_of_time"]);
});
