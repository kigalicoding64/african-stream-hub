import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload as UploadIcon, Film, Sparkles, X, Check, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import type { Category, Language } from "@/data/videos";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload — IBONA" },
      { name: "description", content: "Share your story with Africa and the world." },
      { property: "og:title", content: "Upload — IBONA" },
      { property: "og:description", content: "Become a creator on IBONA." },
    ],
  }),
  component: UploadPage,
});

const CATEGORIES: Category[] = ["Music", "Comedy", "Films", "Agasobanuye"];
const LANGUAGES: Language[] = ["Kinyarwanda", "Swahili", "English"];

type Status = "idle" | "uploading" | "done";

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<Language>("Kinyarwanda");
  const [category, setCategory] = useState<Category>("Music");
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  // Preview URL lifecycle
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Cleanup interval
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const handleFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) return;
    setFile(f);
    setProgress(0);
    setStatus("idle");
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const startUpload = () => {
    if (!file || status === "uploading") return;
    setStatus("uploading");
    setProgress(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + Math.random() * 8 + 2);
        if (next >= 100) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          setStatus("done");
        }
        return next;
      });
    }, 220);
  };

  const reset = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setFile(null);
    setProgress(0);
    setStatus("idle");
    setTitle("");
    setDescription("");
  };

  const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(1) : "0";

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-8 animate-fade-in">
        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Become a creator</div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-2">Upload your video</h1>
        <p className="text-muted-foreground mb-8">Share your story with Africa and the world.</p>

        {!file && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className="block group cursor-pointer"
          >
            <div
              className={`relative rounded-3xl border-2 border-dashed p-12 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 bg-surface"}`}
              style={{ backgroundImage: "var(--gradient-glow)" }}
            >
              <div
                className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center text-primary-foreground mb-4 shadow-[var(--shadow-glow)]"
                style={{ background: "var(--gradient-brand)" }}
              >
                <UploadIcon className="h-8 w-8" />
              </div>
              <div className="text-xl font-bold">Drag &amp; drop a video</div>
              <p className="text-sm text-muted-foreground mt-1">MP4 or MOV · up to 4GB · 1080p recommended</p>
              <span
                className="mt-5 inline-flex rounded-full px-5 py-2 text-sm font-bold text-primary-foreground"
                style={{ background: "var(--gradient-brand)" }}
              >
                Choose file
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          </label>
        )}

        {file && (
          <div className="space-y-6">
            {/* Preview + progress */}
            <div className="rounded-3xl border border-border bg-surface overflow-hidden">
              <div className="relative aspect-video bg-black">
                {previewUrl && (
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    className="h-full w-full object-contain"
                  />
                )}
                <button
                  onClick={reset}
                  className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/80 hover:bg-background flex items-center justify-center backdrop-blur"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{sizeMb} MB · {file.type || "video"}</div>
                  </div>
                  <div className="text-sm font-mono font-bold tabular-nums">
                    {status === "done" ? (
                      <span className="inline-flex items-center gap-1 text-secondary">
                        <Check className="h-4 w-4" /> Ready
                      </span>
                    ) : status === "uploading" ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Loader2 className="h-4 w-4 animate-spin" /> {Math.round(progress)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Idle</span>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full transition-[width] duration-200"
                    style={{
                      width: `${progress}%`,
                      background: "var(--gradient-brand)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="rounded-3xl border border-border bg-surface p-5 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your video a powerful title"
                  className="mt-1 w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Tell viewers about your video"
                  className="mt-1 w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Language</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLanguage(l)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${language === l ? "text-primary-foreground border-transparent" : "border-border bg-background hover:bg-surface-elevated"}`}
                        style={language === l ? { background: "var(--gradient-brand)" } : undefined}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${category === c ? "border-primary bg-primary/15 text-primary" : "border-border bg-background hover:bg-surface-elevated"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                onClick={reset}
                className="rounded-full border border-border bg-surface hover:bg-surface-elevated px-5 py-2.5 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={startUpload}
                disabled={status !== "idle" || !title.trim()}
                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-[var(--shadow-glow)]"
                style={{ background: "var(--gradient-brand)" }}
              >
                {status === "done" ? (
                  <>
                    <Check className="h-4 w-4" /> Published
                  </>
                ) : status === "uploading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-4 w-4" /> Publish video
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Feat icon={Film} title="Premium quality" desc="Adaptive streaming for low-bandwidth viewers." />
          <Feat icon={Sparkles} title="Agasobanuye ready" desc="Add Kinyarwanda subtitles in one click." />
        </div>
      </div>
    </AppLayout>
  );
}

function Feat({ icon: Icon, title, desc }: { icon: typeof Film; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-2">
        <Icon className="h-4 w-4" />
      </div>
      <div className="font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  );
}
