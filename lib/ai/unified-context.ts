import { buildProjectYouContext, compactContext, type ProjectYouContext } from "@/lib/ai/context";
import { buildLongitudinalIntelligenceContext, compactLongitudinalContext, type LongitudinalIntelligenceContext } from "@/lib/ai/longitudinal-context";

/**
 * Authoritative user context for user-facing Project You+ intelligence.
 * Current-state product data and longitudinal intelligence are composed here so
 * Coach and every invisible specialist reason from one shared source of truth.
 */
export interface UnifiedUserContext {
  current: ProjectYouContext;
  longitudinal: LongitudinalIntelligenceContext;
  generatedAt: string;
}

export async function buildUnifiedUserContext(): Promise<UnifiedUserContext> {
  const current = await buildProjectYouContext();
  const longitudinal = await buildLongitudinalIntelligenceContext(current);
  return { current, longitudinal, generatedAt: new Date().toISOString() };
}

export function compactUnifiedUserContext(context: UnifiedUserContext) {
  return {
    current: compactContext(context.current),
    longitudinal: compactLongitudinalContext(context.longitudinal),
    generatedAt: context.generatedAt,
  };
}
