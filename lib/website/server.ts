import "server-only";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export class PublicRequestError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function readPublicRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || ![request.nextUrl.origin, "https://projectyouplus.com", "https://www.projectyouplus.com"].includes(origin)) throw new PublicRequestError("Please submit from the Project You+ website.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new PublicRequestError("Please submit the website form.", 415);
  if (Number(request.headers.get("content-length") || 0) > 8192) throw new PublicRequestError("This submission is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PublicRequestError("Please complete the form.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8192) { await reader.cancel(); throw new PublicRequestError("This submission is too large.", 413); } chunks.push(value); }
  try { const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(); return input as Record<string, unknown>; } catch { throw new PublicRequestError("Please complete the form and try again."); }
}
export async function limitPublicRequest(request: NextRequest, kind: "signup" | "event") {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Waitlist storage unavailable");
  // Vercel overwrites this header; no raw IP address is retained.
  const address = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || (process.env.VERCEL ? "unknown" : "local");
  const key = createHmac("sha256", secret).update(`${kind}:${address}`).digest("hex");
  const { data, error } = await createAdminClient().rpc("website_request_allowed", { p_key: key, p_limit: kind === "signup" ? 8 : 120 });
  if (error) throw new Error("Waitlist storage unavailable");
  if (!data) throw new PublicRequestError("A few too many requests. Please try again in a minute.", 429);
}
