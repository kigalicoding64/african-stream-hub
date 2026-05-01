import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Film, UserPlus, UserCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VideoCard } from "@/components/VideoCard";
import { fetchProfileByUsername, fetchVideosByOwner, getFollowState, followCreator, unfollowCreator, type CreatorProfile } from "@/lib/videos-api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Video } from "@/data/videos";

export const Route = createFileRoute("/c/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — IBONA` },
      { name: "description", content: `Videos uploaded by @${params.username} on IBONA.` },
      { property: "og:title", content: `@${params.username} on IBONA` },
    ],
  }),
  component: CreatorPage,
});

function CreatorPage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      const p = await fetchProfileByUsername(username);
      if (cancelled) return;
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(p);
      const [vids, state] = await Promise.all([
        fetchVideosByOwner(p.id),
        getFollowState(p.id, user?.id ?? null),
      ]);
      if (!cancelled) {
        setVideos(vids);
        setFollowing(state.following);
        setFollowers(state.followers);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username, user?.id]);

  const isOwnProfile = !!user && !!profile && user.id === profile.id;

  const toggleFollow = async () => {
    if (!profile) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/c/${username}`, mode: "login" } });
      return;
    }
    setFollowBusy(true);
    try {
      if (following) {
        await unfollowCreator(profile.id, user.id);
        setFollowing(false);
        setFollowers((n) => Math.max(0, n - 1));
      } else {
        await followCreator(profile.id, user.id);
        setFollowing(true);
        setFollowers((n) => n + 1);
        toast.success(`Following ${profile.display_name || profile.username}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update follow");
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="py-20 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading creator…
        </div>
      </AppLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <AppLayout>
        <div className="py-20 text-center">
          <h2 className="text-2xl font-bold mb-2">Creator not found</h2>
          <p className="text-muted-foreground mb-4">No account exists for @{username}.</p>
          <Link to="/" className="text-primary font-semibold hover:underline">Back home</Link>
        </div>
      </AppLayout>
    );
  }

  const display = profile.display_name || profile.username || "Creator";
  const totalViews = videos.length; // We don't aggregate views client-side from list

  return (
    <AppLayout>
      <section
        className="relative overflow-hidden rounded-3xl mb-8"
        style={{ background: profile.banner_url ? `url(${profile.banner_url}) center/cover` : "var(--gradient-brand)" }}
      >
        <div className="bg-black/30 p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-6 text-primary-foreground">
          <div
            className="h-24 w-24 rounded-full ring-4 ring-background bg-cover bg-center shrink-0"
            style={
              profile.avatar_url
                ? { backgroundImage: `url(${profile.avatar_url})` }
                : { background: "var(--gradient-brand)" }
            }
          />
          <div className="text-center sm:text-left min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest opacity-80">Creator</div>
            <h1 className="text-3xl sm:text-4xl font-black truncate">{display}</h1>
            {profile.username && (
              <p className="opacity-90 mt-1">@{profile.username} · {videos.length} {videos.length === 1 ? "video" : "videos"}</p>
            )}
            {profile.bio && <p className="mt-2 opacity-95 max-w-xl">{profile.bio}</p>}
          </div>
        </div>
      </section>

      <h2 className="text-xl font-bold mb-4 px-1">Videos</h2>
      {videos.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-3">
            <Film className="h-6 w-6" />
          </div>
          <div className="font-semibold">No videos yet</div>
          <p className="text-sm text-muted-foreground mt-1">This creator hasn't published any videos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
          {videos.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      )}
    </AppLayout>
  );
}
