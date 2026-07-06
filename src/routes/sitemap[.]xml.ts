import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://rebalive.egreedtech.org";

// Root sitemap index — points crawlers at the specialized child sitemaps.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString();
        const children = [
          { loc: `${BASE_URL}/sitemap-pages.xml`, lastmod: now },
          { loc: `${BASE_URL}/sitemap-videos.xml`, lastmod: now },
          { loc: `${BASE_URL}/sitemap-creators.xml`, lastmod: now },
        ];
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...children.map(
            (c) =>
              `  <sitemap>\n    <loc>${c.loc}</loc>\n    <lastmod>${c.lastmod}</lastmod>\n  </sitemap>`,
          ),
          `</sitemapindex>`,
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
