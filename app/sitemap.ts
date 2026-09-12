import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://projectyouplus.com", lastModified: "2026-09-12", changeFrequency: "weekly", priority: 1 }];
}
