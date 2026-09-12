import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/$", disallow: ["/api/", "/owner", "/dashboard", "/today", "/coach", "/review", "/onboarding", "/login", "/signup"] }, sitemap: "https://projectyouplus.com/sitemap.xml" }; }
