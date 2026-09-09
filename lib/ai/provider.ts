import { callClaude, isClaudeConfigured } from "@/lib/ai/anthropic";
import { callOpenAIText, isOpenAIConfigured } from "@/lib/ai/openai";

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
}): Promise<{ text: string; provider: Exclude<IntelligenceProvider, "local" | "local-fallback"> }> {
  if (isOpenAIConfigured()) {
    const text = await callOpenAIText({ instructions: system, messages, maxOutputTokens: maxTokens, reasoningEffort: "low" });
    return { text, provider: "openai" };
  }

  if (isClaudeConfigured()) {
    const text = await callClaude({ system, messages, maxTokens, temperature: 0.25 });
    return { text, provider: "anthropic" };
  }

  throw new Error("No cloud AI provider is configured");
}

export function hasCloudAI() {
  return isOpenAIConfigured() || isClaudeConfigured();
}
