import { MetadataRoute } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://web-production-c6ed5.up.railway.app";
const SITE_ID = process.env.NEXT_PUBLIC_SITE_ID || "d3920d22-2c34-40b1-9e8e-59142af08e2a";
const SITE_URL = "https://colchonespanama.com";

interface ArticleMeta {
  slug: string;
  updated_at: string;
}

async function getArticles(): Promise<ArticleMeta[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/content?site_id=${SITE_ID}&status=approved`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: ArticleMeta[] = Array.isArray(data) ? data : (data.items ?? []);
    return items.filter((a) => a.slug);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getArticles();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL,                    lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${SITE_URL}/mejores`,       lastModified: new Date(), changeFrequency: "weekly",  priority: 0.9 },
    { url: `${SITE_URL}/quiz`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/blog`,          lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${SITE_URL}/sobre`,         lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contacto`,      lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/blog/${a.slug}`,
    lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...articleRoutes];
}
