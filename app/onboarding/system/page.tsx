import { redirect } from "next/navigation";
import { SystemProposalShell } from "@/components/onboarding/system-proposal-shell";
import { getAutoBuildSession } from "@/lib/data/onboarding-system";
import "../onboarding.css";

export default async function OnboardingSystemPage({searchParams}:{searchParams?:{session?:string}}){
  const sessionId=typeof searchParams?.session==="string"?searchParams.session:"";
  if(!sessionId)redirect("/onboarding");
  const session=await getAutoBuildSession(sessionId);if(!session)redirect("/onboarding");
  return <SystemProposalShell session={session}/>;
}
