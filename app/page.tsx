import type { Metadata } from "next";
import { WEBSITE_DESCRIPTION, WEBSITE_URL, websiteStructuredData, serializeStructuredData } from "@/lib/website/seo";
import { PublicHomepage } from "@/components/website/homepage";
export const metadata: Metadata = {
  title: "Project You+ — Your AI Life Operating System",
  description: WEBSITE_DESCRIPTION,
  metadataBase: new URL(WEBSITE_URL),
  applicationName: "YOU+",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  alternates: { canonical: "https://projectyouplus.com" },
  openGraph: { locale: "en_US", type: "website", siteName: "Project You+", url: "https://projectyouplus.com", title: "Become who you said you would become.", description: "Your AI Life Operating System. Join the Project You+ private beta.", images: [{ url: "https://projectyouplus.com/website/social.png", width: 1200, height: 630, alt: "Project You+ — Become who you said you would become." }] },
  twitter: { card: "summary_large_image", title: "Project You+ — Your AI Life Operating System", description: "Become who you said you would become. Join the private beta.", images: ["https://projectyouplus.com/website/social.png"] },
  icons: { icon: "/website/icon.png", apple: "/website/icon.png" },
};
export default function RootPage() { return <><script id="website-structured-data" type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(websiteStructuredData) }} /><PublicHomepage /></>; }
