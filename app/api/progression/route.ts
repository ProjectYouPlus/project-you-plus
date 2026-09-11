import { NextResponse } from "next/server";
import { buildUserContext } from "@/lib/ai/context";
import { evaluateProgression } from "@/lib/progression/service";
export const runtime="nodejs";
export async function GET(){try{return NextResponse.json({progression:await evaluateProgression(await buildUserContext())});}catch(error){const message=error instanceof Error?error.message:"Could not evaluate progression.";return NextResponse.json({error:message},{status:message==="Not signed in."?401:500});}}
