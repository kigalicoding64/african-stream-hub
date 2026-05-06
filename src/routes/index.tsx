import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Hero } from "@/components/Hero";
import { VideoRail } from "@/components/VideoRail";
import { VideoCard } from "@/components/VideoCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { videos as mockVideos, isPopularAfrica, type Video } from "@/data/videos";
import { fetchPrioritizedFeed } from "@/lib/videos-api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const [category, setCategory] = useState("All");
  const [feed, setFeed] = useState<Video[]>(mockVideos);

  useEffect(() => {
    let cancelled = false;
    const load = () => fetchPrioritizedFeed(user?.id ?? null).then((list) => {
      if (!cancelled && list.length) setFeed(list);
    });
    load();
    const ch = supabase
      .channel("videos-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "videos" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const featured = feed[0] ?? mockVideos[0];
  const trending = useMemo(() => feed.slice(0, 6), [feed]);
  const filtered = useMemo(
    () => (category === "All" ? feed : feed.filter((v) => v.category === category)),
    [feed, category]
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
