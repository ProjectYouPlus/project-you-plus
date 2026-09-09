import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getProfile } from "@/lib/data/profile";

export default async function OnboardingPage() {
  const profile = await getProfile();
  return <OnboardingFlow initialName={profile.fullName ?? ""} />;
}
