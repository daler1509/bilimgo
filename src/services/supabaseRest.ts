import { SUPABASE } from '@/config/supabase';

/*
 * The public site talks to Supabase through two plain REST calls, so the
 * SDK (auth, realtime, storage) stays in the admin chunk.
 */

export class SupabaseRestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseRestError';
  }
}

function headers(extra: Record<string, string> = {}) {
  if (!SUPABASE) throw new Error('Supabase is not configured');
  const h: Record<string, string> = { apikey: SUPABASE.anonKey, Accept: 'application/json', ...extra };
  // Legacy anon keys are JWTs and go in Authorization too; new publishable keys (sb_publishable_…) must not.
  if (SUPABASE.anonKey.startsWith('eyJ')) h.Authorization = `Bearer ${SUPABASE.anonKey}`;
  return h;
}

async function fail(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  throw new SupabaseRestError(res.status, body?.message ?? res.statusText);
}

export async function restSelect<T>(table: string, query: string, signal?: AbortSignal): Promise<T[]> {
  const res = await fetch(`${SUPABASE!.url}/rest/v1/${table}?${query}`, { headers: headers(), signal });
  if (!res.ok) return fail(res);
  return (await res.json()) as T[];
}

/** Insert without reading back — anonymous visitors may write a row but not see it */
export async function restInsert(table: string, row: object): Promise<void> {
  const res = await fetch(`${SUPABASE!.url}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) return fail(res);
}
