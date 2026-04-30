import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload as UploadIcon, X, Check, Loader2, Film, Sparkles, Image as ImageIcon, AlertTriangle, RefreshCw } from "lucide-react";
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
      { name: "description", content: "Share your story with Africa and the world." },
    ],
  }),
  component: UploadPage,
});

const CATEGORIES = ["Music", "Comedy", "Films", "Agasobanuye"] as const;
const LANGUAGES = ["Kinyarwanda", "Swahili", "English"] as const;
type Category = (typeof CATEGORIES)[number];
type Language = (typeof LANGUAGES)[number];
type Status = "idle" | "uploading" | "done" | "error" | "cancelled";

const MAX_VIDEO_MB = 500;
const MAX_THUMB_MB = 5;

interface XhrUploadOpts {
  url: string;
  file: File;
  token: string;
  contentType: string;
  onProgress: (pct: number) => void;
  signal: AbortSignal;
}

// Direct upload to Supabase Storage REST endpoint via XHR — gives real progress + cancel.
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
    xhr.timeout = 0; // no client timeout; we rely on user cancel
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [thumbProgress, setThumbProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<Language>("Kinyarwanda");
  const [category, setCategory] = useState<Category>("Music");
  const [duration, setDuration] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!thumbFile) { setThumbUrl(null); return; }
    const url = URL.createObjectURL(thumbFile);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbFile]);

  const handleFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) { toast.error("Please choose a video file"); return; }
    const mb = f.size / (1024 * 1024);
    if (mb > MAX_VIDEO_MB) { toast.error(`Video too large (max ${MAX_VIDEO_MB} MB)`); return; }
    setFile(f);
    setVideoProgress(0);
    setStatus("idle");
    setErrorMsg(null);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleThumb = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Thumbnail must be an image"); return; }
    const mb = f.size / (1024 * 1024);
    if (mb > MAX_THUMB_MB) { toast.error(`Thumbnail too large (max ${MAX_THUMB_MB} MB)`); return; }
    setThumbFile(f);
    setThumbProgress(0);
  };

  const onLoadedMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(Math.floor(e.currentTarget.duration || 0));
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    setStatus("cancelled");
    setErrorMsg("Upload cancelled");
    toast("Upload cancelled");
  };

  const publish = async () => {
    if (!file || !title.trim() || status === "uploading") return;
    setStatus("uploading");
    setErrorMsg(null);
    setVideoProgress(0);
    setThumbProgress(0);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const user = session?.user;
      if (!session || !user) throw new Error("You're not signed in. Please sign in and try again.");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

      // 1) Video upload (real progress)
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const videoPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      await xhrUpload({
        url: `${supabaseUrl}/storage/v1/object/videos/${videoPath}`,
        file,
        token: session.access_token,
        contentType: file.type || "video/mp4",
        onProgress: setVideoProgress,
        signal: ac.signal,
      });
      setVideoProgress(100);

      const { data: videoPub } = supabase.storage.from("videos").getPublicUrl(videoPath);

      // 2) Thumbnail upload (optional)
      let thumbnailPublicUrl: string | null = null;
      if (thumbFile) {
        const tExt = (thumbFile.name.split(".").pop() || "jpg").toLowerCase();
        const thumbPath = `${user.id}/${crypto.randomUUID()}.${tExt}`;
        await xhrUpload({
          url: `${supabaseUrl}/storage/v1/object/thumbnails/${thumbPath}`,
          file: thumbFile,
          token: session.access_token,
          contentType: thumbFile.type || "image/jpeg",
          onProgress: setThumbProgress,
          signal: ac.signal,
        });
        setThumbProgress(100);
        const { data: tPub } = supabase.storage.from("thumbnails").getPublicUrl(thumbPath);
        thumbnailPublicUrl = tPub.publicUrl;
      }

      // 3) Insert DB row
      const { data: row, error: insErr } = await supabase
        .from("videos")
        .insert({
          owner_id: user.id,
          title: title.trim(),
          description: description.trim(),
          language,
          category,
          visibility: "public",
          status: "ready",
          video_url: videoPub.publicUrl,
          thumbnail_url: thumbnailPublicUrl,
          duration_seconds: duration || null,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      setStatus("done");
      toast.success("Published! Your video is now live on IBONA.");
      setTimeout(() => navigate({ to: "/watch/$videoId", params: { videoId: row.id } }), 800);
    } catch (err) {
      if (ac.signal.aborted) return; // already handled by cancelUpload
      const msg = err instanceof Error ? err.message : "Upload failed";
      setStatus("error");
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      abortRef.current = null;
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setFile(null); setThumbFile(null);
    setVideoProgress(0); setThumbProgress(0);
    setStatus("idle"); setErrorMsg(null);
    setTitle(""); setDescription("");
  };

  const retry = () => {
    setStatus("idle"); setErrorMsg(null);
    setVideoProgress(0); setThumbProgress(0);
    publish();
  };

  const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(1) : "0";
  const busy = status === "uploading";
  const overall = thumbFile
    ? Math.round((videoProgress + thumbProgress) / 2)
    : videoProgress;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-8 animate-fade-in">
        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Become a creator</div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-2">Upload your video</h1>
        <p className="text-muted-foreground mb-8">Share your story with Africa and the world.</p>

        {!file && (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            className="block group cursor-pointer"
          >
            <div className={`relative rounded-3xl border-2 border-dashed p-12 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 bg-surface"}`}
              style={{ backgroundImage: "var(--gradient-glow)" }}>
              <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center text-primary-foreground mb-4 shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-brand)" }}>
                <UploadIcon className="h-8 w-8" />
              </div>
              <div className="text-xl font-bold">Drag &amp; drop a video</div>
              <p className="text-sm text-muted-foreground mt-1">MP4 or MOV · up to {MAX_VIDEO_MB} MB</p>
              <span className="mt-5 inline-flex rounded-full px-5 py-2 text-sm font-bold text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>Choose file</span>
              <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
          </label>
        )}

        {file && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-surface overflow-hidden">
              <div className="relative aspect-video bg-black">
                {previewUrl && (
                  <video src={previewUrl} controls playsInline onLoadedMetadata={onLoadedMeta} className="h-full w-full object-contain" />
                )}
                <button onClick={reset} disabled={busy} className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/80 hover:bg-background flex items-center justify-center backdrop-blur disabled:opacity-50" aria-label="Remove file">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{sizeMb} MB · {duration ? `${duration}s` : "—"}</div>
                  </div>
                  <div className="text-sm font-mono font-bold tabular-nums">
                    {status === "done" ? <span className="inline-flex items-center gap-1 text-secondary"><Check className="h-4 w-4" /> Published</span>
                      : busy ? <span className="inline-flex items-center gap-1 text-primary"><Loader2 className="h-4 w-4 animate-spin" /> {overall}%</span>
                      : status === "error" ? <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" /> Failed</span>
                      : status === "cancelled" ? <span className="text-muted-foreground">Cancelled</span>
                      : <span className="text-muted-foreground">Ready</span>}
                  </div>
                </div>

                {/* Video progress */}
                <ProgressRow label="Video" value={videoProgress} />

                {/* Thumbnail row */}
                {thumbFile ? (
                  <ProgressRow label="Thumbnail" value={thumbProgress} />
                ) : (
                  <button
                    type="button"
                    onClick={() => thumbInputRef.current?.click()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> Add a custom thumbnail (optional)
                  </button>
                )}
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleThumb(e.target.files?.[0])}
                />

                {thumbUrl && (
                  <div className="flex items-center gap-3">
                    <img src={thumbUrl} alt="Thumbnail preview" className="h-14 w-24 rounded-md object-cover ring-1 ring-border" />
                    <button
                      type="button"
                      onClick={() => setThumbFile(null)}
                      disabled={busy}
                      className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      Remove thumbnail
                    </button>
                  </div>
                )}

                {errorMsg && (status === "error" || status === "cancelled") && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="flex-1">{errorMsg}</span>
                    {status === "error" && (
                      <button onClick={retry} className="inline-flex items-center gap-1 font-bold hover:underline">
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-surface p-5 space-y-4">
              <Field label="Title">
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} placeholder="Give your video a powerful title" className="mt-1 w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary disabled:opacity-50" />
              </Field>
              <Field label="Description">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} rows={3} placeholder="Tell viewers about your video" className="mt-1 w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none disabled:opacity-50" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Language">
                  <Pills options={LANGUAGES} value={language} onChange={(v) => setLanguage(v)} disabled={busy} brand />
                </Field>
                <Field label="Category">
                  <Pills options={CATEGORIES} value={category} onChange={(v) => setCategory(v)} disabled={busy} />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {busy ? (
                <button onClick={cancelUpload} className="inline-flex items-center gap-2 rounded-full border border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive/10 px-5 py-2.5 text-sm font-semibold transition">
                  <X className="h-4 w-4" /> Cancel upload
                </button>
              ) : (
                <button onClick={reset} disabled={status === "done"} className="rounded-full border border-border bg-surface hover:bg-surface-elevated px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50">
                  {status === "error" || status === "cancelled" ? "Start over" : "Cancel"}
                </button>
              )}
              <button onClick={publish} disabled={busy || !title.trim() || status === "done"} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-brand)" }}>
                {status === "done" ? <><Check className="h-4 w-4" /> Published</>
                  : busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                  : <><UploadIcon className="h-4 w-4" /> Publish to IBONA</>}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Feat icon={Film} title="Premium quality" desc="Adaptive streaming for low-bandwidth viewers." />
          <Feat icon={Sparkles} title="Agasobanuye ready" desc="Add Kinyarwanda subtitles in one click." />
        </div>

        <div className="mt-6 text-sm text-muted-foreground text-center">
          Manage your uploads in the <Link to="/studio" className="text-primary font-semibold hover:underline">Creator Studio</Link>.
        </div>
      </div>
    </AppLayout>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{value}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-background overflow-hidden">
        <div className="h-full transition-[width] duration-200" style={{ width: `${value}%`, background: "var(--gradient-brand)" }} />
      </div>
    </div>
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
function Pills<T extends string>({ options, value, onChange, disabled, brand }: { options: readonly T[]; value: T; onChange: (v: T) => void; disabled?: boolean; brand?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o === value;
        return (
          <button key={o} type="button" disabled={disabled} onClick={() => onChange(o)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition disabled:opacity-50 ${active ? (brand ? "text-primary-foreground border-transparent" : "border-primary bg-primary/15 text-primary") : "border-border bg-background hover:bg-surface-elevated"}`}
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
