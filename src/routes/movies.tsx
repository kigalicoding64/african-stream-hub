import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { VideoCard } from "@/components/VideoCard";
import { videos } from "@/data/videos";

export const Route = createFileRoute("/movies")({
  head: () => ({ meta: [
    { title: "Movies — IBONA" },
    { name: "description", content: "Premium African cinema and short films." },
    { property: "og:title", content: "Movies — IBONA" },
    { property: "og:description", content: "Films from Africa's brightest creators." },
  ]}),
  component: () => {
    const list = videos.filter((v) => v.category === "Films");
    return (
      <AppLayout>
        <header className="mb-8">
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">🎬 Cinema</div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Movies</h1>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
          {list.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      </AppLayout>
    );
  },
});
