import { createAdminClient } from "@/lib/supabase/admin";
import { publishInstagramContent } from "@/lib/integrations/instagram";

export async function publishDueInstagramContent(ownerId: string, limit = 2) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: items, error } = await admin
    .from("marketing_content_items")
    .select("id,owner_id,campaign_id,title,format,caption,asset_url,metrics,stage,approval_status,scheduled_for")
    .eq("owner_id", ownerId)
    .eq("stage", "scheduled")
    .eq("approval_status", "approved")
    .is("instagram_media_id", null)
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(Math.max(1, Math.min(3, limit)));
  if (error) throw error;

  const results: Array<Record<string, unknown>> = [];
  for (const item of items || []) {
    try {
      const instagramMediaId = await publishInstagramContent(ownerId, item);
      const publishedAt = new Date().toISOString();
      const { error: updateError } = await admin.from("marketing_content_items").update({
        stage: "published",
        sub_status: "vector_analysis_scheduled",
        instagram_media_id: instagramMediaId,
        published_at: publishedAt,
        next_action: "Vector will analyze performance after Instagram data arrives",
        blocked_reason: null,
        error_message: null,
        updated_at: publishedAt,
      }).eq("id", item.id);
      if (updateError) throw updateError;
      await admin.from("marketing_activity_events").insert({
        owner_id: ownerId,
        campaign_id: item.campaign_id,
        content_item_id: item.id,
        agent_id: "orchestrator",
        event_type: "instagram_published",
        message: `Published ${item.title} to Instagram.`,
        metadata: { instagram_media_id: instagramMediaId, published_at: publishedAt },
      });
      results.push({ contentItemId: item.id, status: "published", instagramMediaId });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Instagram publish failed";
      await admin.from("marketing_content_items").update({
        sub_status: "publish_failed",
        error_message: message,
        blocked_reason: message,
        next_action: "Review Instagram publishing error",
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      await admin.from("marketing_activity_events").insert({
        owner_id: ownerId,
        campaign_id: item.campaign_id,
        content_item_id: item.id,
        agent_id: "orchestrator",
        event_type: "instagram_publish_failed",
        message: `Instagram publish failed: ${message}`,
        metadata: { error: message },
      });
      results.push({ contentItemId: item.id, status: "error", error: message });
    }
  }
  return results;
}
