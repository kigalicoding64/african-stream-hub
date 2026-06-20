# IBONA AI Engine v1 — Build Plan

You picked all four pillars. Honest reality: this is **3 substantial phases**, not one turn. I'll ship them in order so each phase is usable on its own. Phase 1 lands this turn; Phases 2 and 3 are follow-ups you approve separately.

---

## Phase 1 (this turn) — Foundation + Captions + AI Metadata

### Database
New migration adds:
- `video_captions` table: `video_id`, `language` (rw/en/fr/sw), `vtt_url`, `source` (ai/manual), `is_default`.
- `video_ai_metadata` table: `video_id`, `summary_short`, `summary_long`, `key_takeaways jsonb`, `seo_title`, `seo_description`, `tags text[]`, `hashtags text[]`, `category_suggested`, `topic`, `industry`, `audience`, `social_posts jsonb` (x/facebook/linkedin).
- `video_embeddings` table with `pgvector` (`vector(1536)` via `openai/text-embedding-3-small` to keep index small) + HNSW index. Created now, populated in Phase 3.
- `ai_jobs` table: `video_id`, `kind` (captions/metadata/thumbnails/embedding), `status`, `error`, timestamps. Idempotent job tracking.
- New storage bucket `captions` (public, VTT files).
- RLS + GRANTs per project rules.

### Server functions (`src/lib/ai.functions.ts` + helpers)
- `transcribeVideo({ videoId })` — downloads audio via ffmpeg-less approach: passes the storage-signed video URL directly to `openai/gpt-4o-mini-transcribe` (the model accepts video containers; falls back to audio-only if rejected). Detects language. Generates VTT for **source language + auto-translates to en/fr/sw/rw** using `google/gemini-3-flash-preview` (preserves timing). Uploads all VTTs to `captions` bucket. Inserts rows into `video_captions`.
- `generateVideoMetadata({ videoId })` — reads transcript (or title+description if transcript empty), calls Gemini with structured `Output.object` schema to produce SEO title, description, tags, hashtags, summaries, key takeaways, category, topic, audience, and 3 social posts. Writes to `video_ai_metadata`.
- `runPostUploadPipeline({ videoId })` — orchestrates: captions → metadata → (Phase 2: thumbnails) → (Phase 3: embedding). Records each step in `ai_jobs`.

All use `requireSupabaseAuth` + ownership check.

### Upload flow integration
`src/routes/upload.tsx`: after the existing upload completes and the `videos` row reaches `status=ready`, fire `runPostUploadPipeline` in the background and show a "AI is enhancing your video…" status with per-step progress polled from `ai_jobs`.

### Watch page captions UI
`src/routes/watch.$videoId.tsx`: load `video_captions` for the video, add `<track kind="subtitles">` elements per language, language selector dropdown + on/off toggle persisted via existing `playback-prefs`.

### Studio AI Assistant
`src/routes/studio.tsx`: per-video card adds:
- "Regenerate metadata" / "Regenerate captions" buttons.
- Editable fields for AI-generated title/description/tags before publishing (writes back to `videos`).
- Copyable social posts (X / Facebook / LinkedIn).
- Summary + key takeaways preview.

### Deliberately deferred to Phase 2/3
- Thumbnail frame extraction (requires ffmpeg — Workers runtime can't run it; needs an external worker or Cloudflare Stream API. Will propose options at start of Phase 2).
- Vector embeddings backfill + semantic search UI + For You feed (Phase 3, after metadata exists for ranking signal).

---

## Phase 2 (next approval) — AI Thumbnails

Two viable approaches; I'll ask you to pick:
- **(A)** Use Cloudflare Stream API for frame extraction (you're already on Workers, native fit, paid feature).
- **(B)** Spin up a tiny external worker (Fly.io / Render free tier) that runs ffmpeg + uploads frames back to Supabase Storage.
Then: feed best frames to `google/gemini-3.1-flash-image-preview` for enhancement + title overlay, store 3 options in `thumbnails` bucket, picker UI in Studio.

---

## Phase 3 (next approval) — Semantic Search + Recommendations

- Backfill embeddings for all existing videos via cron job (`pg_cron` → `runPostUploadPipeline` embedding step).
- `match_videos(query_embedding, lang, limit)` SQL RPC.
- Search page: hybrid (existing ilike + semantic rerank).
- "For You" rail on home: weighted combo of follows + watch history categories + embedding similarity to recently watched.

---

## Technical notes (for the curious)

- **Captions language**: Whisper/`gpt-4o-mini-transcribe` has solid Kinyarwanda coverage via the underlying model. We pass no `language` hint to allow auto-detect, then translate via Gemini preserving the SRT cue timing line-by-line — cheaper and more controllable than re-transcribing.
- **No edge functions** for AI work — TanStack `createServerFn` with Lovable AI Gateway, matching the stack.
- **Cost control**: `ai_jobs` table makes the pipeline idempotent and skippable, so regenerate buttons don't double-bill on retries.
- **Schema**: `vector(1536)` (not 3072) keeps HNSW fast and within Postgres index size limits.

---

Reply **"go phase 1"** and I'll build it. If you want to reshuffle (e.g. captions only, skip metadata), say so before I start.