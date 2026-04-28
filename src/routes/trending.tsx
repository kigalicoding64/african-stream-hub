import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { VideoCard } from "@/components/VideoCard";
import { getTrending } from "@/data/videos";

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
  const list = getTrending();
  return (
    <AppLayout>
      <header className="mb-8">
        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">🔥 Hot right now</div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Trending</h1>
        <p className="text-muted-foreground mt-2">The most-watched videos across Africa this week.</p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
        {list.map((v) => <VideoCard key={v.id} video={v} />)}
      </div>
    </AppLayout>
  );
}
