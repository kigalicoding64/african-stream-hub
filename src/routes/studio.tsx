import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Upload as UploadIcon, Eye, Heart, Trash2, Edit3, Loader2, Film, X, Check, BarChart3, Users, MessageCircle, Sparkles, RefreshCw, Copy, Languages, FileText } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { transcribeVideo, generateVideoMetadata, getAiStatus } from "@/lib/ai.functions";

export const Route = createFileRoute("/studio")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { redirect: "/studio", mode: "login" } });
  },
  head: () => ({
    meta: [
      { title: "Creator Studio — IBONA" },
      { name: "description", content: "Manage your uploaded videos, edit details, and track performance." },
    ],
  }),
  component: StudioPage,
});

interface Row {
  id: string;
  title: string;
  description: string | null;
  language: "Kinyarwanda" | "Swahili" | "English";
  category: "Music" | "Comedy" | "Films" | "Agasobanuye";
  visibility: "public" | "unlisted" | "private";
  status: string;
  thumbnail_url: string | null;
  views: number;
  likes: number;
  duration_seconds: number | null;
  created_at: string;
}

function StudioPage() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const navigate = useNavigate();

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("videos")
      .select("id, title, description, language, category, visibility, status, thumbnail_url, views, likes, duration_seconds, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) || []);
    const ids = (data || []).map((r) => r.id);
    if (ids.length) {
      const { count } = await supabase.from("comments").select("id", { count: "exact", head: true }).in("video_id", ids);
      setCommentCount(count || 0);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const onUpdate = () => refresh();
    if (typeof window !== "undefined") window.addEventListener("ibona:video-updated", onUpdate);
    const ch = supabase
      .channel(`studio-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "videos", filter: `owner_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("ibona:video-updated", onUpdate);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line
  }, [user?.id]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this video? This cannot be undone.")) return;
    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Video deleted");
    setRows((r) => r.filter((x) => x.id !== id));
  };

  const totalViews = rows.reduce((a, r) => a + (r.views || 0), 0);
  const totalLikes = rows.reduce((a, r) => a + (r.likes || 0), 0);

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Creator Studio</div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{profile?.display_name || "Welcome"}</h1>
            <p className="text-muted-foreground mt-1">Manage your videos, edit metadata, and track performance.</p>
          </div>
          <Link to="/upload" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-brand)" }}>
            <UploadIcon className="h-4 w-4" /> Upload new
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Stat icon={Film} label="Videos" value={rows.length} />
          <Stat icon={Eye} label="Total views" value={totalViews} />
          <Stat icon={Heart} label="Total likes" value={totalLikes} />
          <Stat icon={MessageCircle} label="Comments" value={commentCount} />
        </div>

        <div className="rounded-3xl border border-border bg-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Your videos</div>
            <div className="text-xs text-muted-foreground">{rows.length} total</div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-3"><Film className="h-6 w-6" /></div>
              <div className="font-bold mb-1">No videos yet</div>
              <p className="text-sm text-muted-foreground mb-4">Upload your first video to get started.</p>
              <Link to="/upload" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
                <UploadIcon className="h-4 w-4" /> Upload video
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="p-4 flex flex-wrap sm:flex-nowrap items-center gap-4 hover:bg-surface-elevated/50 transition">
                  <div
                    className="h-16 w-28 shrink-0 rounded-lg bg-cover bg-center bg-surface-elevated"
                    style={r.thumbnail_url ? { backgroundImage: `url(${r.thumbnail_url})` } : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <button onClick={() => navigate({ to: "/watch/$videoId", params: { videoId: r.id } })} className="font-semibold text-left hover:text-primary transition truncate block w-full">
                      {r.title}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                      <span className="rounded bg-primary/15 text-primary px-2 py-0.5">{r.category}</span>
                      <span className="rounded bg-secondary/15 text-secondary px-2 py-0.5">{r.language}</span>
                      <span className="rounded bg-surface-elevated text-muted-foreground px-2 py-0.5">{r.visibility}</span>
                    </div>
                  </div>
                  <div className="flex gap-6 text-xs">
                    <Metric label="Views" value={r.views} />
                    <Metric label="Likes" value={r.likes} />
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => setEditing(r)} className="h-9 w-9 rounded-full bg-surface-elevated hover:bg-primary/20 flex items-center justify-center transition" aria-label="Edit"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => onDelete(r.id)} className="h-9 w-9 rounded-full bg-surface-elevated hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card icon={Users} title="Audience" desc="Follower analytics coming soon." />
          <Card icon={BarChart3} title="Earnings" desc="Monetization opens at 1K subscribers." />
        </div>
      </div>

      {editing && <EditModal row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </AppLayout>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><Icon className="h-4 w-4" /></div>
      </div>
      <div className="text-2xl font-black tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return <div className="text-center"><div className="font-bold tabular-nums">{value.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div></div>;
}
function Card({ icon: Icon, title, desc }: { icon: typeof Eye; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="h-9 w-9 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center mb-2"><Icon className="h-4 w-4" /></div>
      <div className="font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  );
}

const LANGUAGES = ["Kinyarwanda", "Swahili", "English"] as const;
const CATEGORIES = ["Music", "Comedy", "Films", "Agasobanuye"] as const;
const VISIBILITIES = ["public", "unlisted", "private"] as const;

function EditModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(row.title);
  const [description, setDescription] = useState(row.description || "");
  const [language, setLanguage] = useState<typeof LANGUAGES[number]>(row.language);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>(row.category);
  const [visibility, setVisibility] = useState<typeof VISIBILITIES[number]>(row.visibility);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("videos").update({ title: title.trim(), description, language, category, visibility }).eq("id", row.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-border bg-popover p-6 shadow-[var(--shadow-elegant)] animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Edit video</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-xl bg-surface border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Description" className="w-full rounded-xl bg-surface border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none" />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <select value={language} onChange={(e) => setLanguage(e.target.value as typeof LANGUAGES[number])} className="rounded-xl bg-surface border border-border px-3 py-2.5">{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select>
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])} className="rounded-xl bg-surface border border-border px-3 py-2.5">{CATEGORIES.map((l) => <option key={l}>{l}</option>)}</select>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof VISIBILITIES[number])} className="rounded-xl bg-surface border border-border px-3 py-2.5">{VISIBILITIES.map((l) => <option key={l}>{l}</option>)}</select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-surface hover:bg-surface-elevated px-5 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={save} disabled={saving || !title.trim()} className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-brand)" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
