import type { Metadata } from "next";
import { CelebrationLab } from "@/components/celebration-preview/celebration-lab";

export const metadata: Metadata = {
  title: "Celebration System Preview — Project You+",
  description: "Private design preview for Project You+ completion, achievement, and milestone feedback.",
  robots: { index: false, follow: false },
};

export default function CelebrationPreviewPage() {
  return <CelebrationLab />;
}
