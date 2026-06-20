// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// `nitro: true` enables Nitro for self-hosted builds (Vercel, Netlify, Cloudflare
// Pages, EdgeOne, etc.) with zero-config target auto-detection — Vercel/Netlify/
// EdgeOne set their own env vars and Nitro picks the right preset automatically.
// Inside the Lovable sandbox the Cloudflare Worker preset is still forced, so the
// live preview and Lovable Publish flow are unaffected.
export default defineConfig({
  nitro: true,
});
