import { getSupabase } from './supabaseClient.js';
import { compressForUpload } from './imageCompression.js';

const BUCKET = 'site_assets';
const THUMB_SUFFIX = '_thumb';

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

  // real objects only, not the placeholder folder row
  const entries = (data || []).filter((entry) => entry.name && entry.id);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const publicUrl = (name) => supabase.storage.from(BUCKET).getPublicUrl(`${LIBRARY_PREFIX}/${name}`).data.publicUrl;

  // "_thumb.webp" siblings (written by uploadToLibrary below) are paired onto their main
  // entry as thumbUrl and never rendered as their own grid card.
  const items = entries
    .filter((entry) => !entry.name.endsWith(`${THUMB_SUFFIX}.webp`))
    .map((entry) => {
      const thumbName = entry.name.endsWith('.webp') ? entry.name.replace(/\.webp$/, `${THUMB_SUFFIX}.webp`) : null;
      const thumbEntry = thumbName ? byName.get(thumbName) : null;
      const url = publicUrl(entry.name);
      return {
        path: `${LIBRARY_PREFIX}/${entry.name}`,
        name: entry.name,
        url,
        thumbUrl: thumbEntry ? publicUrl(thumbEntry.name) : url, // legacy pre-thumbnail uploads fall back to full-res
        size: entry.metadata?.size ?? null,
        mimeType: entry.metadata?.mimetype ?? null,
        createdAt: entry.created_at,
      };
    });
  return { ok: true, items };
}

/* Slugifies the original filename (lowercase, ascii, hyphens) and
   prefixes it with a timestamp so two uploads of "logo.png" never
   collide and sort newest-first by name as a side effect. extOverride
   lets callers force the extension to "webp" post-compression instead
   of trusting the original file's extension. */
function slugifyFilename(fileName, extOverride) {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = extOverride || (dot > 0 ? fileName.slice(dot + 1).toLowerCase() : 'jpg');
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
   actually observes.

   Before either upload, the file is resized/re-encoded client-side
   (see imageCompression.js): main asset capped at 1920px/quality 0.82,
   plus a "_thumb" sibling capped at 350px/quality 0.7 for grid cards.
   Both share one slug so listMedia can pair them back up by name. */
export async function uploadToLibrary(file) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase yapılandırılmamış.' };

  const { main, thumb } = await compressForUpload(file);
  const mainExt = main.name.split('.').pop().toLowerCase();
  const mainPath = `${LIBRARY_PREFIX}/${slugifyFilename(file.name, mainExt)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(mainPath, main, { cacheControl: '3600', upsert: false, contentType: main.type || undefined });
  if (error) return { ok: false, error: error.message };

  let thumbUrl = null;
  if (thumb) {
    const thumbPath = mainPath.replace(/\.webp$/, `${THUMB_SUFFIX}.webp`);
    const { error: thumbError } = await supabase.storage
      .from(BUCKET)
      .upload(thumbPath, thumb, { cacheControl: '3600', upsert: false, contentType: thumb.type || undefined });
    if (thumbError) {
      console.warn('[IONA Admin] Küçük resim yükleme başarısız:', thumbError.message);
    } else {
      thumbUrl = supabase.storage.from(BUCKET).getPublicUrl(thumbPath).data.publicUrl;
    }
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(mainPath);
  return { ok: true, url: urlData.publicUrl, thumbUrl: thumbUrl || urlData.publicUrl, path: mainPath };
}

export async function deleteFromLibrary(path) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase yapılandırılmamış.' };
  const thumbPath = path.endsWith('.webp') ? path.replace(/\.webp$/, `${THUMB_SUFFIX}.webp`) : null;
  const { error } = await supabase.storage.from(BUCKET).remove(thumbPath ? [path, thumbPath] : [path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
