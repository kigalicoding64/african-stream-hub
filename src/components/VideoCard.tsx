import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, Play } from "lucide-react";
import type { Video } from "@/data/videos";
import { useSettings } from "@/contexts/SettingsContext";

interface Props {
  video: Video;
  size?: "default" | "wide";
}

export function VideoCard({ video, size = "default" }: Props) {
  const { shouldReducePreviews } = useSettings();
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLAnchorElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);

  // Lazy mount + viewport-based autoplay (muted preview)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio > 0.6;
        setInView(visible);
        if (shouldReducePreviews) return; // never autoplay in low-data
        const v = vidRef.current;
        if (!v) return;
        if (visible) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: [0, 0.6, 1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shouldReducePreviews]);

  const onEnter = () => {
    setHovered(true);
    if (shouldReducePreviews) return;
    const v = vidRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  };
  const onLeave = () => {
    setHovered(false);
    if (!inView || shouldReducePreviews) vidRef.current?.pause();
  };
  const showVideo = !shouldReducePreviews && (hovered || inView);
  // In low-data mode, do not even mount the <video> element
  const mountVideo = !shouldReducePreviews && !!video.previewSrc && inView;

  return (
    <Link
      ref={containerRef}
      to="/watch/$videoId"
      params={{ videoId: video.id }}
      className={`group block ${size === "wide" ? "w-[340px] sm:w-[380px]" : "w-full"} shrink-0`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface ring-1 ring-border transition-all duration-300 group-hover:ring-primary/50 group-hover:scale-[1.02] group-hover:shadow-[var(--shadow-elegant)]">
        {!loaded && <div className="absolute inset-0 animate-pulse bg-surface-elevated" />}
        <img
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
          decoding="async"
          width={1024}
          height={576}
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${showVideo ? "opacity-0" : "opacity-100"}`}
        />
        {mountVideo && (
          <video
            ref={vidRef}
            src={video.previewSrc}
            muted
            playsInline
            loop
            preload="metadata"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${showVideo ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-card)" }} />

        {/* Top tags */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="rounded-md bg-background/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
            {video.category}
          </span>
          {video.visibility === "private" && (
            <span className="rounded-md bg-background/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 ring-1 ring-amber-400/40">
              Draft
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3">
          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
            {video.language}
          </span>
        </div>

        {/* Duration */}
        <div className="absolute bottom-3 right-3 rounded-md bg-background/80 backdrop-blur-md px-1.5 py-0.5 text-[11px] font-mono font-medium">
          {video.duration}
        </div>

        {/* Hover play button */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${hovered ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/95 shadow-[var(--shadow-glow)]">
            <Play className="h-6 w-6 fill-primary-foreground text-primary-foreground ml-0.5" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full ring-2 ring-border bg-cover bg-center" style={video.creatorAvatar ? { backgroundImage: `url(${video.creatorAvatar})` } : { background: "var(--gradient-brand)" }} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {video.title}
          </h3>
          {video.creatorUsername ? (
            <Link
              to="/c/$username"
              params={{ username: video.creatorUsername }}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 block text-xs text-muted-foreground truncate hover:text-primary transition-colors"
            >
              {video.creator}
            </Link>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground truncate">{video.creator}</p>
          )}
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Eye className="h-3 w-3" />
            <span>{video.views} views</span>
            <span className="mx-1">•</span>
            <span>{video.uploadedAt}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
