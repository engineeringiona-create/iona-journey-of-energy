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

## 3D models

- Only **one** page runs WebGL: `index.html`'s hero Digital Twin (`src/components/DigitalTwin/`). `teknoloji.html`'s 3-machine showcase was removed on 2026-09-19 (IONA delivers plants, not equipment) — its sources sit in `.backups/removed-services-3d/`. Don't reintroduce Three.js on other pages without a reason.
- The hero loads `iona-tesis-3d.draco.glb` (~0.7 MB). Its URL is resolved by `src/lib/modelAssets.js`, not hardcoded: with `VITE_MODEL_BUCKET` set it comes from Supabase Storage's CDN, otherwise from `public/models/`. **The local copy must stay** — it's the fallback when the remote one fails (`fallBackToLocalModel` in `GltfTwinScene.jsx`), so a dead CDN never leaves the hero empty.
- `npm run model:build` rebuilds the GLB from source; `npm run model:upload` pushes it to Storage. Upload needs `SUPABASE_SERVICE_ROLE_KEY` in `.env` — that key bypasses RLS entirely, so it must never carry a `VITE_` prefix or reach client code.

## Images

- **Every photo on the site is WebP, max 1800 px on the long edge.** Raw camera JPEGs (3–8 MB, up to 5792×4344) were what made pages heavy; they were converted on 2026-09-19 and the originals archived to `.backups/original-images/`. A new photo goes through the same pass before it ships — there is no build-time image pipeline, so an un-converted JPEG dropped into `public/images/` stays un-converted all the way to production.
- Conversion (no cwebp/ImageMagick/ffmpeg on this box; Pillow lives in the 3D venv):
  `~/.iona-3d/.venv/bin/python` → `ImageOps.exif_transpose(im)` then `im.save(dst, 'WEBP', quality=82, method=6)`.
  **`exif_transpose` is not optional** — phone photos carry an EXIF rotation flag that WebP does not preserve, so skipping it publishes sideways images.
- Photos are referenced from two places, and a rename has to cover both: `<img src>` in the `.html` files, **and** `/images/equipment/*.webp` inside `GltfTwinScene.jsx` (the Digital Twin's detail cards) plus one `bannerImage` in `src/i18n.js`. A grep over `*.html` alone will miss 17 references.

## Icons (Material Symbols)

- The icon font is **subsetted by name**. Every page's `<head>` requests it with `&icon_names=<50 names>`; without that, Google ships the entire icon set — 6.7 MB per page, which was the single heaviest asset on the site.
- **Adding a new icon means adding its name to that list in all 8 HTML files.** An icon missing from the list has no ligature in the font, so the browser renders the literal word (`arrow_forward`) instead of the glyph. It fails loudly on screen but silently in the console — nothing errors.
- The `FILL` axis must stay in the request: `HistoryDropdown.jsx` toggles `fontVariationSettings: 'FILL' 1` on the starred-row icon.
- Icon names live in three kinds of places, so grep all of them before changing the list: `<span class="material-symbols-outlined">name</span>` in HTML, `{t.icon}` fed from `icon:` fields in JSX data arrays (`LiveEditor`, `TextEditPopover`, `PhoneMockup`), and `textContent` assignments in `common.js` (theme toggle's `dark_mode`/`light_mode`).

## Adding a section to a page

- Deleting a section means deleting its anchor. `SEARCH_INDEX` in `src/common.js` deep-links to `#anchor`s across pages, and a browser ignores a missing anchor silently — the visitor just lands at the top of the page with no error anywhere. Removing three machine sections on 2026-09-19 left three dead search entries and three dead homepage panel links behind. Re-validate that list whenever an `id=` disappears.
- A `.fade-in-element` only becomes visible when an ancestor `.fade-in-section` scrolls into view (`initFadeIn` in `src/common.js`). A new block with fade-in children and no `.fade-in-section` wrapper stays at `opacity: 0` permanently — and it looks like a layout bug, not an animation one. Above-the-fold copy that shouldn't wait gets `is-visible` written straight into the markup instead.

## Before claiming a deploy/routing fix is done

1. `npm run build`, confirm every expected `dist/*.html` file exists.
2. Run the **real** start command (`npm start`, or `serve dist -l <port>` directly) — not `npm run dev` — and `curl` every page path plus one bogus path. Every real page should be `200` with the right `<title>`; the bogus path should be `404`, never a silent `200` of `index.html`.
3. Check which git branch is actually wired to the Railway service before assuming code changes alone explain stale content — see the branch note above.
