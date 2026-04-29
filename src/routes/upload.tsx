import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload as UploadIcon, X, Check, Loader2, Film, Sparkles } from "lucide-react";
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
type Status = "idle" | "uploading" | "done" | "error";

function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<Language>("Kinyarwanda");
  const [category, setCategory] = useState<Category>("Music");
  const [duration, setDuration] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFile = (f: File | null | undefined) => {
    if (!f || !f.type.startsWith("video/")) return;
    setFile(f);
    setProgress(0);
    setStatus("idle");
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const onLoadedMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(Math.floor(e.currentTarget.duration || 0));
  };

  const publish = async () => {
    if (!file || !title.trim() || status === "uploading") return;
    setStatus("uploading");
    setProgress(2);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      // Simulated progress while uploading (Supabase JS doesn't expose progress)
      const fakeProg = setInterval(() => {
        setProgress((p) => Math.min(90, p + Math.random() * 8 + 2));
      }, 250);

      const { error: upErr } = await supabase.storage
        .from("videos")
        .upload(path, file, { contentType: file.type, upsert: false });
      clearInterval(fakeProg);
      if (upErr) throw upErr;
      setProgress(95);

      const { data: pub } = supabase.storage.from("videos").getPublicUrl(path);

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
          video_url: pub.publicUrl,
          duration_seconds: duration || null,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      setProgress(100);
      setStatus("done");
      toast.success("Video published!");
      setTimeout(() => navigate({ to: "/watch/$videoId", params: { videoId: row.id } }), 800);
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const reset = () => {
    setFile(null); setProgress(0); setStatus("idle"); setTitle(""); setDescription("");
  };

  const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(1) : "0";
  const busy = status === "uploading";

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
              <p className="text-sm text-muted-foreground mt-1">MP4 or MOV · 1080p recommended</p>
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
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{sizeMb} MB · {duration ? `${duration}s` : "—"}</div>
                  </div>
                  <div className="text-sm font-mono font-bold tabular-nums">
                    {status === "done" ? <span className="inline-flex items-center gap-1 text-secondary"><Check className="h-4 w-4" /> Published</span>
                      : busy ? <span className="inline-flex items-center gap-1 text-primary"><Loader2 className="h-4 w-4 animate-spin" /> {Math.round(progress)}%</span>
                      : status === "error" ? <span className="text-destructive">Failed</span>
                      : <span className="text-muted-foreground">Ready</span>}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                  <div className="h-full transition-[width] duration-200" style={{ width: `${progress}%`, background: "var(--gradient-brand)" }} />
                </div>
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
              <button onClick={reset} disabled={busy} className="rounded-full border border-border bg-surface hover:bg-surface-elevated px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50">Cancel</button>
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
