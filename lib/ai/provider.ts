import { callClaude, claudeModel, isClaudeConfigured } from "@/lib/ai/anthropic";
import { callOpenAIText, isOpenAIConfigured, smartOpenAIModel } from "@/lib/ai/openai";

type Message = { role: "user" | "assistant"; content: string };

export type IntelligenceProvider = "openai" | "anthropic" | "local" | "local-fallback";

export async function callProjectYouAI({
  system,
  messages,
  maxTokens = 800,
}: {
  system: string;
  messages: Message[];
  maxTokens?: number;
}): Promise<{ text: string; provider: Exclude<IntelligenceProvider, "local" | "local-fallback">; model:string }> {
  if (isOpenAIConfigured()) {
    const model=smartOpenAIModel();const text = await callOpenAIText({ instructions: system, messages, model, maxOutputTokens: maxTokens, reasoningEffort: "low" });
    return { text, provider: "openai", model };
  }

  if (isClaudeConfigured()) {
    const text = await callClaude({ system, messages, maxTokens, temperature: 0.25 });
    return { text, provider: "anthropic", model:claudeModel() };
  }

  throw new Error("No cloud AI provider is configured");
}

export function hasCloudAI() {
  return isOpenAIConfigured() || isClaudeConfigured();
}
