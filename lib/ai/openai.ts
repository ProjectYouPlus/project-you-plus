type AIMessage = { role: "user" | "assistant"; content: string };

type TextRequest = {
  instructions: string;
  messages: AIMessage[];
  model?: string;
  maxOutputTokens?: number;
  reasoningEffort?: "none" | "low" | "medium" | "high";
};

type StructuredVisionRequest<T> = {
  instructions: string;
  prompt: string;
  imageDataUrl: string;
  schemaName: string;
  schema: Record<string, unknown>;
  model?: string;
  maxOutputTokens?: number;
};

type OpenAIResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  error?: { message?: string };
};

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function fastOpenAIModel() {
  return process.env.OPENAI_FAST_MODEL || "gpt-5.6-luna";
}

export function smartOpenAIModel() {
  return process.env.OPENAI_SMART_MODEL || "gpt-5.6-terra";
}

export async function callOpenAIText({
  instructions,
  messages,
  model = smartOpenAIModel(),
  maxOutputTokens = 800,
  reasoningEffort = "low",
}: TextRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input: messages,
      max_output_tokens: maxOutputTokens,
      reasoning: { effort: reasoningEffort },
      store: false,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as OpenAIResponse;
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${data.error?.message ?? "request failed"}`);
  const text = extractOutputText(data);
  if (!text) throw new Error("OpenAI returned no text content");
  return text;
}

export async function callOpenAIStructuredVision<T>({
  instructions,
  prompt,
  imageDataUrl,
  schemaName,
  schema,
  model = fastOpenAIModel(),
  maxOutputTokens = 1200,
}: StructuredVisionRequest<T>): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
      max_output_tokens: maxOutputTokens,
      reasoning: { effort: "low" },
      store: false,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as OpenAIResponse;
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${data.error?.message ?? "request failed"}`);
  const text = extractOutputText(data);
  if (!text) throw new Error("OpenAI returned no structured content");
  return JSON.parse(text) as T;
}

function extractOutputText(data: OpenAIResponse) {
  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("\n")
    .trim();
}
