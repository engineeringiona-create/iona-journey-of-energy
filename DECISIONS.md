# DECISIONS.md — preferences + why

## `serve` over `sirv-cli` for the Railway start script
Both disable SPA fallback; `serve`'s flag is unambiguous (`-s` enables it, omitting it disables it, no separate boolean syntax to get wrong). Given the bug being fixed was an *unwanted* fallback, the option with certain, verifiable flag semantics won over the untested alternative.

## `public/serve.json` with `cleanUrls: false`
`serve` redirects `/page.html` → `/page` by default. It lands on the right page, so it's not a bug, but it's an unrequested URL-shape change on a project whose whole complaint was "unexpected redirects." Turned off so every request resolves directly with no hop at all.

## `railway.json` pinning `builder` + `startCommand`
Guards against a stale Railway dashboard setting (e.g. from before this project had a `start` script) silently overriding `package.json`. Doesn't fully solve it — a manually-set dashboard Start Command still wins — but it makes the intended deploy config reviewable in the repo instead of invisible.

## `src/lib/pages.js` as single source of truth for page id/label/path
Shared by `src/i18n.js` (reading content overrides) and the admin `LiveEditor.jsx` (writing them) so the two can never drift on what "teknoloji" or "/etki.html" means. Adding a new page means adding one entry here, not hunting down every place a page id is referenced.

## Fast-forwarded `master` to `main` instead of only repointing Railway
`master` is GitHub's default branch and was a strict ancestor of `main` (verified before pushing — a true fast-forward, not a rewrite). Bringing it up to date protects against *anything* that assumes the default branch is current, not just Railway, and is the cheapest fix available from the repo alone.

## Admin editor's per-page dropdown only lists 5 pages (not `ionaflux`)
Matches what was explicitly requested (Anasayfa, Teknoloji, Hakkımızda, Etki, İletişim). `ionaflux.html` still exists and builds fine, it's just not yet wired into the content-editing flow or the `site_content` id map — tracked in `TODO.md` rather than assumed-in-scope.
