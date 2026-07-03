import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://rebalive.egreedtech.org";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticEntries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/trending", changefreq: "daily", priority: "0.9" },
          { path: "/movies", changefreq: "daily", priority: "0.9" },
          { path: "/music", changefreq: "daily", priority: "0.9" },
          { path: "/shorts", changefreq: "daily", priority: "0.9" },
          { path: "/search", changefreq: "weekly", priority: "0.6" },
          { path: "/auth", changefreq: "monthly", priority: "0.3" },
        ];

        const dynamicEntries: SitemapEntry[] = [];
        try {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const [videos, profiles] = await Promise.all([
              fetch(`${url}/rest/v1/videos?select=id&visibility=eq.public&status=eq.ready&limit=5000`, {
                headers: { apikey: key, Authorization: `Bearer ${key}` },
              }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
              fetch(`${url}/rest/v1/profiles?select=username&username=not.is.null&limit=5000`, {
                headers: { apikey: key, Authorization: `Bearer ${key}` },
              }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
            ]);
            for (const v of videos as { id: string }[]) {
              dynamicEntries.push({ path: `/watch/${v.id}`, changefreq: "weekly", priority: "0.7" });
            }
            for (const p of profiles as { username: string }[]) {
              if (p.username) dynamicEntries.push({ path: `/c/${p.username}`, changefreq: "weekly", priority: "0.6" });
            }
          }
        } catch { /* ignore — return static entries */ }

        const entries = [...staticEntries, ...dynamicEntries];
        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
