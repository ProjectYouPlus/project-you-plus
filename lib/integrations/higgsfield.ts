import { getIntegrationSecret, saveIntegrationSecret, deleteIntegrationSecret } from "@/lib/integrations/secrets";

export type HiggsfieldSecret = {
  api_key_id: string;
  api_key_secret: string;
  image_model_path?: string | null;
  video_model_path?: string | null;
};

type HiggsfieldResponse = {
  status?: string;
  request_id?: string;
  status_url?: string;
  cancel_url?: string;
  images?: Array<{ url?: string }>;
  video?: { url?: string };
  videos?: Array<{ url?: string }>;
  outputs?: Array<{ url?: string }>;
  output?: { url?: string } | Array<{ url?: string }>;
  error?: { message?: string } | string;
  detail?: unknown;
  credits?: string | number;
  usd?: string | number;
  [key: string]: unknown;
};

const BASE_URL = "https://api.higgsfield.ai";
const DEFAULT_IMAGE_MODEL_PATH = "/higgsfield-ai/soul/v2/standard";

export function higgsfieldImageModelPath(secret?: Pick<HiggsfieldSecret, "image_model_path"> | null) {
  return normalizeModelPath(secret?.image_model_path || process.env.HIGGSFIELD_IMAGE_MODEL_PATH || DEFAULT_IMAGE_MODEL_PATH);
}

export function higgsfieldVideoModelPath(secret?: Pick<HiggsfieldSecret, "video_model_path"> | null) {
  const value = secret?.video_model_path || process.env.HIGGSFIELD_VIDEO_MODEL_PATH || "";
  if (!value) throw new Error("Higgsfield video model endpoint is not configured. Copy a text-to-video endpoint available to this account from Higgsfield Cloud.");
  return normalizeModelPath(value);
}

export async function getHiggsfieldSecret(userId: string) {
  const secret = await getIntegrationSecret<HiggsfieldSecret>(userId, "higgsfield_api");
  if (!secret?.api_key_id || !secret.api_key_secret) throw new Error("Higgsfield Cloud API is not connected");
  return secret;
}

export async function saveHiggsfieldSecret(userId: string, secret: HiggsfieldSecret) {
  await saveIntegrationSecret(userId, "higgsfield_api", secret);
}

export async function deleteHiggsfieldSecret(userId: string) {
  await deleteIntegrationSecret(userId, "higgsfield_api");
}

export function buildHiggsfieldGenerationRequest(job: {
  generation_type: string;
  prompt?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown> | null;
}, secret?: HiggsfieldSecret | null) {
  const isImage = job.generation_type === "image";
  const metadata = job.metadata || {};
  const configuredPath = typeof metadata.model_path === "string" ? metadata.model_path : null;
  const modelPath = normalizeModelPath(
    configuredPath || (job.model?.startsWith("/") ? job.model : null) || (isImage ? higgsfieldImageModelPath(secret) : higgsfieldVideoModelPath(secret))
  );
  const prompt = String(job.prompt || "").trim();
  if (!prompt) throw new Error("Higgsfield generation job is missing a prompt");

  if (isImage) {
    return {
      modelPath,
      body: {
        prompt,
        aspect_ratio: String(metadata.aspect_ratio || "4:5"),
      },
    };
  }

  const requestedDuration = numberOrNull(metadata.duration_seconds) ?? inferDuration(prompt) ?? 8;
  return {
    modelPath,
    body: {
      prompt,
      aspect_ratio: String(metadata.aspect_ratio || "9:16"),
      duration: Math.max(2, Math.min(30, Math.round(requestedDuration))),
    },
  };
}

export async function estimateHiggsfieldRequest(secret: HiggsfieldSecret, modelPath: string, body: Record<string, unknown>) {
  const data = await higgsfieldFetch(secret, `/estimate${normalizeModelPath(modelPath)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    credits: Number(data.credits || 0),
    usd: Number(data.usd || 0),
    raw: data,
  };
}

export async function submitHiggsfieldRequest(secret: HiggsfieldSecret, modelPath: string, body: Record<string, unknown>) {
  const data = await higgsfieldFetch(secret, normalizeModelPath(modelPath), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!data.request_id) throw new Error("Higgsfield did not return a request_id");
  return {
    requestId: String(data.request_id),
    status: String(data.status || "queued"),
    statusUrl: typeof data.status_url === "string" ? data.status_url : `${BASE_URL}/requests/${data.request_id}/status`,
    cancelUrl: typeof data.cancel_url === "string" ? data.cancel_url : `${BASE_URL}/requests/${data.request_id}/cancel`,
    raw: data,
  };
}

export async function getHiggsfieldRequestStatus(secret: HiggsfieldSecret, requestId: string, statusUrl?: string | null) {
  const path = statusUrl && statusUrl.startsWith(BASE_URL) ? statusUrl.slice(BASE_URL.length) : `/requests/${encodeURIComponent(requestId)}/status`;
  const data = await higgsfieldFetch(secret, path, { method: "GET" });
  return {
    status: String(data.status || "in_progress"),
    assetUrl: extractHiggsfieldAssetUrl(data),
    raw: data,
  };
}

export async function testHiggsfieldCredentials(secret: HiggsfieldSecret) {
  const modelPath = higgsfieldImageModelPath(secret);
  const result = await estimateHiggsfieldRequest(secret, modelPath, {
    prompt: "Project You+ integration health check, premium abstract editorial technology background",
    aspect_ratio: "4:5",
  });
  return { modelPath, ...result };
}

async function higgsfieldFetch(secret: HiggsfieldSecret, path: string, init: RequestInit) {
  const response = await fetch(path.startsWith("http") ? path : `${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Key ${secret.api_key_id}:${secret.api_key_secret}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let data: HiggsfieldResponse = {};
  try { data = text ? JSON.parse(text) as HiggsfieldResponse : {}; }
  catch { data = { detail: text }; }
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : data.detail ? JSON.stringify(data.detail) : "";
    const errorObject = typeof data.error === "object" && data.error !== null ? data.error : null;
    const message = typeof data.error === "string" ? data.error : errorObject?.message || detail || `Higgsfield API ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function extractHiggsfieldAssetUrl(data: HiggsfieldResponse) {
  const outputArray = Array.isArray(data.output) ? data.output : undefined;
  const outputObject = !Array.isArray(data.output) && data.output ? data.output : undefined;
  const candidates: Array<string | undefined> = [
    data.images?.[0]?.url,
    data.video?.url,
    data.videos?.[0]?.url,
    data.outputs?.[0]?.url,
    outputArray?.[0]?.url,
    outputObject?.url,
  ];
  return candidates.find((value): value is string => typeof value === "string" && /^https:\/\//.test(value)) || null;
}

function normalizeModelPath(path: string) {
  if (!path) throw new Error("Higgsfield model path is not configured");
  return path.startsWith("/") ? path : `/${path}`;
}

function inferDuration(prompt: string) {
  const match = prompt.match(/(\d{1,2})\s*-?second/i);
  return match ? Number(match[1]) : null;
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
