# AGENTS.md — long form of CLAUDE.md

Same rules as `CLAUDE.md`, with the reasoning behind each one. Read this when you need to understand *why*, not just *what*.

## Why this is a multi-page build, not a SPA

The site has five real pages plus an admin tool (`index`, `teknoloji`, `hakkimizda`, `etki`, `iletisim`, `ionaflux`, `admin`), each its own `.html` entry, each linked with plain `<a href="/page.html">` tags — no client router, no `history.pushState`. Vite supports this natively via `build.rollupOptions.input`: give it a map of `{ name: resolve(__dirname, 'file.html') }` and it builds each as its own output file with its own JS/CSS graph. The `name` keys only affect generated asset chunk filenames (e.g. `main-C7x4cHDX.js`) — they have no effect on the URL the page is served at, that's whatever the `.html` file itself is named.

This matters because a static host that assumes "one entry point, client-side routing" (the default for most CRA/Vite-SPA templates) will rewrite every unmatched request to `index.html`. That is exactly wrong for this project and was the root cause of the Railway navigation bug (see `LESSONS.md`).

## Why `railway.json` exists

Railway services can get their build/start configuration from three places, in order of precedence: dashboard manual overrides > `railway.json`/`railway.toml` in the repo > Nixpacks auto-detection. Before this project had an explicit `start` script, Railway likely auto-detected it as a static site and used its own default static server behavior (SPA-style fallback). Adding a `start` script to `package.json` alone doesn't guarantee Railway picks it up if the dashboard or Nixpacks' cached detection disagrees — `railway.json` pins `builder` and `startCommand` in code so the deploy config is reviewable and reproducible instead of living only in a dashboard setting nobody can see from the repo. It does **not** override a manually-set dashboard Start Command — that still wins if one was set by hand, which is why `CLAUDE.md`'s deploy-fix checklist tells you to go check the dashboard, not just assume the file fixes it.

## Why `serve`, not `sirv-cli`

Both are legitimate static file servers with a "don't fall back to index.html" option. `serve`'s flag is unambiguous: `-s`/`--single` enables SPA fallback, and simply omitting it disables it — there's no separate boolean syntax to get wrong. `sirv-cli`'s `--single` flag semantics were less certain to verify without installing it first, and given the whole point of this fix was to stop an accidental fallback-to-home, the safer, more legible option won. `serve`'s only wrinkle was its own default "clean URLs" behavior (see below).

## Why `public/serve.json` disables `cleanUrls`

By default `serve` 301-redirects `/page.html` → `/page` (strips the extension). That redirect does land on the right page — it's not the SPA-fallback bug — but it's still an extra hop and a URL-shape change nobody asked for, on a project whose whole complaint was "unexpected redirects." `serve` reads its config from a `serve.json` inside the directory it's serving (`dist/`), not the project root, and Vite copies everything under `public/` into `dist/` verbatim on every build — so the config lives at `public/serve.json` and rides along automatically. `cleanUrls: false` makes every request to `/page.html` resolve directly with a `200`, zero redirects.

## Why `src/lib/pages.js` exists

`src/i18n.js` (runs on every real page, to load DB content overrides) and `src/components/Admin/LiveEditor.jsx` (the admin tool that writes those overrides) both need the exact same answer to "what Supabase row id does this page use." Before this existed, `i18n.js` had `.eq('id', 'home')` hardcoded — meaning every non-home page was silently reading (and would have been overwritten by) the homepage's content row. Duplicating that id/path mapping in two files invites exactly that kind of drift the next time a page is added or renamed, so it's centralized once and imported by both.

## Why `master` and `main` got fast-forwarded together

`git remote show origin` reported `master` as GitHub's default branch, and it was frozen at the very first commit — before the admin editor, before Tailwind config, before every routing fix in this project's history. All real work had been happening on `main` only. Since Railway projects typically deploy from whatever branch is configured as the source (often defaulting to the repo's default branch at project-creation time), this fully explained a "why does the live site still show old content after N fixes" complaint that had nothing to do with code. `master` was a strict ancestor of `main` (verified with `git merge-base --is-ancestor` before pushing), so fast-forwarding it was a lossless, non-destructive way to make sure whichever branch Railway is actually watching has the real code.
