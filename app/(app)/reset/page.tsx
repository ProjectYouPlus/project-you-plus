import { ResetExperience } from "@/components/reset/reset-experience";
import { getResetView } from "@/lib/reset/service";

export const dynamic = "force-dynamic";

export default async function ResetPage() {
  const view = await getResetView();
  return <ResetExperience view={view}/>;
}
