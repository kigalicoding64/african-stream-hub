import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Hero } from "@/components/Hero";
import { VideoRail } from "@/components/VideoRail";
import { VideoCard } from "@/components/VideoCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { videos, getTrending } from "@/data/videos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IBONA — African-First Video Streaming" },
      { name: "description", content: "Premium video streaming made for Africa. Music, Films, Comedy, and Agasobanuye in Kinyarwanda, Swahili and English." },
      { property: "og:title", content: "IBONA — African-First Video Streaming" },
      { property: "og:description", content: "Premium African video streaming. Smooth, fast, made for everyone." },
    ],
  }),
  component: Index,
});

function Index() {
  const [category, setCategory] = useState("All");
  const featured = videos[0];
  const trending = useMemo(() => getTrending().slice(0, 6), []);
  const filtered = useMemo(
    () => (category === "All" ? videos : videos.filter((v) => v.category === category)),
    [category]
  );

  return (
    <AppLayout>
      <div className="space-y-10 animate-fade-in">
        <Hero video={featured} />

        <VideoRail title="Trending in Rwanda" emoji="🔥" videos={trending} />

        <section>
          <div className="flex items-end justify-between mb-4 px-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Browse by category</h2>
          </div>
          <CategoryFilter active={category} onChange={setCategory} />
        </section>

        <section>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-4 px-1">For you</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
