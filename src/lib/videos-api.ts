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
  media_type?: "video" | "audio" | null;
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
    creatorId: v.owner_id,
    creatorUsername: v.profiles?.username ?? undefined,
    creatorAvatar: v.profiles?.avatar_url ?? undefined,
    thumbnail: v.thumbnail_url || FALLBACK_THUMB,
    previewSrc: v.video_url,
    views: formatViews(v.views ?? 0),
    duration: formatDuration(v.duration_seconds),
    language: v.language,
    category: v.category,
    description: v.description ?? "",
    uploadedAt: relTime(v.created_at),
    mediaType: v.media_type ?? "video",
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

/** Returns feed with videos from creators the current user follows pinned to the top. */
export async function fetchPrioritizedFeed(userId: string | null): Promise<Video[]> {
  const all = await fetchAllFeed();
  if (!userId) return all;
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  const followedIds = new Set((data ?? []).map((r) => r.following_id as string));
  if (followedIds.size === 0) return all;
  const followed: Video[] = [];
  const others: Video[] = [];
  for (const v of all) {
    if (v.creatorId && followedIds.has(v.creatorId)) followed.push(v);
    else others.push(v);
  }
  return [...followed, ...others];
}

// ---- Follows ----

export async function getFollowState(creatorId: string, viewerId: string | null): Promise<{ following: boolean; followers: number }> {
  const [{ count }, mine] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", creatorId),
    viewerId
      ? supabase.from("follows").select("id").eq("follower_id", viewerId).eq("following_id", creatorId).maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
  ]);
  return { following: !!(mine as { data: unknown }).data, followers: count ?? 0 };
}

export async function followCreator(creatorId: string, viewerId: string): Promise<void> {
  const { error } = await supabase.from("follows").insert({ follower_id: viewerId, following_id: creatorId });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function unfollowCreator(creatorId: string, viewerId: string): Promise<void> {
  const { error } = await supabase.from("follows").delete().eq("follower_id", viewerId).eq("following_id", creatorId);
  if (error) throw error;
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

export interface CreatorProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
}

export async function fetchProfileByUsername(username: string): Promise<CreatorProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, banner_url, bio")
    .eq("username", username)
    .maybeSingle();
  return (data as CreatorProfile) ?? null;
}

export async function fetchVideosByOwner(ownerId: string): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*, profiles(display_name, username, avatar_url)")
    .eq("owner_id", ownerId)
    .eq("visibility", "public")
    .eq("status", "ready")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as DbVideo[]).map(dbToVideo);
}
