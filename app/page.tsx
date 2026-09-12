import type { Metadata } from "next";
import { PublicHomepage } from "@/components/website/homepage";
export const metadata: Metadata = {
  title: "Project You+ — Your AI Life Operating System",
  description: "Project You+ connects your goals, schedule, health, habits and finances to show where you are, what matters today and whether you’re actually moving forward.",
  alternates: { canonical: "https://projectyouplus.com" },
  openGraph: { type: "website", siteName: "Project You+", url: "https://projectyouplus.com", title: "Become who you said you would become.", description: "Your AI Life Operating System. Join the Project You+ private beta.", images: [{ url: "https://projectyouplus.com/website/social.png", width: 1200, height: 630, alt: "Project You+ — Become who you said you would become." }] },
  twitter: { card: "summary_large_image", title: "Project You+ — Your AI Life Operating System", description: "Become who you said you would become. Join the private beta.", images: ["https://projectyouplus.com/website/social.png"] },
  icons: { icon: "/website/icon.png", apple: "/website/icon.png" },
};
export default function RootPage() { return <PublicHomepage />; }
