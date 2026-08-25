import { getSupabase } from './supabaseClient.js';

/* Calls the linkedin-to-announcement Supabase Edge Function — the only
   place the Anthropic API key is used, kept server-side as a Supabase
   secret (see supabase/functions/linkedin-to-announcement/index.ts).
   Never call the Anthropic API directly from this file: doing so would
   require the key in client-side JS, which ships in the public bundle. */
export async function transformLinkedInPost(rawText, targetLanguage) {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Supabase yapılandırılmamış, AI dönüştürme kullanılamıyor.' };
  }

  const { data, error } = await supabase.functions.invoke('linkedin-to-announcement', {
    body: { rawText, targetLanguage },
  });

  if (error) {
    return { ok: false, error: error.message || 'AI dönüştürme başarısız oldu.' };
  }
  if (data?.error) {
    return { ok: false, error: data.error };
  }
  return { ok: true, result: data.result };
}
