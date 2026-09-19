/* Same-shape fallback for src/lib/supabaseClient.js: when no Supabase
   project is configured (.env missing), content overrides live in this
   browser's localStorage instead — same {lang: {key: value}} shape as
   the site_content table, so callers merge it identically either way. */
const STORAGE_KEY = 'iona-admin-content';

export function readLocalContent(lang) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all[lang] || null;
  } catch (e) {
    return null;
  }
}

export function writeLocalContent(lang, edits) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[lang] = { ...(all[lang] || {}), ...edits };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    return false;
  }
}
