/* Same-shape local fallback as src/lib/localContent.js, but for image
   overrides (src / crop-position / zoom). Kept as a SEPARATE storage key
   and, unlike localContent.js, scoped per page id — image edits never
   need to merge across pages the way i18n keys sometimes implicitly do,
   so there is no reason to flatten them into one bucket. */
const STORAGE_KEY = 'iona-admin-images';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function readLocalImages(pageId) {
  const all = readAll();
  return all[pageId] || null;
}

export function writeLocalImages(pageId, edits) {
  try {
    const all = readAll();
    const existing = all[pageId] || {};
    const merged = { ...existing };
    Object.entries(edits).forEach(([key, patch]) => {
      merged[key] = { ...(existing[key] || {}), ...patch };
    });
    all[pageId] = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearLocalImages(pageId) {
  try {
    const all = readAll();
    delete all[pageId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    return false;
  }
}
