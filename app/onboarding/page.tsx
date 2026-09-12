import "./onboarding.css";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getOrCreateOnboardingSession } from "@/lib/actions/onboarding";
import { getProfile } from "@/lib/data/profile";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({searchParams}:{searchParams?:{mode?:string}}) {
  const profile=await getProfile();
  const mode=searchParams?.mode==="personalize"?"personalize":"initial";
  const session=await getOrCreateOnboardingSession(mode);
  const firstName=(profile.fullName??"").trim().split(/\s+/)[0]??"";
  return <OnboardingFlow initialSession={session} firstName={firstName}/>;
}
