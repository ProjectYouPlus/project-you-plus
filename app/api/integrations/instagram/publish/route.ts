import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/owner/access";
import { publishInstagramContent } from "@/lib/integrations/instagram";

export async function POST(request: Request) {
  const { user, supabase } = await requireAdmin();
  const { contentId } = await request.json() as { contentId?: string };
  if (!contentId) return NextResponse.json({ error: "contentId is required" }, { status: 400 });
  const { data: item } = await supabase.from("marketing_content_items").select("id,owner_id,format,caption,metrics,approval_status").eq("id", contentId).eq("owner_id", user.id).maybeSingle();
  if (!item || item.approval_status !== "approved") return NextResponse.json({ error: "Only owner-approved content can be published" }, { status: 403 });
  try {
    const mediaId = await publishInstagramContent(user.id, item);
    await supabase.from("marketing_content_items").update({ instagram_media_id: mediaId, stage: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", item.id).eq("owner_id", user.id);
    return NextResponse.json({ id: mediaId });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Instagram publish failed" }, { status: 400 }); }
}
