import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { recentYears } from "@/lib/taxonomy";

const BASE_URL = "https://rebalive.egreedtech.org";

export const Route = createFileRoute("/sitemap-years.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString().slice(0, 10);
        const urls = recentYears().map((y) => {
          const loc = `${BASE_URL}/year/${y}`;
          return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`;
        });
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
