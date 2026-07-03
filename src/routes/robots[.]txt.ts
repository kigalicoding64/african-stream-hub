import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          "# IBONA (formerly Rebalive) — African-first video platform",
          "User-agent: *",
          "Allow: /",
          "",
          "# Do not index private/auth-only surfaces",
          "Disallow: /auth",
          "Disallow: /studio",
          "Disallow: /upload",
          "Disallow: /settings",
          "Disallow: /profile",
          "",
          "Sitemap: https://rebalive.egreedtech.org/sitemap.xml",
          "",
        ].join("\n");
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
