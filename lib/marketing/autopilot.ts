export type AutopilotPlan = {
  campaign: { name: string; objective: string; thesis: string };
  summary: string;
  tasks: Array<{ title: string; priority: number; agent: string; status: string; owner_minutes: number; action: string }>;
  content: Array<{
    title: string;
    format: "reel" | "carousel" | "story" | "static" | "live" | "other";
    pillar: string;
    hypothesis: string;
    hook: string;
    script: string;
    caption: string;
    cta: string;
    creative_brief: string;
    founder_task: string;
    filming_instructions: { camera: string; location: string; delivery: string; b_roll: string; estimated_minutes: number };
    priority: number;
  }>;
  trends: Array<{ title: string; opportunity: string; relevance_score: number; velocity_score: number; brand_fit_score: number }>;
  community: Array<{ action_type: string; context: string; suggested_reply: string; priority: number }>;
  partnerships: Array<{ name: string; category: string; collaboration_idea: string; outreach_angle: string; fit_score: number }>;
  experiments: Array<{ name: string; hypothesis: string; variant_a: string; variant_b: string; primary_metric: string; target_sample: number }>;
};

const string = { type: "string" };
const number = { type: "number" };
const integer = { type: "integer" };

export const AUTOPILOT_PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["campaign", "summary", "tasks", "content", "trends", "community", "partnerships", "experiments"],
  properties: {
    campaign: {
      type: "object",
      additionalProperties: false,
      required: ["name", "objective", "thesis"],
      properties: { name: string, objective: string, thesis: string },
    },
    summary: string,
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "priority", "agent", "status", "owner_minutes", "action"],
        properties: { title: string, priority: integer, agent: string, status: string, owner_minutes: integer, action: string },
      },
    },
    content: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "format", "pillar", "hypothesis", "hook", "script", "caption", "cta", "creative_brief", "founder_task", "filming_instructions", "priority"],
        properties: {
          title: string,
          format: { type: "string", enum: ["reel", "carousel", "story", "static", "live", "other"] },
          pillar: string,
          hypothesis: string,
          hook: string,
          script: string,
          caption: string,
          cta: string,
          creative_brief: string,
          founder_task: string,
          filming_instructions: {
            type: "object",
            additionalProperties: false,
            required: ["camera", "location", "delivery", "b_roll", "estimated_minutes"],
            properties: { camera: string, location: string, delivery: string, b_roll: string, estimated_minutes: integer },
          },
          priority: integer,
        },
      },
    },
    trends: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "opportunity", "relevance_score", "velocity_score", "brand_fit_score"],
        properties: { title: string, opportunity: string, relevance_score: number, velocity_score: number, brand_fit_score: number },
      },
    },
    community: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action_type", "context", "suggested_reply", "priority"],
        properties: { action_type: string, context: string, suggested_reply: string, priority: integer },
      },
    },
    partnerships: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "category", "collaboration_idea", "outreach_angle", "fit_score"],
        properties: { name: string, category: string, collaboration_idea: string, outreach_angle: string, fit_score: number },
      },
    },
    experiments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "hypothesis", "variant_a", "variant_b", "primary_metric", "target_sample"],
        properties: { name: string, hypothesis: string, variant_a: string, variant_b: string, primary_metric: string, target_sample: integer },
      },
    },
  },
};
