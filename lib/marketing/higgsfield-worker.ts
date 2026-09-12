import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildHiggsfieldGenerationRequest,
  estimateHiggsfieldRequest,
  getHiggsfieldRequestStatus,
  getHiggsfieldSecret,
  submitHiggsfieldRequest,
} from "@/lib/integrations/higgsfield";

type AdminClient = ReturnType<typeof createAdminClient>;
type Job = {
  id: string; owner_id: string; campaign_id: string; content_item_id: string;
  generation_type: string; status: string; provider_job_id: string | null;
  model: string | null; prompt: string | null; estimated_credits: number | string | null;
  metadata: Record<string, unknown> | null;
};

export async function processHiggsfieldQueueForOwner(ownerId: string, limit = 2) {
  const admin = createAdminClient();
  const secret = await getHiggsfieldSecret(ownerId);
  const { data: jobs, error } = await admin.from("marketing_generation_jobs")
    .select("id,owner_id,campaign_id,content_item_id,generation_type,status,provider_job_id,model,prompt,estimated_credits,metadata")
    .eq("owner_id", ownerId).eq("provider", "higgsfield")
    .in("status", ["awaiting_provider", "submitted", "processing"])
    .order("created_at", { ascending: true }).limit(Math.max(1, Math.min(3, limit)));
  if (error) throw error;
  const results: Array<Record<string, unknown>> = [];
  for (const row of jobs || []) {
    const job = row as Job;
    try { results.push(job.status === "awaiting_provider" ? await submitJob(admin, secret, job) : await pollJob(admin, secret, job)); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : "Higgsfield provider step failed";
      await admin.from("marketing_generation_jobs").update({ error_message: message, updated_at: new Date().toISOString() }).eq("id", job.id);
      await logActivity(admin, job, "provider_error", `Higgsfield provider error: ${message}`, { job_id: job.id });
      results.push({ jobId: job.id, status: "error", error: message });
    }
  }
  return results;
}

async function submitJob(admin: AdminClient, secret: Awaited<ReturnType<typeof getHiggsfieldSecret>>, job: Job) {
  const { modelPath, body } = buildHiggsfieldGenerationRequest(job);
  const estimate = await estimateHiggsfieldRequest(secret, modelPath, body);
  if (!(estimate.credits > 0)) throw new Error("Higgsfield returned an invalid zero-credit estimate; generation was not submitted.");
  const { error: reserveError } = await admin.rpc("reserve_marketing_generation_estimate", { p_job_id: job.id, p_estimate: estimate.credits });
  if (reserveError) throw reserveError;
  const submitted = await submitHiggsfieldRequest(secret, modelPath, body);
  const nextStatus = submitted.status === "processing" ? "processing" : "submitted";
  const metadata = { ...(job.metadata || {}), model_path: modelPath, request_body: body, status_url: submitted.statusUrl, cancel_url: submitted.cancelUrl, estimate_usd: estimate.usd, provider_status: submitted.status, submitted_at: new Date().toISOString() };
  const { error: updateError } = await admin.from("marketing_generation_jobs").update({ status: nextStatus, provider_job_id: submitted.requestId, model: modelPath, metadata, error_message: null, updated_at: new Date().toISOString() }).eq("id", job.id);
  if (updateError) throw updateError;
  await admin.from("marketing_content_items").update({ generation_provider: "higgsfield", sub_status: "provider_processing", next_action: "Higgsfield is generating the creative asset", updated_at: new Date().toISOString() }).eq("id", job.content_item_id);
  await logActivity(admin, job, "provider_submitted", `Higgsfield accepted the ${job.generation_type} generation.`, { job_id: job.id, provider_job_id: submitted.requestId, model_path: modelPath, estimated_credits: estimate.credits });
  return { jobId: job.id, status: nextStatus, providerJobId: submitted.requestId, estimatedCredits: estimate.credits };
}

async function pollJob(admin: AdminClient, secret: Awaited<ReturnType<typeof getHiggsfieldSecret>>, job: Job) {
  if (!job.provider_job_id) throw new Error("Submitted Higgsfield job is missing provider_job_id");
  const statusUrl = typeof job.metadata?.status_url === "string" ? job.metadata.status_url : null;
  const result = await getHiggsfieldRequestStatus(secret, job.provider_job_id, statusUrl);
  const normalized = result.status.toLowerCase();
  if (["completed", "succeeded", "success"].includes(normalized)) {
    if (!result.assetUrl) throw new Error("Higgsfield completed the request but returned no media URL");
    const savedAssetUrl = await persistProviderAsset(admin, job, result.assetUrl);
    const actualCredits = Number(job.estimated_credits || 0);
    const { error: finishError } = await admin.from("marketing_generation_jobs").update({ status: "succeeded", actual_credits: actualCredits, asset_url: savedAssetUrl, error_message: null, metadata: { ...(job.metadata || {}), provider_status: result.status, provider_asset_url: result.assetUrl, completed_at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq("id", job.id);
    if (finishError) throw finishError;
    const contentUpdate: Record<string, unknown> = { asset_url: savedAssetUrl, generation_provider: "higgsfield", stage: "creative_review", sub_status: "quality_review", next_action: "Run Muse quality review", blocked_reason: null, error_message: null, updated_at: new Date().toISOString() };
    if (job.generation_type === "image") contentUpdate.thumbnail_url = savedAssetUrl;
    const { error: contentError } = await admin.from("marketing_content_items").update(contentUpdate).eq("id", job.content_item_id);
    if (contentError) throw contentError;
    await logActivity(admin, job, "provider_completed", `Higgsfield completed the ${job.generation_type}; the asset is saved permanently in Project You+.`, { job_id: job.id, provider_job_id: job.provider_job_id, asset_url: savedAssetUrl });
    return { jobId: job.id, status: "succeeded", assetUrl: savedAssetUrl };
  }
  if (["failed", "nsfw", "canceled", "cancelled"].includes(normalized)) {
    const terminal = normalized.startsWith("cancel") ? "cancelled" : "failed";
    const message = normalized === "nsfw" ? "Higgsfield moderation stopped this generation." : `Higgsfield generation ended with status ${result.status}.`;
    await admin.from("marketing_generation_jobs").update({ status: terminal, error_message: message, metadata: { ...(job.metadata || {}), provider_status: result.status, completed_at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("marketing_content_items").update({ sub_status: "generation_failed", blocked_reason: message, error_message: message, next_action: "Review the creative brief before retrying generation", updated_at: new Date().toISOString() }).eq("id", job.content_item_id);
    await logActivity(admin, job, "provider_failed", message, { job_id: job.id, provider_status: result.status });
    return { jobId: job.id, status: terminal, error: message };
  }
  const nextStatus = normalized === "queued" ? "submitted" : "processing";
  await admin.from("marketing_generation_jobs").update({ status: nextStatus, metadata: { ...(job.metadata || {}), provider_status: result.status, last_polled_at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq("id", job.id);
  return { jobId: job.id, status: nextStatus, providerStatus: result.status };
}

async function persistProviderAsset(admin: AdminClient, job: Job, remoteUrl: string) {
  const response = await fetch(remoteUrl, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Could not download Higgsfield output (${response.status})`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("Generated media exceeds the 25 MB marketing-assets storage limit");
  const contentType = response.headers.get("content-type") || (job.generation_type === "image" ? "image/jpeg" : "video/mp4");
  const extension = contentType.includes("png") ? "png" : contentType.includes("quicktime") ? "mov" : contentType.includes("video") ? "mp4" : "jpg";
  const path = `${job.owner_id}/${job.content_item_id}/${job.id}.${extension}`;
  const { error } = await admin.storage.from("marketing-assets").upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return admin.storage.from("marketing-assets").getPublicUrl(path).data.publicUrl;
}

async function logActivity(admin: AdminClient, job: Job, eventType: string, message: string, metadata: Record<string, unknown>) {
  await admin.from("marketing_activity_events").insert({ owner_id: job.owner_id, campaign_id: job.campaign_id, content_item_id: job.content_item_id, agent_id: "reels", event_type: eventType, message, metadata });
}
