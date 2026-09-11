import type { RecommendationEntity } from "@/lib/types/recommendations";

export type Specialist = "planner" | "health" | "finance" | "progress";
export type ObservationDomain = "execution" | "health" | "finance" | "goals" | "consistency" | "schedule" | "progress";
export type ObservationConfidence = "low" | "medium" | "high";

export type ObservationEvidence = {
  label: string;
  value?: string | number;
  sourceType?: string;
  sourceId?: string;
};

export type AgentObservation = {
  id: string;
  agent: Specialist;
  domain: ObservationDomain;
  observation: string;
  evidence: ObservationEvidence[];
  confidence: ObservationConfidence;
  suggestedAction?: string;
  expectedImpact?: string;
  relatedEntityIds: string[];
};

export type ProposedChange = {
  kind: string;
  summary: string;
  reasonItMatters: string;
  expectedImpact: string;
  confidence: ObservationConfidence;
  relatedEntities: RecommendationEntity[];
  actionType: "advice.follow"|"task.complete"|"task.reschedule"|"calendar.reschedule"|"goal.progress";
  actionPayload: Record<string, unknown>;
  observationId?: string;
  requiresConfirmation: true;
};

export type SpecialistFinding = {
  agent: Specialist;
  observations: AgentObservation[];
  unavailable: string[];
  proposedChanges: ProposedChange[];
};
