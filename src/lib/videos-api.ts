import { supabase } from "@/integrations/supabase/client";
import { videos as mockVideos, type Video } from "@/data/videos";

export interface DbVideo {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  language: "Kinyarwanda" | "Swahili" | "English";
  category: "Music" | "Comedy" | "Films" | "Agasobanuye";
  visibility: "public" | "unlisted" | "private";
  status: "processing" | "ready" | "failed";
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  views: number;
  likes: number;
  created_at: string;
  profiles?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

const FALLBACK_THUMB = "/placeholder.svg";

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(s: number | null | undefined): string {
  if (!s || s < 1) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function dbToVideo(v: DbVideo): Video {
  const creator = v.profiles?.display_name || v.profiles?.username || "Creator";
  return {
    id: v.id,
    title: v.title,
    creator,
    creatorAvatar: v.profiles?.avatar_url ?? undefined,
    thumbnail: v.thumbnail_url || FALLBACK_THUMB,
    previewSrc: v.video_url,
    views: formatViews(v.views ?? 0),
    duration: formatDuration(v.duration_seconds),
    language: v.language,
    category: v.category,
    description: v.description ?? "",
    uploadedAt: relTime(v.created_at),
  };
}

export async function fetchPublishedVideos(limit = 50): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*, profiles(display_name, username, avatar_url)")
    .eq("visibility", "public")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as DbVideo[]).map(dbToVideo);
}

export async function fetchAllFeed(): Promise<Video[]> {
  const dbVideos = await fetchPublishedVideos(50);
  // Real uploads first, then mock catalog
  return [...dbVideos, ...mockVideos];
}

export async function fetchVideoById(id: string): Promise<Video | null> {
  const { data, error } = await supabase
    .from("videos")
    .select("*, profiles(display_name, username, avatar_url)")
    .eq("id", id)
    .maybeSingle();
  if (!error && data) return dbToVideo(data as unknown as DbVideo);
  return null;
}

export async function incrementVideoView(id: string): Promise<void> {
  // Best-effort, fire-and-forget. UUID-shaped only.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  try {
    const { data } = await supabase.from("videos").select("views").eq("id", id).maybeSingle();
    if (data) {
      await supabase.from("videos").update({ views: (data.views ?? 0) + 1 }).eq("id", id);
    }
  } catch {
    /* ignore */
  }
}
