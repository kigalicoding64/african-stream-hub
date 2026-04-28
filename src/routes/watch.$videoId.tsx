import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Languages,
  X,
  Check,
  Volume2,
  Maximize2,
  Pause,
  Play,
  Send,
  Subtitles,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VideoCard } from "@/components/VideoCard";
import { getVideoById, videos, type Language } from "@/data/videos";

export const Route = createFileRoute("/watch/$videoId")({
  loader: ({ params }) => {
    const video = getVideoById(params.videoId);
    if (!video) throw notFound();
    return { video };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.video.title} — IBONA` },
          { name: "description", content: loaderData.video.description },
          { property: "og:title", content: loaderData.video.title },
          { property: "og:description", content: loaderData.video.description },
          { property: "og:image", content: loaderData.video.thumbnail },
        ]
      : [],
  }),
  errorComponent: ({ error }) => (
    <AppLayout>
      <div className="py-20 text-center text-muted-foreground">{error.message}</div>
    </AppLayout>
  ),
  notFoundComponent: () => (
    <AppLayout>
      <div className="py-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Video not found</h2>
        <Link to="/" className="text-primary underline">
          Back home
        </Link>
      </div>
    </AppLayout>
  ),
  component: WatchPage,
});

interface Comment {
  id: string;
  user: string;
  text: string;
  time: string;
}

const SAMPLE_COMMENTS: Comment[] = [
  { id: "c1", user: "Aline K.", text: "This is fire 🔥 Murakoze cyane!", time: "2h" },
  { id: "c2", user: "Eric M.", text: "Agasobanuye mode ni nziza pe.", time: "5h" },
  { id: "c3", user: "Diane U.", text: "Quality is amazing on slow internet.", time: "1d" },
];

const SUBTITLE_LINES: Record<Language, string> = {
  Kinyarwanda: "Murakaza neza kuri IBONA — reba ibikorwa bisobanutse mu Kinyarwanda.",
  Swahili: "Karibu IBONA — tazama maudhui yako kwa Kiswahili.",
  English: "Welcome to IBONA — watch your stories, your way.",
};

function WatchPage() {
  const { video } = Route.useLoaderData();
  const [liked, setLiked] = useState(false);
  const [agaMode, setAgaMode] = useState(false);
  const [language, setLanguage] = useState<Language>(video.language);
  const [showAgaPanel, setShowAgaPanel] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [showMini, setShowMini] = useState(false);
  const [comments, setComments] = useState<Comment[]>(SAMPLE_COMMENTS);
  const [draft, setDraft] = useState("");

  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const miniRef = useRef<HTMLVideoElement>(null);

  // Floating mini-player on scroll
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setShowMini(!e.isIntersecting), { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMini = () => {
    const v = miniRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
    setPlaying(!v.paused);
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setComments((p) => [
      { id: `c-${Date.now()}`, user: "You", text: draft.trim(), time: "now" },
      ...p,
    ]);
    setDraft("");
  };

  const suggestions = videos.filter((v) => v.id !== video.id).slice(0, 6);

  return (
    <AppLayout>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 animate-fade-in">
        <div className="min-w-0">
          {/* Player */}
          <div
            ref={playerRef}
            className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-border shadow-[var(--shadow-elegant)] group"
          >
            <video
              ref={videoRef}
              src={video.previewSrc}
              poster={video.thumbnail}
              autoPlay
              loop
              playsInline
              className="h-full w-full object-cover"
              onClick={togglePlay}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
            {/* Overlay controls */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
              <ActionPill icon={Heart} label="Like" active={liked} onClick={() => setLiked((p) => !p)} />
              <ActionPill icon={MessageCircle} label="Comments" active={showComments} onClick={() => setShowComments((p) => !p)} />
              <ActionPill icon={Share2} label="Share" />
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={togglePlay}
                className="h-10 w-10 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center hover:scale-105 transition"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
              </button>
              <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full w-1/3" style={{ background: "var(--gradient-brand)" }} />
              </div>

              {/* In-player subtitle / language switcher */}
              <div className="relative">
                <button
                  onClick={() => setShowSubMenu((p) => !p)}
                  className={`h-9 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold backdrop-blur transition ${agaMode ? "bg-primary text-primary-foreground" : "bg-white/10 text-white hover:bg-white/20"}`}
                  aria-label="Subtitles & language"
                >
                  <Subtitles className="h-4 w-4" />
                  <span className="hidden sm:inline">{language.slice(0, 3).toUpperCase()}</span>
                </button>
                {showSubMenu && (
                  <div
                    className="absolute bottom-12 right-0 w-64 rounded-xl border border-border bg-surface/95 backdrop-blur-xl p-2 shadow-[var(--shadow-elegant)] animate-scale-in z-10"
                    onMouseLeave={() => setShowSubMenu(false)}
                  >
                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                      Agasobanuye Mode
                    </div>
                    {(["Kinyarwanda", "Swahili", "English"] as Language[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => {
                          setLanguage(l);
                          setAgaMode(true);
                          setShowSubMenu(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${language === l && agaMode ? "bg-primary/15 text-primary" : "hover:bg-surface-elevated"}`}
                      >
                        <span className="font-semibold">{l}</span>
                        {language === l && agaMode && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                    <div className="mt-1 border-t border-border pt-1">
                      <label className="flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-surface-elevated">
                        <span>Show subtitles</span>
                        <input
                          type="checkbox"
                          checked={agaMode}
                          onChange={(e) => setAgaMode(e.target.checked)}
                          className="h-4 w-4 accent-[oklch(0.78_0.16_60)]"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <button
                className="h-9 w-9 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20 transition"
                aria-label="Volume"
              >
                <Volume2 className="h-4 w-4" />
              </button>
              <button
                className="h-9 w-9 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20 transition"
                aria-label="Fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            {/* Subtitle line */}
            {agaMode && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-[80%] rounded-lg bg-black/75 backdrop-blur px-4 py-2 text-center text-sm sm:text-base font-medium pointer-events-none">
                <span className="text-primary text-xs uppercase tracking-wider mr-2">{language.slice(0, 3)}</span>
                {SUBTITLE_LINES[language]}
              </div>
            )}

            {/* Comments overlay panel (slides over player) */}
            {showComments && (
              <div className="absolute inset-y-0 right-0 w-full sm:w-[360px] bg-background/95 backdrop-blur-xl border-l border-border flex flex-col animate-slide-in-right z-20">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-primary">Live</div>
                    <div className="font-bold">{comments.length} comments</div>
                  </div>
                  <button
                    onClick={() => setShowComments(false)}
                    className="h-8 w-8 rounded-full bg-surface flex items-center justify-center hover:bg-surface-elevated"
                    aria-label="Close comments"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div
                        className="h-8 w-8 shrink-0 rounded-full ring-2 ring-border"
                        style={{ background: "var(--gradient-brand)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold truncate">{c.user}</span>
                          <span className="text-[10px] text-muted-foreground">{c.time}</span>
                        </div>
                        <p className="text-sm text-foreground/90 break-words">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={submitComment} className="p-3 border-t border-border flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add a comment…"
                    className="flex-1 rounded-full bg-surface border border-border px-4 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="h-10 w-10 rounded-full text-primary-foreground flex items-center justify-center disabled:opacity-50"
                    style={{ background: "var(--gradient-brand)" }}
                    disabled={!draft.trim()}
                    aria-label="Post comment"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Title + meta */}
          <div className="mt-5">
            <div className="flex flex-wrap gap-2 mb-3">
              <Tag>{video.category}</Tag>
              <Tag>{language}</Tag>
              <Tag>{video.views} views</Tag>
              <Tag>{video.uploadedAt}</Tag>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{video.title}</h1>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-11 w-11 rounded-full ring-2 ring-primary/40"
                  style={{ background: "var(--gradient-brand)" }}
                />
                <div>
                  <div className="font-semibold">{video.creator}</div>
                  <div className="text-xs text-muted-foreground">142K subscribers</div>
                </div>
                <button
                  className="ml-2 rounded-full px-4 py-2 text-sm font-bold text-primary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  Subscribe
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setLiked((p) => !p)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${liked ? "border-accent text-accent bg-accent/10" : "border-border bg-surface hover:bg-surface-elevated"}`}
                >
                  <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {liked ? "Liked" : "Like"}
                </button>
                <button
                  onClick={() => setShowComments(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface hover:bg-surface-elevated px-4 py-2 text-sm font-semibold transition"
                >
                  <MessageCircle className="h-4 w-4" /> Comment
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-border bg-surface hover:bg-surface-elevated px-4 py-2 text-sm font-semibold transition">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>
            </div>

            {/* Agasobanuye Mode CTA */}
            <button
              onClick={() => setShowAgaPanel(true)}
              className="mt-5 group relative w-full overflow-hidden rounded-2xl border border-secondary/40 p-5 text-left transition hover:border-secondary"
              style={{ background: "linear-gradient(135deg, oklch(0.55 0.14 165 / 0.15), oklch(0.78 0.16 60 / 0.1))" }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-secondary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Languages className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-primary">★ IBONA Signature</div>
                  <div className="text-lg font-bold">Watch in Kinyarwanda</div>
                  <p className="text-sm text-muted-foreground">
                    Switch language &amp; subtitles. Built for African storytelling.
                  </p>
                </div>
                <span className="hidden sm:inline-flex rounded-full bg-background/60 px-3 py-1.5 text-xs font-semibold border border-border">
                  Open
                </span>
              </div>
            </button>

            {/* Description */}
            <div className="mt-5 rounded-2xl bg-surface border border-border p-4">
              <p className="text-sm text-foreground/90 whitespace-pre-line">{video.description}</p>
            </div>
          </div>

          {/* Mobile suggestions */}
          <div className="lg:hidden mt-8">
            <h3 className="font-bold mb-4">Up next</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {suggestions.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </div>
        </div>

        {/* Desktop suggestions sidebar */}
        <aside className="hidden lg:block">
          <h3 className="font-bold mb-4">Up next</h3>
          <div className="space-y-4">
            {suggestions.map((v) => (
              <Link
                key={v.id}
                to="/watch/$videoId"
                params={{ videoId: v.id }}
                className="group flex gap-3"
              >
                <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg ring-1 ring-border group-hover:ring-primary/50 transition">
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-[10px] font-mono">
                    {v.duration}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition">
                    {v.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{v.creator}</div>
                  <div className="text-[11px] text-muted-foreground">{v.views} views</div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </div>

      {/* Floating mini player */}
      {showMini && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 z-40 w-72 animate-scale-in rounded-xl overflow-hidden ring-1 ring-border shadow-[var(--shadow-elegant)] bg-black">
          <div className="relative aspect-video group">
            <video
              ref={miniRef}
              src={video.previewSrc}
              poster={video.thumbnail}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
              onClick={toggleMini}
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <button
                onClick={toggleMini}
                className="h-11 w-11 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center hover:scale-110 transition"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
              </button>
            </div>
            <button
              onClick={() => setShowMini(false)}
              className="absolute top-1 right-1 h-7 w-7 rounded-full bg-background/80 flex items-center justify-center hover:bg-background"
              aria-label="Close mini player"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-2.5 bg-surface flex items-center gap-2">
            <button
              onClick={toggleMini}
              className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition shrink-0"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
            </button>
            <div className="min-w-0">
              <div className="text-xs font-semibold line-clamp-1">{video.title}</div>
              <div className="text-[10px] text-muted-foreground">{video.creator}</div>
            </div>
          </div>
        </div>
      )}

      {/* Agasobanuye language panel */}
      {showAgaPanel && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAgaPanel(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-surface p-6 animate-scale-in"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary">Agasobanuye Mode</div>
                <h3 className="text-xl font-bold mt-0.5">Choose your language</h3>
              </div>
              <button
                onClick={() => setShowAgaPanel(false)}
                className="h-8 w-8 rounded-full bg-background flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {(["Kinyarwanda", "Swahili", "English"] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setLanguage(l);
                    setAgaMode(true);
                    setShowAgaPanel(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${language === l ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-surface-elevated"}`}
                >
                  <div>
                    <div className="font-semibold">{l}</div>
                    <div className="text-xs text-muted-foreground">
                      {l === "Kinyarwanda" ? "Ubusobanuro bwuzuye" : l === "Swahili" ? "Tafsiri kamili" : "Full subtitles"}
                    </div>
                  </div>
                  {language === l && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
            <label className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 cursor-pointer">
              <span className="text-sm font-semibold">Show subtitles</span>
              <input
                type="checkbox"
                checked={agaMode}
                onChange={(e) => setAgaMode(e.target.checked)}
                className="h-5 w-5 accent-[oklch(0.78_0.16_60)]"
              />
            </label>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

function ActionPill({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`pointer-events-auto h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-md transition hover:scale-110 ${active ? "bg-accent text-accent-foreground" : "bg-black/40 text-white hover:bg-black/60"}`}
    >
      <Icon className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
    </button>
  );
}
