import type { SystemProposal } from "@/lib/onboarding/system-schema";

export type ExistingSystemMatch={
  kind:"goal"|"habit";
  proposalClientId:string;
  existingId:string;
  existingTitle:string;
};

export function findExistingSystemMatches(
  proposal:SystemProposal,
  existingGoals:Array<{id:string;title:string;status?:string|null}>,
  existingHabits:Array<{id:string;title:string}>,
):ExistingSystemMatch[]{
  const goalByTitle=new Map(existingGoals.filter(goal=>!goal.status||goal.status==="active").map(goal=>[normalize(goal.title),goal]));
  const habitByTitle=new Map(existingHabits.map(habit=>[normalize(habit.title),habit]));
  const matches:ExistingSystemMatch[]=[];

  for(const goal of proposal.goals){
    const existing=goalByTitle.get(normalize(goal.title));
    if(existing)matches.push({kind:"goal",proposalClientId:goal.clientId,existingId:existing.id,existingTitle:existing.title});
  }
  for(const action of proposal.actions){
    if(action.kind!=="habit")continue;
    const existing=habitByTitle.get(normalize(action.title));
    if(existing)matches.push({kind:"habit",proposalClientId:action.clientId,existingId:existing.id,existingTitle:existing.title});
  }
  return matches;
}

export function proposalStillMatchesExisting(proposal:SystemProposal,match:ExistingSystemMatch){
  const title=match.kind==="goal"?proposal.goals.find(goal=>goal.clientId===match.proposalClientId)?.title:proposal.actions.find(action=>action.clientId===match.proposalClientId)?.title;
  return Boolean(title&&normalize(title)===normalize(match.existingTitle));
}

function normalize(value:string){return value.trim().toLocaleLowerCase().replace(/\s+/g," ");}
