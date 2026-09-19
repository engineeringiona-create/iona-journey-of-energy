import { getSupabase } from './supabaseClient.js';

/* Calls the admin-copilot-chat Supabase Edge Function. `history` is the
   full visible conversation so far, already in Gemini `contents` shape:
   [{role: 'user'|'model', parts: [{text}]}] — this function is stateless
   (same pattern as linkedin-to-announcement/transformLinkedInPost), the
   client owns the conversation. */
export async function sendCopilotMessage(history) {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Supabase yapılandırılmamış, AI asistan kullanılamıyor.' };
  }

  const { data, error } = await supabase.functions.invoke('admin-copilot-chat', {
    body: { messages: history },
  });

  if (error) {
    return { ok: false, error: error.message || 'AI asistan yanıt veremedi.' };
  }
  if (data?.error) {
    return { ok: false, error: data.error };
  }
  return { ok: true, ...data };
}
