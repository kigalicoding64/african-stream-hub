
## 2026-06-29 — match_videos / for_you_feed (Phase 2 AI)
- `public.match_videos(vector, int, float)` is SECURITY DEFINER and intentionally EXECUTE-granted to `anon` + `authenticated`. It is the public semantic-search RPC and only returns rows where `videos.visibility='public' AND status='ready'` (RLS-equivalent enforced inside the function body). Linter warnings 0028 (anon) and 0029 (authenticated) for this function are expected.
- `public.for_you_feed(uuid, int)` is SECURITY DEFINER and EXECUTE-granted to `authenticated` only. Same visibility filter applied inside the body. Linter warning 0029 for this function is expected.
