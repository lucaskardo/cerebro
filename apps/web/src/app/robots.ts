import type { MetadataRoute } from "next";

const BASE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      // Allow AI crawlers (critical for AI Overviews / Perplexity)
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
