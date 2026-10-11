/**
 * Supabase project the site reads from. Both values are public by design
 * (RLS in supabase/schema.sql decides who may write). When either is missing
 * the site runs on the bundled snapshot and the admin area is switched off.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const SUPABASE = url && anonKey ? { url, anonKey } : null;
