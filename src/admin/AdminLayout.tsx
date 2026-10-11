import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useSearchParams } from 'react-router';
import { ExternalLink, LogOut } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Toaster } from '@/components/ui/Toaster';
import { cn } from '@/lib/cn';
import { AdminSessionProvider, useAdminSession } from './session';
import { supabase } from './supabaseClient';
import s from './admin.module.css';

/** Keeps the admin area out of search engines and tells tabs apart */
function useAdminDocument() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'Админка — BilimGo';
    return () => {
      meta.remove();
      document.title = title;
    };
  }, []);
}

/** Only same-area paths are allowed after sign-in — no open redirects */
const safeNext = (next: string | null) => (next && /^\/admin(\/|$)/.test(next) && !next.startsWith('//') ? next : '/admin/centers');

export function AdminLayout() {
  useAdminDocument();
  if (!supabase) return <AdminOff />;
  return (
    <AdminSessionProvider>
      <AdminFrame />
    </AdminSessionProvider>
  );
}

function AdminFrame() {
  const { status, email, signOut } = useAdminSession();
  const { pathname, search } = useLocation();
  const [params] = useSearchParams();
  const onLogin = pathname === '/admin/login';

  if (status === 'loading') return <div className="route-loading" aria-busy="true" />;
  if (status === 'signed-out' && !onLogin) return <Navigate to={`/admin/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  if (status !== 'signed-out' && onLogin) return <Navigate to={safeNext(params.get('next'))} replace />;

  return (
    <div className={s.shell}>
      {status !== 'signed-out' && (
        <header className={s.bar}>
          <div className={cn('container', s.barInner)}>
            <Logo size={24} to="/admin/centers" />
            {status === 'admin' && (
              <nav className={s.nav} aria-label="Разделы админки">
                <NavLink to="/admin/centers" className={({ isActive }) => cn(s.navLink, isActive && s.navActive)}>
                  Центры
                </NavLink>
                <NavLink to="/admin/submissions" className={({ isActive }) => cn(s.navLink, isActive && s.navActive)}>
                  Новые центры
                  <WaitingBadge key={pathname} table="submissions" status="pending" />
                </NavLink>
                <NavLink to="/admin/leads" className={({ isActive }) => cn(s.navLink, isActive && s.navActive)}>
                  Заявки на курсы
                  <WaitingBadge key={pathname} table="leads" status="new" />
                </NavLink>
              </nav>
            )}
            <div className={s.barEnd}>
              <a className={s.barLink} href="/" target="_blank" rel="noopener noreferrer">
                На сайт
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <span className={s.who}>{email}</span>
              <Button variant="ghost" size="sm" leading={<LogOut size={16} />} onClick={signOut}>
                Выйти
              </Button>
            </div>
          </div>
        </header>
      )}
      <main className={cn('container', s.main)} id="main">
        {status === 'forbidden' ? <Forbidden email={email} onSignOut={signOut} /> : <Outlet />}
      </main>
      <Toaster />
    </div>
  );
}

/** Rows waiting for the admin; refreshed on every navigation */
function WaitingBadge({ table, status }: { table: 'submissions' | 'leads'; status: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    supabase!
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
      .then(({ count: n }) => alive && setCount(n ?? 0));
    return () => {
      alive = false;
    };
  }, [table, status]);
  if (!count) return null;
  return (
    <span className={s.badge} aria-label={`новых: ${count}`}>
      {count}
    </span>
  );
}

function Forbidden({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  return (
    <section className={s.notice}>
      <h1 className={s.pageTitle}>Нет доступа</h1>
      <p>
        Аккаунт <b>{email}</b> вошёл, но не указан как администратор. Добавьте его в таблицу <code>public.admins</code> — запрос есть в конце{' '}
        <code>supabase/schema.sql</code>.
      </p>
      <Button variant="secondary" onClick={onSignOut}>
        Войти другим аккаунтом
      </Button>
    </section>
  );
}

function AdminOff() {
  return (
    <div className={s.shell}>
      <main className={cn('container', s.main)} id="main">
        <section className={s.notice}>
          <Logo size={26} />
          <h1 className={s.pageTitle}>Админка выключена</h1>
          <p>
            Сайт работает на встроенном снимке данных. Чтобы редактировать каталог, создайте проект Supabase, выполните{' '}
            <code>supabase/schema.sql</code> и заполните <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_ANON_KEY</code> в{' '}
            <code>.env.local</code> — подробности в README.
          </p>
        </section>
      </main>
    </div>
  );
}
