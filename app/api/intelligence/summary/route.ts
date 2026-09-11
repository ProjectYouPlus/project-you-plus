import{NextResponse}from"next/server";
import{buildUserContext}from"@/lib/ai/context";
import{buildRetentionIntelligence}from"@/lib/ai/retention-intelligence";
import{evaluateProgression}from"@/lib/progression/service";
export const runtime="nodejs";
export async function GET(){try{const context=await buildUserContext(),progression=await evaluateProgression(context);return NextResponse.json({summary:await buildRetentionIntelligence(context,progression)});}catch(error){const message=error instanceof Error?error.message:"Could not build intelligence summary.";return NextResponse.json({error:message},{status:message==="Not signed in."?401:500});}}
