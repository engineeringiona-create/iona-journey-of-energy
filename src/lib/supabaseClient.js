import { createClient } from '@supabase/supabase-js';

let client;

/* Returns null (not a thrown error) when the env vars are missing —
   every caller treats "no client" as "fall back to hardcoded content"
   rather than a hard failure, so the site works with or without
   Supabase configured. */
export function getSupabase() {
  if (client !== undefined) return client;
  const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    client = url && anonKey ? createClient(url, anonKey) : null;
  } catch (e) {
    /* createClient() throws synchronously for a malformed URL (not just
       a rejected promise), which would otherwise escape every caller's
       try/catch and, via the top-level `await initI18n()` in each page's
       entry script, permanently block the rest of that script — including
       the preloader's dismiss timer, leaving the page stuck on the
       loading screen. Falling back to null here keeps the "no DB
       configured" contract intact instead of crashing the page. */
    console.warn('[IONA] VITE_SUPABASE_URL geçersiz, Supabase devre dışı:', e.message);
    client = null;
  }
  return client;
}
