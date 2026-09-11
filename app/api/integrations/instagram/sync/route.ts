import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/owner/access";
import { syncInstagramForOwner } from "@/lib/integrations/instagram";

export async function POST() {
  const { user } = await requireAdmin();
  try { return NextResponse.json(await syncInstagramForOwner(user.id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Instagram sync failed" }, { status: 400 }); }
}
