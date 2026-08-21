import { getSupabase } from './supabaseClient.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_FALLBACK_BYTES = 1.5 * 1024 * 1024;

/* Tries Supabase Storage bucket "site_assets" first (see supabase/schema.sql
   for the bucket + public policies); falls back to a base64 data URL — kept
   small on purpose, since base64 goes straight into the site_content jsonb
   row rather than object storage. */
export async function uploadImage(file, { pageId, key }) {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'Dosya çok büyük (maks. 5MB).' };
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${pageId}/${key}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('site_assets')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('site_assets').getPublicUrl(path);
      if (data?.publicUrl) return { ok: true, url: data.publicUrl, mode: 'supabase' };
      throw new Error('publicUrl alınamadı');
    } catch (e) {
      console.warn('[IONA Admin] Supabase Storage yükleme başarısız, base64 yedeğine geçiliyor:', e.message);
    }
  }

  if (file.size > MAX_BASE64_FALLBACK_BYTES) {
    return { ok: false, error: 'Supabase yapılandırılmamış ve dosya taban64 yedeği için çok büyük (maks. 1.5MB).' };
  }
  try {
    const url = await fileToBase64(file);
    return { ok: true, url, mode: 'local' };
  } catch (e) {
    return { ok: false, error: 'Dosya okunamadı.' };
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
