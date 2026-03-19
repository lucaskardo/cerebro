import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const commonDisallow = ["/api/", "/_next/"];
  return {
    rules: [
      // Standard crawlers
      { userAgent: "*", allow: "/", disallow: commonDisallow },
      // AI training / answer-engine crawlers — explicitly welcome
      { userAgent: "GPTBot",         allow: "/" },
      { userAgent: "ClaudeBot",      allow: "/" },
      { userAgent: "PerplexityBot",  allow: "/" },
      { userAgent: "Amazonbot",      allow: "/" },
      { userAgent: "anthropic-ai",   allow: "/" },
      { userAgent: "CCBot",          allow: "/" },
    ],
    sitemap: "https://colchonespanama.com/sitemap.xml",
  };
}
