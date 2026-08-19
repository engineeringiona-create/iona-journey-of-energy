# LESSONS.md — past mistakes + the rule that prevents a repeat

## 1. A blanket SPA redirect broke every nav link on Railway

`public/_redirects` contained `/* /index.html 200` — a Netlify-style catch-all rewrite. On a multi-page site (not a SPA), this meant every route Railway's static host couldn't resolve *before* checking for a real file got rewritten straight to the homepage. Symptom: clicking any navbar link redirected back to `index.html`.

**Rule:** never add an SPA catch-all rewrite to a multi-page static build. If a host needs a fallback rule at all, it should be a 404 handler, not a 200 rewrite to the homepage.

## 2. Per-page content storage existed in the schema but not in the code

`supabase/schema.sql` was already commented "One row = one page's full content override, keyed by page id" — the schema was designed correctly from the start. But `src/i18n.js` had `.eq('id', 'home')` hardcoded, so every page (Teknoloji, Hakkımızda, Etki, İletişim) was reading the homepage's override row instead of its own, and the admin editor could only ever write to `id: 'home'` too.

**Rule:** when a schema/table is explicitly designed to support N keys, grep for every place that queries or writes it before calling the corresponding feature "done" — a correct schema comment does not mean the code honors it.

## 3. No `start` script meant Railway improvised

`package.json` had `dev`, `build`, `preview` — no `start`. Without one, Railway's platform-level defaults for serving a detected static output can behave like an SPA host (fallback-to-index), which produces the exact same symptom as lesson #1 even after `_redirects` is fixed.

**Rule:** any Vite multi-page site deployed to a Node-based host needs an explicit `start` script that serves `dist/` with SPA fallback off, verified with a real `npm start` + `curl` test against every route — not just `npm run dev`, which never exercises the production serving path at all.

## 4. "Live site shows old content" had nothing to do with the code

After fixing #1–#3 and being told the live build *still* showed old content, the actual cause was that GitHub's default branch (`master`) was frozen at the very first commit, while every fix had been pushed to `main` only. If the deploy host's source branch is `master` (a very common default when a project is first connected), no amount of correct code on `main` will ever reach production.

**Rule:** when a live deploy looks stale *after* real fixes are confirmed pushed, check which branch is actually wired to the deploy — `git remote show origin` (default branch) and the host's dashboard Source setting — before touching code again. `git log --oneline <branch> -1` on both branches is a 5-second sanity check that would have caught this immediately.

## 5. A missing `.env` value fails silently, not loudly

`getSupabase()` returns `null` (not a thrown error) when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are empty — by design, so the site still works content-wise without a DB configured. But the admin editor's save button still shows "Kaydedildi" (Saved) in that state; it just wrote to `localStorage` instead of Supabase, silently.

**Rule:** a "success" message from the admin panel doesn't prove the DB was touched. If edits don't show up for other people/devices, check `.env` for empty Supabase values before suspecting the database or the code.

## 6. Disabling `serve`'s cleanUrls also disabled its index-file resolution

`public/serve.json` was set to `{ "cleanUrls": false }` to stop `serve` from 301-redirecting `/page.html` → `/page`. That flag turned out to control more than advertised: it also disabled `serve`'s automatic resolution of `/` → `index.html`, so root requests fell through to a raw directory listing (`serve`'s "Files within dist/" page) instead of the homepage. This shipped and went unnoticed for two rounds of fixes because every verification pass checked HTTP status codes (`200`) and specific `.html` page titles, but never checked what `/` itself actually rendered — a directory listing is also a `200 text/html` response, so the status-code check passed while the page was wrong.

**Rule:** when a static-server config flag fixes one symptom, re-test the *other* behaviors that flag's documentation doesn't explicitly promise to leave alone — don't assume a config option's effect is limited to what it's named after. And "200 status code" is not "correct content": always check response *body*, not just status, when verifying a fix to routing/serving behavior. Fixed by adding an explicit `"rewrites"` rule (`"/"` → `"/index.html"`) to `serve.json` alongside `cleanUrls: false`.

## 7. A browser's cached 301 outlived the redirect that caused it

Before `cleanUrls: false` was added, `serve` 301-redirected `/teknoloji.html` → `/teknoloji` (its default clean-URL behavior). Browsers cache `301`s aggressively and don't re-check them, so a browser that had visited a page even once under the old config kept silently rewriting `/teknoloji.html` clicks to `/teknoloji` — even after the server-side redirect was removed. With `cleanUrls: false` and no matching literal file, the server now correctly served nothing for that extensionless path, i.e. `404`. Symptom: homepage fine (never had a `.html` suffix to redirect away), every other nav link `404` on a browser that had loaded the site before this session's fixes — while a fresh/incognito browser would have worked the whole time.

**Rule:** any server change that removes a redirect must also account for browsers that already cached the old one — either add server-side handling for the redirect's *destination* too (done here: `serve.json` now has explicit rewrites mapping every clean path, e.g. `/teknoloji`, back to its `.html` file, so both forms resolve with no redirect), or accept that affected users need a hard refresh / cache clear. Prefer the server-side fix when it's cheap, since it needs no user action.
