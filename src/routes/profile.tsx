import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { VideoCard } from "@/components/VideoCard";
import { videos } from "@/data/videos";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [
    { title: "Profile — IBONA" },
    { name: "description", content: "Your IBONA creator profile." },
    { property: "og:title", content: "Profile — IBONA" },
    { property: "og:description", content: "View your channel, videos and stats." },
  ]}),
  component: () => (
    <AppLayout>
      <section className="relative overflow-hidden rounded-3xl mb-8" style={{ background: "var(--gradient-brand)" }}>
        <div className="p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-6 text-primary-foreground">
          <div className="h-24 w-24 rounded-full ring-4 ring-background bg-background/30 backdrop-blur" />
          <div className="text-center sm:text-left">
            <div className="text-xs font-bold uppercase tracking-widest opacity-80">Creator</div>
            <h1 className="text-3xl sm:text-4xl font-black">Murenzi Eric</h1>
            <p className="opacity-90 mt-1">12.4K subscribers · 48 videos · Kigali, Rwanda</p>
            <div className="mt-3 flex gap-2 justify-center sm:justify-start">
              <button className="rounded-full bg-background text-foreground px-4 py-1.5 text-sm font-bold">Edit profile</button>
              <button className="rounded-full bg-background/20 backdrop-blur border border-background/40 px-4 py-1.5 text-sm font-bold">Share</button>
            </div>
          </div>
        </div>
      </section>
      <h2 className="text-xl font-bold mb-4">Your videos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
        {videos.slice(0, 4).map((v) => <VideoCard key={v.id} video={v} />)}
      </div>
    </AppLayout>
  ),
});
