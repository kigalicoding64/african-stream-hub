import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload as UploadIcon, X, Check, Loader2, Film, Sparkles, Image as ImageIcon,
  AlertTriangle, RefreshCw, Music, Video as VideoIcon, ListPlus, Trash2, Play,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/upload")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: "/upload", mode: "login" } });
  },
  head: () => ({
    meta: [
      { title: "Upload — IBONA" },
      { name: "description", content: "Share your story with Africa and the world. Upload videos and music tracks in bulk." },
    ],
  }),
  component: UploadPage,
});

const CATEGORIES = ["Music", "Comedy", "Films", "Agasobanuye"] as const;
const LANGUAGES = ["Kinyarwanda", "Swahili", "English"] as const;
type Category = (typeof CATEGORIES)[number];
type Language = (typeof LANGUAGES)[number];
type MediaType = "video" | "audio";
type ItemStatus = "queued" | "uploading" | "done" | "error" | "cancelled";
type Visibility = "public" | "private";

const MAX_VIDEO_MB = 10240; // 10 GB
const MAX_AUDIO_MB = 50;
const MAX_THUMB_MB = 5;
const CONCURRENCY = 3;

function fmtLimit(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`;
}

interface QueueItem {
  id: string;
  file: File;
  mediaType: MediaType;
  title: string;
  language: Language;
  category: Category;
  thumbFile: File | null;
  thumbUrl: string | null;
  progress: number;
  status: ItemStatus;
  error: string | null;
  controller: AbortController | null;
  duration: number;
  visibility: Visibility;
  videoId?: string;
}

interface XhrUploadOpts {
  url: string;
  file: File;
  token: string;
  contentType: string;
  onProgress: (pct: number) => void;
  signal: AbortSignal;
}

function xhrUpload({ url, file, token, contentType, onProgress, signal }: XhrUploadOpts): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `Upload failed (${xhr.status})`;
        try { const j = JSON.parse(xhr.responseText); if (j?.message) msg = j.message; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 0;
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

function detectMediaType(f: File): MediaType | null {
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("audio/") || /\.mp3$/i.test(f.name)) return "audio";
  return null;
}

function probeDuration(f: File, mediaType: MediaType): Promise<number> {
  return new Promise((resolve) => {
    const el = mediaType === "audio" ? document.createElement("audio") : document.createElement("video");
    el.preload = "metadata";
    el.src = URL.createObjectURL(f);
    el.onloadedmetadata = () => {
      const d = Math.floor(el.duration || 0);
      URL.revokeObjectURL(el.src);
      resolve(isFinite(d) ? d : 0);
    };
    el.onerror = () => { URL.revokeObjectURL(el.src); resolve(0); };
  });
}

interface RejectedFile {
  id: string;
  name: string;
  sizeMb: number;
  reason: string;
}

function UploadPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [defaultLang, setDefaultLang] = useState<Language>("Kinyarwanda");
  const [defaultCategory, setDefaultCategory] = useState<Category>("Music");
  const [globalDescription, setGlobalDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const runningRef = useRef(false);
  queueRef.current = queue;

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const publishDraft = async (id: string) => {
    const it = queueRef.current.find((q) => q.id === id);
    if (!it || !it.videoId || it.visibility !== "private") return;
    const { error } = await supabase
      .from("videos")
      .update({ visibility: "public" })
      .eq("id", it.videoId);
    if (error) { toast.error("Couldn't publish", { description: error.message }); return; }
    updateItem(id, { visibility: "public" });
    toast.success("Now public", { description: "Visible on the public feed." });
  };

  /** Returns null if file is valid for upload, otherwise a human-readable reason. */
  const validateFile = (f: File): { mediaType: MediaType } | { error: string } => {
    const mt = detectMediaType(f);
    if (!mt) return { error: `Unsupported type — only video files and MP3 audio are allowed` };
    if (f.size === 0) return { error: `File is empty` };
    const mb = f.size / (1024 * 1024);
    const limit = mt === "video" ? MAX_VIDEO_MB : MAX_AUDIO_MB;
    if (mb > limit) {
      return { error: `Too large (${mb.toFixed(1)} MB) — ${mt === "video" ? `videos must be under ${fmtLimit(MAX_VIDEO_MB)}` : `audio must be under ${fmtLimit(MAX_AUDIO_MB)}`}` };
    }
    return { mediaType: mt };
  };

  const MAX_BATCH = 100;
  const addFiles = async (files: FileList | File[]) => {
    let arr = Array.from(files);
    let truncated = 0;
    if (arr.length > MAX_BATCH) {
      truncated = arr.length - MAX_BATCH;
      arr = arr.slice(0, MAX_BATCH);
    }
    const accepted: QueueItem[] = [];
    const newRejected: RejectedFile[] = [];
    for (const f of arr) {
      const v = validateFile(f);
      if ("error" in v) {
        newRejected.push({
          id: crypto.randomUUID(),
          name: f.name,
          sizeMb: f.size / (1024 * 1024),
          reason: v.error,
        });
        continue;
      }
      const mt = v.mediaType;
      const dur = await probeDuration(f, mt);
      accepted.push({
        id: crypto.randomUUID(),
        file: f,
        mediaType: mt,
        title: f.name.replace(/\.[^.]+$/, ""),
        language: defaultLang,
        category: mt === "audio" ? "Music" : defaultCategory,
        thumbFile: null,
        thumbUrl: null,
        progress: 0,
        status: "queued",
        error: null,
        controller: null,
        duration: dur,
        visibility: "public",
      });
    }
    if (accepted.length) setQueue((q) => [...q, ...accepted]);
    if (newRejected.length) setRejected((r) => [...r, ...newRejected]);
    if (accepted.length) toast.success(`${accepted.length} file(s) ready to review`);
    if (newRejected.length) toast.error(`${newRejected.length} file(s) need attention`, { description: "See the Rejected list below to fix or remove them." });
    if (truncated > 0) toast(`Only the first ${MAX_BATCH} files were picked`, { description: `${truncated} more skipped — add them after this batch finishes.` });
  };

  const removeRejected = (id: string) => setRejected((r) => r.filter((x) => x.id !== id));
  const clearRejected = () => setRejected([]);


  const removeItem = (id: string) => {
    const it = queue.find((q) => q.id === id);
    it?.controller?.abort();
    if (it?.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
    setQueue((q) => q.filter((x) => x.id !== id));
  };

  const setItemThumb = (id: string, file: File | null) => {
    const cur = queue.find((q) => q.id === id);
    if (cur?.thumbUrl) URL.revokeObjectURL(cur.thumbUrl);
    if (!file) { updateItem(id, { thumbFile: null, thumbUrl: null }); return; }
    if (file.size / (1024 * 1024) > MAX_THUMB_MB) { toast.error(`Cover too large (max ${MAX_THUMB_MB}MB)`); return; }
    updateItem(id, { thumbFile: file, thumbUrl: URL.createObjectURL(file) });
  };

  const cancelItem = (id: string) => {
    const it = queueRef.current.find((q) => q.id === id);
    it?.controller?.abort();
    updateItem(id, { status: "cancelled", error: "Cancelled" });
  };

  const cancelAll = () => {
    queueRef.current.forEach((it) => it.controller?.abort());
    setQueue((q) => q.map((it) => (it.status === "uploading" || it.status === "queued"
      ? { ...it, status: "cancelled", error: "Cancelled" }
      : it)));
  };

  const clearFinished = () => {
    setQueue((q) => q.filter((it) => it.status !== "done"));
  };

  const uploadOne = async (item: QueueItem) => {
    const ac = new AbortController();
    updateItem(item.id, { status: "uploading", controller: ac, progress: 0, error: null });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const user = session?.user;
      if (!session || !user) throw new Error("Not signed in");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

      // 1) Media file → videos bucket (works for both audio & video — bucket is public)
      const ext = (item.file.name.split(".").pop() || (item.mediaType === "audio" ? "mp3" : "mp4")).toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      await xhrUpload({
        url: `${supabaseUrl}/storage/v1/object/videos/${path}`,
        file: item.file,
        token: session.access_token,
        contentType: item.file.type || (item.mediaType === "audio" ? "audio/mpeg" : "video/mp4"),
        onProgress: (p) => updateItem(item.id, { progress: Math.round(p * 0.92) }),
        signal: ac.signal,
      });
      const { data: pub } = supabase.storage.from("videos").getPublicUrl(path);

      // 2) Optional thumbnail/cover
      let thumbUrl: string | null = null;
      if (item.thumbFile) {
        const tExt = (item.thumbFile.name.split(".").pop() || "jpg").toLowerCase();
        const tPath = `${user.id}/${crypto.randomUUID()}.${tExt}`;
        await xhrUpload({
          url: `${supabaseUrl}/storage/v1/object/thumbnails/${tPath}`,
          file: item.thumbFile,
          token: session.access_token,
          contentType: item.thumbFile.type || "image/jpeg",
          onProgress: () => { /* ignore — small */ },
          signal: ac.signal,
        });
        const { data: tp } = supabase.storage.from("thumbnails").getPublicUrl(tPath);
        thumbUrl = tp.publicUrl;
      }
      updateItem(item.id, { progress: 96 });

      // 3) DB row
      const { data: row, error: insErr } = await supabase
        .from("videos")
        .insert({
          owner_id: user.id,
          title: item.title.trim() || item.file.name,
          description: globalDescription.trim(),
          language: item.language,
          category: item.category,
          visibility: item.visibility === "private" ? "private" : "public",
          status: "ready",
          video_url: pub.publicUrl,
          thumbnail_url: thumbUrl,
          duration_seconds: item.duration || null,
          media_type: item.mediaType,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      updateItem(item.id, { status: "done", progress: 100, controller: null, videoId: row.id });
    } catch (err) {
      if (ac.signal.aborted) {
        updateItem(item.id, { status: "cancelled", error: "Cancelled", controller: null });
        return;
      }
      const msg = err instanceof Error ? err.message : "Upload failed";
      updateItem(item.id, { status: "error", error: msg, controller: null });
    }
  };

  // Concurrency runner
  const runQueue = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (true) {
        const queued = queueRef.current.filter((it) => it.status === "queued");
        const active = queueRef.current.filter((it) => it.status === "uploading").length;
        if (!queued.length && active === 0) break;
        const slots = Math.max(0, CONCURRENCY - active);
        const next = queued.slice(0, slots);
        if (next.length === 0) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        await Promise.all(next.map((it) => uploadOne(it)));
      }
    } finally {
      runningRef.current = false;
    }
  };

  const startAll = () => {
    const pending = queue.some((it) => it.status === "queued");
    if (!pending) { toast("Nothing to upload"); return; }
    runQueue();
  };

  const retryItem = (id: string) => {
    const it = queueRef.current.find((q) => q.id === id);
    if (!it) return;
    // Re-validate the file in case limits changed or the file went stale
    const v = validateFile(it.file);
    if ("error" in v) {
      updateItem(id, { status: "error", error: v.error, progress: 0, controller: null });
      toast.error("Can't retry this file", { description: v.error });
      return;
    }
    updateItem(id, { status: "queued", error: null, progress: 0, controller: null });
    runQueue();
  };

  // Cleanup object URLs on unmount
  useEffect(() => () => {
    queueRef.current.forEach((it) => { if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl); });
  }, []);

  const stats = useMemo(() => {
    const total = queue.length;
    const done = queue.filter((it) => it.status === "done").length;
    const failed = queue.filter((it) => it.status === "error").length;
    const uploading = queue.filter((it) => it.status === "uploading").length;
    const queuedCount = queue.filter((it) => it.status === "queued").length;
    const overall = total === 0 ? 0 : Math.round(queue.reduce((a, b) => a + (b.status === "done" ? 100 : b.progress), 0) / total);
    return { total, done, failed, uploading, queuedCount, overall };
  }, [queue]);

  const busy = stats.uploading > 0;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto py-8 animate-fade-in">
        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Creator Studio</div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-2">Upload to IBONA</h1>
        <p className="text-muted-foreground mb-8">Pick up to 100 files. Review &amp; remove items, choose <span className="font-semibold text-foreground">Public</span> or <span className="font-semibold text-foreground">Private (draft)</span> per item, then 3 will upload in parallel with auto-retry.</p>

        {/* Drop zone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
          className="block group cursor-pointer mb-6"
        >
          <div className={`relative rounded-3xl border-2 border-dashed p-8 sm:p-10 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 bg-surface"}`}
            style={{ backgroundImage: "var(--gradient-glow)" }}>
            <div className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center text-primary-foreground mb-3 shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-brand)" }}>
              <ListPlus className="h-7 w-7" />
            </div>
            <div className="text-lg font-bold">Drag &amp; drop files (or pick a folder)</div>
            <p className="text-sm text-muted-foreground mt-1">
              Videos up to {fmtLimit(MAX_VIDEO_MB)} · MP3 tracks up to {fmtLimit(MAX_AUDIO_MB)} · Bulk supported
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <span className="inline-flex rounded-full px-5 py-2 text-sm font-bold text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
                Choose files
              </span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); folderInputRef.current?.click(); }}
                className="inline-flex rounded-full px-5 py-2 text-sm font-bold border border-border bg-background hover:bg-surface-elevated"
              >
                Pick a folder (first 100)
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="video/*,audio/*,.mp3"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error – non-standard but widely supported
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={(e) => {
                if (!e.target.files) return;
                const all = Array.from(e.target.files).filter((f) => detectMediaType(f) !== null);
                addFiles(all);
                e.target.value = "";
              }}
            />
          </div>
        </label>

        {/* Rejected files (validation errors) */}
        {rejected.length > 0 && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 mb-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="text-sm font-bold text-destructive inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {rejected.length} file{rejected.length === 1 ? "" : "s"} rejected
              </div>
              <button
                onClick={clearRejected}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Dismiss all
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Fix and re-add these files, or dismiss them below. They are not part of the upload queue.
            </p>
            <ul className="space-y-1.5 max-h-56 overflow-auto pr-1">
              {rejected.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{r.name}</div>
                    <div className="text-muted-foreground truncate">{r.sizeMb.toFixed(1)} MB · {r.reason}</div>
                  </div>
                  <button
                    onClick={() => removeRejected(r.id)}
                    className="shrink-0 h-7 w-7 rounded-full hover:bg-muted text-muted-foreground flex items-center justify-center"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Defaults panel */}
        {queue.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-4 mb-4 grid sm:grid-cols-3 gap-4">
            <Field label="Default language">
              <Pills options={LANGUAGES} value={defaultLang} onChange={setDefaultLang} brand />
            </Field>
            <Field label="Default category (videos)">
              <Pills options={CATEGORIES} value={defaultCategory} onChange={setDefaultCategory} />
            </Field>
            <Field label="Description (applied to all)">
              <textarea
                value={globalDescription}
                onChange={(e) => setGlobalDescription(e.target.value)}
                rows={2}
                placeholder="Optional shared description"
                className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
              />
            </Field>
          </div>
        )}

        {/* Review & queue header */}
        {queue.length > 0 && (
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
            Step 2 — Review &amp; remove any items, then start
          </div>
        )}
        {/* Queue header */}
        {queue.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="text-sm font-semibold">
              {stats.total} file{stats.total === 1 ? "" : "s"} ·
              <span className="text-secondary"> {stats.done} done</span> ·
              <span className="text-primary"> {stats.uploading} uploading</span>
              {stats.failed > 0 && <span className="text-destructive"> · {stats.failed} failed</span>}
              {stats.queuedCount > 0 && <span className="text-muted-foreground"> · {stats.queuedCount} queued</span>}
            </div>
            <div className="flex gap-2">
              {stats.done > 0 && (
                <button onClick={clearFinished} className="rounded-full border border-border bg-surface hover:bg-surface-elevated px-4 py-2 text-xs font-semibold">
                  Clear finished
                </button>
              )}
              {busy ? (
                <button onClick={cancelAll} className="rounded-full border border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive/10 px-4 py-2 text-xs font-semibold">
                  <X className="h-3.5 w-3.5 inline mr-1" /> Cancel all
                </button>
              ) : (
                <button
                  onClick={startAll}
                  disabled={stats.queuedCount === 0}
                  className="rounded-full px-5 py-2 text-xs font-bold text-primary-foreground transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-[var(--shadow-glow)]"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Play className="h-3.5 w-3.5 inline mr-1" /> Start uploading ({stats.queuedCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Overall progress */}
        {queue.length > 0 && busy && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="text-muted-foreground">Overall</span>
              <span className="font-mono tabular-nums">{stats.overall}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-background overflow-hidden">
              <div className="h-full transition-[width] duration-200" style={{ width: `${stats.overall}%`, background: "var(--gradient-brand)" }} />
            </div>
          </div>
        )}

        {/* Queue list */}
        <div className="space-y-3">
          {queue.map((it) => (
            <QueueRow
              key={it.id}
              item={it}
              onCancel={() => cancelItem(it.id)}
              onRetry={() => retryItem(it.id)}
              onRemove={() => removeItem(it.id)}
              onTitle={(t) => updateItem(it.id, { title: t })}
              onLang={(l) => updateItem(it.id, { language: l })}
              onCat={(c) => updateItem(it.id, { category: c })}
              onThumb={(f) => setItemThumb(it.id, f)}
              onVisibility={(v) => updateItem(it.id, { visibility: v })}
              onPublish={() => publishDraft(it.id)}
            />
          ))}
        </div>

        {queue.length === 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Feat icon={Film} title="Premium quality" desc="Adaptive streaming for low-bandwidth viewers." />
            <Feat icon={Sparkles} title="Audio &amp; video" desc="Bulk-upload 100+ MP3 tracks with cover art." />
          </div>
        )}

        <div className="mt-8 text-sm text-muted-foreground text-center">
          Manage your uploads in the <Link to="/studio" className="text-primary font-semibold hover:underline">Creator Studio</Link>.
        </div>
      </div>
    </AppLayout>
  );
}

function QueueRow({
  item, onCancel, onRetry, onRemove, onTitle, onLang, onCat, onThumb, onVisibility, onPublish,
}: {
  item: QueueItem;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onTitle: (t: string) => void;
  onLang: (l: Language) => void;
  onCat: (c: Category) => void;
  onThumb: (f: File | null) => void;
  onVisibility: (v: Visibility) => void;
  onPublish: () => void | Promise<void>;
}) {
  const thumbInput = useRef<HTMLInputElement>(null);
  const sizeMb = (item.file.size / (1024 * 1024)).toFixed(1);
  const Icon = item.mediaType === "audio" ? Music : VideoIcon;
  const editable = item.status === "queued" || item.status === "error" || item.status === "cancelled";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        {/* Thumb / icon */}
        <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-background overflow-hidden flex items-center justify-center shrink-0">
          {item.thumbUrl ? (
            <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {editable ? (
                <input
                  value={item.title}
                  onChange={(e) => onTitle(e.target.value)}
                  className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none font-semibold text-sm"
                />
              ) : (
                <div className="font-semibold text-sm truncate">{item.title}</div>
              )}
              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                <Icon className="h-3 w-3" /> {item.mediaType.toUpperCase()} · {sizeMb} MB
                {item.duration > 0 && <span>· {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}</span>}
                <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.visibility === "private" ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/30" : "bg-secondary/20 text-secondary ring-1 ring-secondary/30"}`}>
                  {item.status === "done"
                    ? (item.visibility === "private" ? "Saved as draft" : "Published · Public")
                    : (item.visibility === "private" ? "Private (draft)" : "Public")}
                </span>
              </div>
            </div>
            <StatusPill status={item.status} progress={item.progress} />
          </div>

          {/* Progress bar */}
          {(item.status === "uploading" || item.status === "done") && (
            <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
              <div className="h-full transition-[width] duration-200" style={{ width: `${item.status === "done" ? 100 : item.progress}%`, background: "var(--gradient-brand)" }} />
            </div>
          )}

          {/* Per-item options when editable */}
          {editable && (
            <div className="flex flex-wrap gap-2 items-center pt-1">
              <MiniSelect
                value={item.language}
                options={[...LANGUAGES]}
                onChange={(v) => onLang(v as Language)}
              />
              <MiniSelect
                value={item.category}
                options={[...CATEGORIES]}
                onChange={(v) => onCat(v as Category)}
              />
              <MiniSelect
                value={item.visibility}
                options={["public", "private"]}
                onChange={(v) => onVisibility(v as Visibility)}
              />
              <button
                type="button"
                onClick={() => thumbInput.current?.click()}
                className="text-xs inline-flex items-center gap-1 rounded-full border border-border bg-background hover:bg-surface-elevated px-2.5 py-1 font-semibold"
              >
                <ImageIcon className="h-3 w-3" /> {item.thumbFile ? "Change cover" : item.mediaType === "audio" ? "Add cover art" : "Add thumbnail"}
              </button>
              {item.thumbFile && (
                <button onClick={() => onThumb(null)} className="text-xs text-muted-foreground hover:text-destructive">
                  Remove cover
                </button>
              )}
              <input
                ref={thumbInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onThumb(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {item.error && (item.status === "error" || item.status === "cancelled") && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="flex-1">{item.error}</span>
            </div>
          )}

          {item.status === "done" && item.visibility === "private" && item.videoId && (
            <div className="pt-1">
              <button
                onClick={onPublish}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-[var(--shadow-glow)] hover:scale-105 transition"
                style={{ background: "var(--gradient-brand)" }}
              >
                <Check className="h-3.5 w-3.5" /> Make Public
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {item.status === "uploading" ? (
            <button onClick={onCancel} title="Cancel" className="h-8 w-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          ) : item.status === "error" || item.status === "cancelled" ? (
            <button onClick={onRetry} title="Retry" className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary flex items-center justify-center">
              <RefreshCw className="h-4 w-4" />
            </button>
          ) : null}
          {item.status !== "uploading" && (
            <button onClick={onRemove} title="Remove" className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground flex items-center justify-center">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, progress }: { status: ItemStatus; progress: number }) {
  if (status === "done") return <span className="text-xs font-bold text-secondary inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Done</span>;
  if (status === "uploading") return <span className="text-xs font-bold text-primary inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress}%</span>;
  if (status === "error") return <span className="text-xs font-bold text-destructive inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Failed</span>;
  if (status === "cancelled") return <span className="text-xs font-bold text-muted-foreground">Cancelled</span>;
  return <span className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1"><UploadIcon className="h-3.5 w-3.5" /> Queued</span>;
}

function MiniSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs rounded-full border border-border bg-background hover:bg-surface-elevated px-2.5 py-1 font-semibold focus:outline-none focus:border-primary"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Pills<T extends string>({ options, value, onChange, brand }: { options: readonly T[]; value: T; onChange: (v: T) => void; brand?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o === value;
        return (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${active ? (brand ? "text-primary-foreground border-transparent" : "border-primary bg-primary/15 text-primary") : "border-border bg-background hover:bg-surface-elevated"}`}
            style={active && brand ? { background: "var(--gradient-brand)" } : undefined}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Feat({ icon: Icon, title, desc }: { icon: typeof Film; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-2"><Icon className="h-4 w-4" /></div>
      <div className="font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  );
}
