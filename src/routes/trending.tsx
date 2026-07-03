import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { VideoCard } from "@/components/VideoCard";
import { fetchPublishedVideos } from "@/lib/videos-api";
import type { Video } from "@/data/videos";

function parseViews(s: string): number {
  if (!s) return 0;
  const m = s.match(/([\d.]+)\s*([KM]?)/i);
  if (!m) return Number(s) || 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] || "").toUpperCase();
  return unit === "M" ? n * 1_000_000 : unit === "K" ? n * 1_000 : n;
}

const TRENDING_DESC = "See what Africa is watching right now on IBONA — the most-viewed agasobanuye, film nyarwanda, music, comedy and news shorts trending across the continent this week.";

export const Route = createFileRoute("/trending")({
  head: () => ({
    meta: [
      { title: "Trending — Most-Watched African Videos | IBONA" },
      { name: "description", content: TRENDING_DESC },
      { property: "og:title", content: "Trending — Most-Watched African Videos | IBONA" },
      { property: "og:description", content: TRENDING_DESC },
      { property: "og:url", content: "https://rebalive.egreedtech.org/trending" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://rebalive.egreedtech.org/trending" }],
  }),
  component: TrendingPage,
});

function TrendingPage() {
  const [list, setList] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetchPublishedVideos(200).then((all) => {
      if (cancelled) return;
      setList(all.slice().sort((a, b) => parseViews(b.views) - parseViews(a.views)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <AppLayout>
      <header className="mb-8">
        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">🔥 Hot right now</div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Trending</h1>
        <p className="text-muted-foreground mt-2">The most-watched uploads across IBONA.</p>
      </header>
      {!loading && list.length === 0 ? (
        <p className="text-muted-foreground">No videos uploaded yet.</p>
      ) : (
        <section aria-labelledby="trending-grid-heading">
          <h2 id="trending-grid-heading" className="sr-only">Trending videos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
            {list.map((v) => <VideoCard key={v.id} video={v} />)}
          </div>
        </section>
      )}
    </AppLayout>
  );
}
