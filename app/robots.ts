import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/help", "/help/*", "/legal/*", "/signup"],
        disallow: ["/api/", "/dashboard", "/products", "/settings", "/tags", "/discover", "/activity"],
      },
    ],
    sitemap: "https://rivlr.app/sitemap.xml",
  };
}
