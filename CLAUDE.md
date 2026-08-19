# CLAUDE.md — read this every session, no setup needed

This file holds rules that don't change. Long version + reasoning lives in `AGENTS.md`. Past mistakes and their fixes live in `LESSONS.md`.

## What this project is

**IONA Journey of Energy** — the user's active/primary IONA site. Multi-page static build: Vite 7 + vanilla JS (no framework) for the public pages, `three` + `gsap` for the 3D/motion, a small React island (`src/components/Admin/`) for the `/admin.html` content editor only. Not a SPA — every page is a real `.html` file.

- Lives at a Windows-mounted path (`/mnt/c/...`) under WSL — expect slower file I/O than a native-fs project. `vite.config.js` already sets `watch: { usePolling: true }` to work around drvfs not firing inotify events. If dev server feels laggy, that's expected, not a bug.
- Dev: `npm run dev` → `http://localhost:5173`
- Build: `npm run build` → `dist/`, multi-page (`vite.config.js` → `build.rollupOptions.input` lists every page: `index.html`, `teknoloji.html`, `hakkimizda.html`, `etki.html`, `iletisim.html`, `ionaflux.html`, `admin.html`). Any new top-level page HTML file must be added there or it won't build.
- Deploy: Railway. `railway.json` pins `builder: NIXPACKS` and `startCommand: npm start`. `package.json`'s `start` script runs `serve dist -l $PORT --no-clipboard` — no `-s`/SPA flag, so no route ever silently falls back to `index.html`. `public/serve.json` sets `cleanUrls: false` so `serve` doesn't 301-redirect `/page.html` → `/page`.
- Git: GitHub's default branch is `master`. As of 2026-08-19 both `main` and `master` point at the same commit (`450eed2`) — keep them in sync when pushing, since Railway's deploy source branch may be either one. Don't assume a push to `main` alone reached production.

## Content / i18n system

- `src/i18n.js` renders every `[data-i18n]` node from a hardcoded JSON dictionary (`src/i18n/<lang>.json`), then layers a DB override on top from Supabase table `site_content`.
- `site_content` is one row per **page**, not one global row: `id` ∈ `home | teknoloji | hakkimizda | etki | iletisim` (schema: `supabase/schema.sql`). The mapping from URL path → row id lives in `src/lib/pages.js` (`pageIdForPath`) — this is the single source of truth, shared by `i18n.js` and the admin editor. Never hardcode a page id anywhere else.
- Admin editor: `src/components/Admin/LiveEditor.jsx`, reached via `/admin.html`. Has a page-selector dropdown and an Edit/Navigate mode toggle. Saves write to `site_content` keyed by whichever page is selected.
- `.env` needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. If either is empty, `getSupabase()` returns `null` and the admin editor **silently** falls back to writing `localStorage` instead of the DB (see `src/lib/localContent.js`) — it still shows "Kaydedildi" (Saved). Don't trust that message alone; check `.env` first if edits don't show up cross-browser/cross-device.

## Before claiming a deploy/routing fix is done

1. `npm run build`, confirm every expected `dist/*.html` file exists.
2. Run the **real** start command (`npm start`, or `serve dist -l <port>` directly) — not `npm run dev` — and `curl` every page path plus one bogus path. Every real page should be `200` with the right `<title>`; the bogus path should be `404`, never a silent `200` of `index.html`.
3. Check which git branch is actually wired to the Railway service before assuming code changes alone explain stale content — see the branch note above.
