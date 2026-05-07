import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Loader2, Search as SearchIcon, Sparkles, EyeOff } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VideoCard } from "@/components/VideoCard";
import { searchAll, type CreatorProfile } from "@/lib/videos-api";
import { isPopularAfrica, type Video } from "@/data/videos";
import { useAuth } from "@/contexts/AuthContext";

const schema = z.object({
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(schema),
  head: ({ match }) => ({
    meta: [
      { title: `Search${match.search.q ? ` · ${match.search.q}` : ""} — IBONA` },
      { name: "description", content: "Search creators and content on IBONA." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [popularOnly, setPopularOnly] = useState(false);
  const [includeDrafts, setIncludeDrafts] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setVideos([]); setCreators([]); return; }
    setLoading(true);
    let cancelled = false;
    searchAll(q, { includeDrafts, viewerId: user?.id ?? null }).then((r) => {
      if (cancelled) return;
      setVideos(r.videos);
      setCreators(r.creators);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [q, includeDrafts, user?.id]);

  const shownVideos = useMemo(
    () => (popularOnly ? videos.filter(isPopularAfrica) : videos),
    [videos, popularOnly],
  );

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <SearchIcon className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              {q ? <>Results for <span className="text-primary">"{q}"</span></> : "Search"}
            </h1>
          </div>
          {q && (
            <button
              onClick={() => setPopularOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold border transition ${popularOnly ? "text-primary-foreground border-transparent shadow-[var(--shadow-glow)]" : "border-border bg-surface hover:bg-surface-elevated"}`}
              style={popularOnly ? { background: "var(--gradient-brand)" } : undefined}
            >
              <Sparkles className="h-3.5 w-3.5" /> Popular Africa
            </button>
          )}
        </div>

        {!q && <p className="text-muted-foreground">Type in the search bar to find creators or content.</p>}

        {loading && (
          <div className="py-10 flex justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching…
          </div>
        )}

        {!loading && q && creators.length === 0 && shownVideos.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
            {popularOnly ? "No Popular Africa matches — try toggling off the filter." : "No matches found."}
          </div>
        )}


        {creators.length > 0 && (
          <section>
            <h2 className="font-bold mb-3">Creators</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {creators.map((c) => (
                <Link
                  key={c.id}
                  to="/c/$username"
                  params={{ username: c.username ?? "" }}
                  className="rounded-2xl border border-border bg-surface p-4 hover:border-primary/50 transition flex items-center gap-3"
                >
                  <div
                    className="h-12 w-12 rounded-full bg-cover bg-center ring-2 ring-primary/30"
                    style={c.avatar_url ? { backgroundImage: `url(${c.avatar_url})` } : { background: "var(--gradient-brand)" }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.display_name || c.username}</div>
                    {c.username && <div className="text-xs text-muted-foreground truncate">@{c.username}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {shownVideos.length > 0 && (
          <section>
            <h2 className="font-bold mb-3">Content {popularOnly && <span className="text-xs font-medium text-muted-foreground ml-1">· Popular Africa only</span>}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {shownVideos.map((v) => <VideoCard key={v.id} video={v} />)}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
