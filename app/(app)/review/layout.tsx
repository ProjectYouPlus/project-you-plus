import type { ReactNode } from "react";
import { ResetCard } from "@/components/reset/reset-card";

export default function ResetAwareLayout({ children }: { children: ReactNode }) {
  return <><div className="py-mobile-shell md:py-shell-narrow pt-3"><ResetCard surface="review"/></div>{children}</>;
}
