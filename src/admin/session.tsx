import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export type AdminStatus = 'loading' | 'signed-out' | 'forbidden' | 'admin';

interface AdminSession {
  status: AdminStatus;
  email: string | null;
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AdminSession | null>(null);

/**
 * Who is signed in and whether they may edit. Being signed in is not enough:
 * the account must be listed in public.admins (checked by is_admin() — the
 * same function the RLS policies use).
 */
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase || !userId) return setIsAdmin(null);
    let alive = true;
    setIsAdmin(null);
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (alive) setIsAdmin(!error && data === true);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase не настроен';
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return null;
    return /invalid login credentials/i.test(error.message) ? 'Неверная почта или пароль' : error.message;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const status: AdminStatus =
    session === undefined ? 'loading' : !session ? 'signed-out' : isAdmin === null ? 'loading' : isAdmin ? 'admin' : 'forbidden';

  const value = useMemo(() => ({ status, email: session?.user.email ?? null, signIn, signOut }), [status, session, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminSession must be used inside AdminSessionProvider');
  return ctx;
}
