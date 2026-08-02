import { createServerFn } from "@tanstack/react-start";

const BASE_URL = "https://rebalive.egreedtech.org";
const SITEMAP_INDEX = `${BASE_URL}/sitemap.xml`;

async function pingEngines(): Promise<{ ok: boolean; pinged: string[] }> {
  const targets = [
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_INDEX)}`,
    `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_INDEX)}`,
  ];
  const pinged: string[] = [];
  await Promise.all(
    targets.map(async (t) => {
      try {
        const res = await fetch(t, { method: "GET" });
        if (res.ok) pinged.push(new URL(t).host);
      } catch {
        /* non-fatal */
      }
    }),
  );
  return { ok: true, pinged };
}

/**
 * Notify search engines that the sitemap index changed.
 * Sitemaps themselves are generated per-request from the database, so nothing
 * needs rebuilding — this only nudges crawlers to re-fetch them.
 */
export const notifySitemapUpdated = createServerFn({ method: "POST" }).handler(async () => {
  return await pingEngines();
});

export { SITEMAP_INDEX, pingEngines };
