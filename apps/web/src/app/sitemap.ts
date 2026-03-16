import type { MetadataRoute } from "next";
import { api } from "@/lib/api";

const BASE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/articulos`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    {
      url: `${BASE_URL}/herramientas/calculadora-remesas`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  try {
    const articles = await api.sitemap();
    const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
      url: `${BASE_URL}/articulo/${a.slug}`,
      lastModified: new Date(a.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
    return [...staticRoutes, ...articleRoutes];
  } catch {
    return staticRoutes;
  }
}
