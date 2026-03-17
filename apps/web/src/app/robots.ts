import type { MetadataRoute } from "next";

const BASE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      // AI crawlers — critical for AI Overviews, Perplexity, Claude, etc.
      { userAgent: "Googlebot", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Bytespider", allow: "/" },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
