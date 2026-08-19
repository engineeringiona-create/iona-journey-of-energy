# CHANGELOG.md — user-visible changes

> No panel/dashboard tool is wired into this repo yet, so nothing here auto-flows anywhere — this file is maintained by hand until such a tool exists.

## 2026-08-19

- **Fixed:** navbar links no longer redirect back to the homepage on Railway. Root causes: a leftover SPA catch-all rewrite in `public/_redirects`, and no explicit `start` script telling the host how to serve a multi-page build.
- **Fixed:** the live site was still showing old content after the routing fix because GitHub's default branch (`master`) was frozen at the very first commit while all work had been pushed to `main` only. Both branches now point at the same commit.
- **Added:** the admin content editor (`/admin.html`) can now switch between all five pages (Anasayfa, Teknoloji, Hakkımızda, Etki, İletişim) instead of only ever editing the homepage, and has an Edit/Navigate mode toggle so navbar links can be clicked normally without triggering text editing.
- **Fixed:** content saved through the admin editor now writes to the correct page's row in the database instead of always overwriting the homepage's row.
- **Fixed:** the site's root URL (`/`) was showing a raw file/directory listing instead of the homepage — caused by a serving config flag change that had an unintended side effect. Root now serves `index.html` directly again.
