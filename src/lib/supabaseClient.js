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
  client = url && anonKey ? createClient(url, anonKey) : null;
  return client;
}
