import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';

/**
 * Counters the whole admin shows: what is waiting for a person. Refreshed on
 * navigation, on focus and every minute; screens call refresh() after they
 * change something, so the sidebar never lags behind the page.
 */
export interface AdminCounts {
  newLeads: number;
  workingLeads: number;
  pendingSubmissions: number;
  /** Requests that never reached Telegram */
  undelivered: number;
}

interface AdminData {
  counts: AdminCounts;
  refresh: () => void;
}

const ZERO: AdminCounts = { newLeads: 0, workingLeads: 0, pendingSubmissions: 0, undelivered: 0 };
const Ctx = createContext<AdminData | null>(null);

const head = (table: string) => supabase!.from(table).select('id', { count: 'exact', head: true });

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<AdminCounts>(ZERO);

  const refresh = useCallback(() => {
    if (!supabase) return;
    void Promise.all([
      head('leads').eq('status', 'new'),
      head('leads').eq('status', 'working'),
      head('submissions').eq('status', 'pending'),
      head('leads').is('notified_at', null).neq('status', 'spam'),
    ]).then(([a, b, c, d]) =>
      setCounts({ newLeads: a.count ?? 0, workingLeads: b.count ?? 0, pendingSubmissions: c.count ?? 0, undelivered: d.count ?? 0 }),
    );
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const value = useMemo(() => ({ counts, refresh }), [counts, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminData must be used inside AdminDataProvider');
  return ctx;
}
