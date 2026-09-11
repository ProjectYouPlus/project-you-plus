import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserIntelligenceDomain } from "@/lib/ai/user-events";

export interface CreateRecommendationInput {
  userId: string;
  domain: UserIntelligenceDomain;
  observation: string;
  evidence?: Array<Record<string, unknown>>;
  reason: string;
  suggestedAction: string;
  expectedImpact?: string | null;
  confidence?: "low" | "medium" | "high";
  actionType?: string | null;
  actionPayload?: Record<string, unknown>;
  expiresAt?: string | null;
}

export async function createRecommendation(supabase: SupabaseClient, input: CreateRecommendationInput) {
  const { data, error } = await supabase.from("ai_recommendations").insert({
    user_id: input.userId,
    domain: input.domain,
    observation: input.observation,
    evidence: input.evidence ?? [],
    reason: input.reason,
    suggested_action: input.suggestedAction,
    expected_impact: input.expectedImpact ?? null,
    confidence: input.confidence ?? "medium",
    status: "pending",
    action_type: input.actionType ?? null,
    action_payload: input.actionPayload ?? {},
    requires_confirmation: true,
    expires_at: input.expiresAt ?? null,
  }).select("id,domain,observation,reason,suggested_action,expected_impact,confidence,status,action_type,action_payload,requires_confirmation,created_at").single();
  if (error) throw error;
  return data;
}

export async function setRecommendationDecision(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string,
  decision: "accepted" | "dismissed",
) {
  const { data, error } = await supabase.from("ai_recommendations")
    .update({ status: decision, updated_at: new Date().toISOString() })
    .eq("id", recommendationId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id,domain,observation,reason,suggested_action,expected_impact,confidence,status,action_type,action_payload,requires_confirmation")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function completeRecommendation(supabase: SupabaseClient, userId: string, recommendationId: string) {
  const { error } = await supabase.from("ai_recommendations")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", recommendationId)
    .eq("user_id", userId)
    .eq("status", "accepted");
  if (error) throw error;
}
