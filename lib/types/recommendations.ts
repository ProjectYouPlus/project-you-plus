export type RecommendationDomain = "planner" | "health" | "finance" | "progress" | "general";
export type RecommendationState = "pending" | "accepted" | "dismissed" | "completed";
export type RecommendationSource = "coach" | "weekly_review" | "progress" | "system";
export type RecommendationAgent = "coach" | "planner" | "health" | "finance" | "progress";
export type RecommendationConfidence = "low" | "medium" | "high";

export type RecommendationEvidence = {
  table: string;
  id: string;
  detail?: string;
  occurredAt?: string;
};

export type RecommendationEntity = {
  type: string;
  id: string;
  label?: string;
};

export type Recommendation = {
  id: string;
  domain: RecommendationDomain;
  observation: string;
  supportingEvidence: RecommendationEvidence[];
  reasonItMatters: string;
  suggestedAction: string;
  expectedImpact: string;
  confidence: RecommendationConfidence;
  state: RecommendationState;
  relatedEntities: RecommendationEntity[];
  source: RecommendationSource;
  sourceAgent: RecommendationAgent;
  actionType: string;
  actionPayload: Record<string,unknown>;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  dismissedAt: string | null;
  completedAt: string | null;
};

export type NewRecommendation = Omit<Recommendation,"id"|"state"|"sourceAgent"|"actionType"|"actionPayload"|"createdAt"|"updatedAt"|"acceptedAt"|"dismissedAt"|"completedAt"> & { sourceAgent?: RecommendationAgent; dedupeKey?: string; actionType?: string; actionPayload?: Record<string,unknown> };
