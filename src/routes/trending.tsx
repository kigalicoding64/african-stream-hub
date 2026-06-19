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

export const Route = createFileRoute("/trending")({
  head: () => ({ meta: [
    { title: "Trending — IBONA" },
    { name: "description", content: "What's hot right now across Africa." },
    { property: "og:title", content: "Trending — IBONA" },
    { property: "og:description", content: "The most-watched videos on IBONA this week." },
  ]}),
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
          {list.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      )}
    </AppLayout>
  );
}
