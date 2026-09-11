import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setRecommendationDecision } from "@/lib/ai/recommendations";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as { decision?: "accepted" | "dismissed" };
    if (body.decision !== "accepted" && body.decision !== "dismissed") {
      return NextResponse.json({ error: "Decision must be accepted or dismissed." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const recommendation = await setRecommendationDecision(supabase, user.id, params.id, body.decision);
    if (!recommendation) return NextResponse.json({ error: "Recommendation is no longer pending." }, { status: 404 });

    // Accepted means the user approved the recommendation. Execution is intentionally separate:
    // a domain-specific action must perform the mutation and then mark this recommendation completed.
    return NextResponse.json({ recommendation, executed: false });
  } catch (error) {
    console.error("Recommendation decision error:", error);
    return NextResponse.json({ error: "Unable to update recommendation." }, { status: 500 });
  }
}
