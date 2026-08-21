/* Generic localStorage fallback for Phase 33 admin buckets (SEO, section
   visibility, theme, announcement bar) — same "no Supabase configured"
   escape hatch as src/lib/localContent.js / imageContent.js, but shared
   across several small buckets instead of one file per bucket. Scope is
   an arbitrary string key, e.g. "seo:etki", "sections:etki", "theme". */
const STORAGE_KEY = 'iona-admin-store';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function readLocalBucket(scope) {
  const all = readAll();
  return all[scope] || null;
}

export function writeLocalBucket(scope, patch) {
  try {
    const all = readAll();
    all[scope] = { ...(all[scope] || {}), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearLocalBucket(scope) {
  try {
    const all = readAll();
    delete all[scope];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    return false;
  }
}
