import { createFileRoute } from "@tanstack/react-router";
import { Upload as UploadIcon, Film, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [
    { title: "Upload — IBONA" },
    { name: "description", content: "Share your story with Africa and the world." },
    { property: "og:title", content: "Upload — IBONA" },
    { property: "og:description", content: "Become a creator on IBONA." },
  ]}),
  component: () => (
    <AppLayout>
      <div className="max-w-2xl mx-auto py-8 animate-fade-in">
        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Become a creator</div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-2">Upload your video</h1>
        <p className="text-muted-foreground mb-8">Share your story with Africa and the world.</p>

        <label className="block group cursor-pointer">
          <div className="relative rounded-3xl border-2 border-dashed border-border hover:border-primary/60 bg-surface p-12 text-center transition" style={{ backgroundImage: "var(--gradient-glow)" }}>
            <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center text-primary-foreground mb-4 shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-brand)" }}>
              <UploadIcon className="h-8 w-8" />
            </div>
            <div className="text-xl font-bold">Drag &amp; drop a video</div>
            <p className="text-sm text-muted-foreground mt-1">MP4 or MOV · up to 4GB · 1080p recommended</p>
            <span className="mt-5 inline-flex rounded-full px-5 py-2 text-sm font-bold text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>Choose file</span>
            <input type="file" accept="video/*" className="hidden" />
          </div>
        </label>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Feat icon={Film} title="Premium quality" desc="Adaptive streaming for low-bandwidth viewers." />
          <Feat icon={Sparkles} title="Agasobanuye ready" desc="Add Kinyarwanda subtitles in one click." />
        </div>
      </div>
    </AppLayout>
  ),
});

function Feat({ icon: Icon, title, desc }: { icon: typeof Film; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-2"><Icon className="h-4 w-4" /></div>
      <div className="font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  );
}
