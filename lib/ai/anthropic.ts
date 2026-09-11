interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeRequest {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function claudeModel() { return process.env.ANTHROPIC_MODEL || "claude-sonnet-5"; }

export async function callClaude({ system, messages, maxTokens = 700, temperature = 0.3 }: ClaudeRequest): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: claudeModel(),
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Claude API ${response.status}: ${detail.slice(0, 400)}`);
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n").trim();
  if (!text) throw new Error("Claude returned no text content");
  return text;
}
