import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/owner/access";

export const dynamic = "force-dynamic";

export default async function OwnerPage(){
  await requireAdmin();
  redirect("/owner/agents");
}
