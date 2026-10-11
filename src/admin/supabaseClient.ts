import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '@/config/supabase';

/**
 * Full SDK for the admin area only (sign-in, writes, storage). The public
 * site reads through services/supabaseRest.ts and never loads this chunk.
 */
export const supabase = SUPABASE
  ? createClient(SUPABASE.url, SUPABASE.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bilimgo:admin-auth' },
    })
  : null;

/** Supabase errors carry a message worth showing; anything else gets a plain one */
export const errorText = (err: unknown) =>
  err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : 'Что-то пошло не так';
