// Dynamic XML sitemap of all public, ready videos for search engines.
// Lives at /sitemap.xml — referenced from /robots.txt.
import { createServerFileRoute } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'https://rebalive.egreedtech.org';

export const ServerRoute = createServerFileRoute('/sitemap.xml').methods({
  GET: async () => {
    const { data: videos } = await supabaseAdmin
      .from('videos')
      .select('id, updated_at, thumbnail_url, title, description, duration_seconds, video_url')
      .eq('visibility', 'public')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(5000);

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('username, updated_at')
      .not('username', 'is', null)
      .limit(2000);

    const staticUrls = ['/', '/trending', '/music', '/movies', '/shorts', '/search', '/auth'];

    const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
    }[c] as string));

    const urls: string[] = [];
    for (const u of staticUrls) {
      urls.push(`<url><loc>${SITE_ORIGIN}${u}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`);
    }
    for (const v of videos ?? []) {
      const loc = `${SITE_ORIGIN}/watch/${v.id}`;
      const lastmod = new Date((v as { updated_at: string }).updated_at).toISOString();
      const thumb = (v as { thumbnail_url: string | null }).thumbnail_url;
      const title = xmlEscape((v as { title: string }).title.slice(0, 100));
      const desc = xmlEscape(((v as { description: string | null }).description ?? '').slice(0, 1900) || title);
      const dur = (v as { duration_seconds: number | null }).duration_seconds ?? 0;
      const contentLoc = xmlEscape((v as { video_url: string }).video_url);
      urls.push(
        `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority>` +
          `<video:video>` +
            (thumb ? `<video:thumbnail_loc>${xmlEscape(thumb)}</video:thumbnail_loc>` : '') +
            `<video:title>${title}</video:title>` +
            `<video:description>${desc}</video:description>` +
            `<video:content_loc>${contentLoc}</video:content_loc>` +
            (dur > 0 ? `<video:duration>${dur}</video:duration>` : '') +
            `<video:family_friendly>yes</video:family_friendly>` +
            `<video:publication_date>${lastmod}</video:publication_date>` +
          `</video:video>` +
        `</url>`,
      );
    }
    for (const p of profiles ?? []) {
      const u = (p as { username: string }).username;
      urls.push(`<url><loc>${SITE_ORIGIN}/c/${encodeURIComponent(u)}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
    }

    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${urls.join('\n')}\n</urlset>`;

    return new Response(body, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600, s-maxage=1800',
      },
    });
  },
});
