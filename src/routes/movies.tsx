import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { VideoCard } from "@/components/VideoCard";
import { fetchPublishedVideos } from "@/lib/videos-api";
import type { Video } from "@/data/videos";

export const Route = createFileRoute("/movies")({
  head: () => ({ meta: [
    { title: "Movies — IBONA" },
    { name: "description", content: "Premium African cinema and short films." },
    { property: "og:title", content: "Movies — IBONA" },
    { property: "og:description", content: "Films from Africa's brightest creators." },
  ]}),
  component: MoviesPage,
});

function MoviesPage() {
  const [list, setList] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetchPublishedVideos(200).then((all) => {
      if (cancelled) return;
      setList(all.filter((v) => v.category === "Films"));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <AppLayout>
      <header className="mb-8">
        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">🎬 Cinema</div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Movies</h1>
      </header>
      {!loading && list.length === 0 ? (
        <p className="text-muted-foreground">No films uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
          {list.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      )}
    </AppLayout>
  );
}
