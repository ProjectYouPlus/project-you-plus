import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDailyMarketingPlanForOwner } from "@/lib/marketing/daily-planner";
import { processMarketingAgentQueueForOwner } from "@/lib/marketing/runtime-agents";
import { processHiggsfieldQueueForOwner } from "@/lib/marketing/higgsfield-worker";
import { publishDueInstagramContent } from "@/lib/marketing/instagram-worker";

export const maxDuration = 60;

type RuntimeMode = "plan" | "agents" | "provider" | "publish" | "all";

export async function POST(request: Request) {
  const admin = createAdminClient();
  const authorized = await verifyRuntimeToken(admin, request.headers.get("authorization"));
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestedMode = new URL(request.url).searchParams.get("mode") || "all";
  const mode: RuntimeMode = ["plan", "agents", "provider", "publish", "all"].includes(requestedMode) ? requestedMode as RuntimeMode : "all";
  const ownerIds = await getMarketingOwnerIds(admin);
  const owners: Array<Record<string, unknown>> = [];

  for (const ownerId of ownerIds.slice(0, 5)) {
    const ownerResult: Record<string, unknown> = { ownerId };

    if (mode === "plan" || mode === "all") {
      try {
        ownerResult.plan = await ensureDailyMarketingPlanForOwner(ownerId);
      } catch (error) {
        ownerResult.planError = error instanceof Error ? error.message : "Daily planner failed";
      }
    }

    if (mode === "agents" || mode === "all") {
      try {
        ownerResult.agents = await processMarketingAgentQueueForOwner(ownerId, mode === "agents" ? 2 : 1);
      } catch (error) {
        ownerResult.agentError = error instanceof Error ? error.message : "Agent runtime failed";
      }
    }

    if (mode === "provider" || mode === "all") {
      try {
        ownerResult.higgsfield = await processHiggsfieldQueueForOwner(ownerId, mode === "provider" ? 2 : 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Higgsfield runtime failed";
        ownerResult.higgsfield = message.includes("not connected") ? [] : [{ status: "error", error: message }];
      }
    }

    if (mode === "publish" || mode === "all") {
      try {
        ownerResult.instagram = await publishDueInstagramContent(ownerId, 1);
      } catch (error) {
        ownerResult.instagramError = error instanceof Error ? error.message : "Instagram publishing runtime failed";
      }
    }
    owners.push(ownerResult);
  }

  return NextResponse.json({ ok: true, mode, processedOwners: owners.length, owners, ranAt: new Date().toISOString() });
}

async function verifyRuntimeToken(admin: ReturnType<typeof createAdminClient>, authorization: string | null) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return false;
  const { data: expectedHash, error } = await admin.rpc("get_marketing_runtime_token_hash");
  if (error || typeof expectedHash !== "string") return false;
  const actualHash = createHash("sha256").update(token).digest("hex");
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function getMarketingOwnerIds(admin: ReturnType<typeof createAdminClient>) {
  const [settings, budgets, integrations] = await Promise.all([
    admin.from("marketing_agent_settings").select("owner_id").limit(100),
    admin.from("marketing_credit_budgets").select("owner_id").limit(100),
    admin.from("integrations").select("user_id").in("provider", ["instagram", "higgsfield"]).limit(100),
  ]);
  for (const result of [settings, budgets, integrations]) if (result.error) throw result.error;
  return [...new Set([
    ...(settings.data || []).map((row) => String(row.owner_id)),
    ...(budgets.data || []).map((row) => String(row.owner_id)),
    ...(integrations.data || []).map((row) => String(row.user_id)),
  ].filter(Boolean))];
}
