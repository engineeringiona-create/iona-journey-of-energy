# TODO.md — unfinished work

- [ ] Confirm in the Railway dashboard (Settings → Source) which branch the service actually deploys from, and confirm Settings → Deploy → Start Command isn't manually overridden to something other than `npm start`.
- [ ] Set real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Railway's environment variables — and locally in `.env` if the admin editor needs testing against the real DB instead of the `localStorage` fallback.
- [ ] Verify the live Supabase `site_content` table actually has rows for `teknoloji` / `hakkimizda` / `etki` / `iletisim`, not just a leftover `home` row from before per-page storage existed.
- [ ] `ionaflux.html` isn't in the admin editor's page selector or `src/lib/pages.js`'s id map — decide whether it needs live-editing support.
- [ ] Build warns that `dist/assets/scene-utils-*.js` is ~737 kB minified — consider dynamic `import()` / manual chunking for the Three.js scene code per Vite's own suggestion.
