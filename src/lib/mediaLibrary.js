import { getSupabase } from './supabaseClient.js';

const BUCKET = 'site_assets';

/* Lists everything under a flat "library/" prefix in the bucket — the
   per-field uploads elsewhere (announcements/${key}-*, ${pageId}/${key}-*
   from imageUpload.js) live outside this prefix so the library view
   doesn't mix in every ad-hoc field upload the site has ever made, only
   assets deliberately added through the Medya Kütüphanesi uploader. */
const LIBRARY_PREFIX = 'library';

export async function listMedia() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase yapılandırılmamış.', items: [] };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(LIBRARY_PREFIX, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) return { ok: false, error: error.message, items: [] };

  const items = (data || [])
    .filter((entry) => entry.name && entry.id) // real objects only, not the placeholder folder row
    .map((entry) => {
      const path = `${LIBRARY_PREFIX}/${entry.name}`;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return {
        path,
        name: entry.name,
        url: urlData.publicUrl,
        size: entry.metadata?.size ?? null,
        mimeType: entry.metadata?.mimetype ?? null,
        createdAt: entry.created_at,
      };
    });
  return { ok: true, items };
}

/* Slugifies the original filename (lowercase, ascii, hyphens) and
   prefixes it with a timestamp so two uploads of "logo.png" never
   collide and sort newest-first by name as a side effect. */
function slugifyFilename(fileName) {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : 'jpg';
  const slug = base
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents (İ, ş, ğ, ...)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'gorsel';
  return `${Date.now()}-${slug}.${ext}`;
}

/* Uploads one file into the library via the standard supabase-js storage
   call (same method imageUpload.js already uses elsewhere, proven to
   work against this bucket). supabase-js v2's storage.upload() has no
   public byte-level progress event — reaching into the client's
   internal REST/auth fields to hand-roll an XHR for one would mean
   depending on undocumented properties that can rename or disappear
   across SDK versions. The UI reports progress per-file instead
   (queued -> uploading -> done), which is honest about what this
   actually observes. */
export async function uploadToLibrary(file) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase yapılandırılmamış.' };

  const path = `${LIBRARY_PREFIX}/${slugifyFilename(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (error) return { ok: false, error: error.message };

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: urlData.publicUrl, path };
}

export async function deleteFromLibrary(path) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase yapılandırılmamış.' };
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
