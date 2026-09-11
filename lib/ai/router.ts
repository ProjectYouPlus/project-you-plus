import type { Specialist } from "@/lib/types/agent-observations";

export type RoutingContext = { scoreOpportunity?: string | null };
export type SpecialistDataAvailability = { finance:boolean; health:boolean; workout:boolean; nutrition:boolean };

export function specialistHasData(specialist:Specialist,availability:SpecialistDataAvailability){
  if(specialist==="finance")return availability.finance;
  if(specialist==="health")return availability.health||availability.workout||availability.nutrition;
  return true;
}

export function routeSpecialists(message: string, mode: "decide" | "plan" | "reflect", context: RoutingContext = {}): Specialist[] {
  const text = message.toLowerCase();
  const selected = new Set<Specialist>();
  const namedDomainScore = /\b(health|finance) score\b/.test(text);
  const overallScore = /\b(overall|you\+|1%)\b.*\bscore\b|\bscore\b.*\boverall\b/.test(text) || (!namedDomainScore && /\b(my|the) score\b.*\b(change|changed|fall|fell|falling|drop|dropped)\b/.test(text));
  const historical = /\b(why|changed?|trend|trajectory|consistent|consistency|streak|history|pattern|neglect|slip|improv|week review|achievement|milestone)\b/.test(text);

  if (mode === "reflect" || overallScore || /\b(progress|trajectory|achievement|milestone|neglect)\b/.test(text)) selected.add("progress");
  if (mode === "plan" || /\b(goal|task|habit|priority|calendar|schedule|plan|today|tomorrow|conflict|overload|busy|available time|when should)\b/.test(text)) selected.add("planner");
  if (/\b(health|workouts?|exercise|training|diet|meal|food|nutrition|supplements?|sleep|recovery|steps|weight|vitals?)\b/.test(text)) selected.add("health");
  if (/\b(afford|purchase|money|finance|spend|spending|budget|cash|saving|savings|bill|bank|debt|income|transaction|investment)\b/.test(text)) selected.add("finance");
  if (historical && (selected.has("health") || selected.has("finance"))) selected.add("progress");

  if (overallScore) {
    const opportunity = context.scoreOpportunity;
    if (opportunity === "fitness" || opportunity === "sleep") selected.add("health");
    else if (opportunity === "money") selected.add("finance");
    else if (opportunity === "productivity" || opportunity === "goals" || opportunity === "habits" || opportunity === "learning") selected.add("planner");
  }
  if (!selected.size) selected.add(mode === "reflect" ? "progress" : "planner");
  return [...selected].slice(0, 4);
}
