import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useSearchParams } from 'react-router';
import {
  Building2,
  ExternalLink,
  FilePlus2,
  GraduationCap,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  PhoneIncoming,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/layout/Settings';
import { Button, IconButton } from '@/components/ui/Button';
import { Toaster } from '@/components/ui/Toaster';
import { cn } from '@/lib/cn';
import { CommandPalette } from './CommandPalette';
import { AdminDataProvider, useAdminData, type AdminCounts } from './data';
import { AdminSessionProvider, useAdminSession } from './session';
import { supabase } from './supabaseClient';
import { ConfirmProvider } from './ui';
import crm from './crm.module.css';
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
const safeNext = (next: string | null) => (next && /^\/admin(\/|$)/.test(next) && !next.startsWith('//') ? next : '/admin');

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: keyof AdminCounts;
}

const NAV: { title: string; items: NavItem[] }[] = [
  { title: 'Обзор', items: [{ to: '/admin', label: 'Дашборд', icon: LayoutDashboard, end: true }] },
  {
    title: 'Работа',
    items: [
      { to: '/admin/leads', label: 'Заявки на курсы', icon: PhoneIncoming, badge: 'newLeads' },
      { to: '/admin/submissions', label: 'Новые центры', icon: FilePlus2, badge: 'pendingSubmissions' },
    ],
  },
  {
    title: 'Каталог',
    items: [
      { to: '/admin/centers', label: 'Центры', icon: Building2 },
      { to: '/admin/teachers', label: 'Преподаватели', icon: GraduationCap },
      { to: '/admin/media', label: 'Медиатека', icon: Images },
    ],
  },
  { title: 'Система', items: [{ to: '/admin/settings', label: 'Настройки', icon: Settings }] },
];

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

  if (status === 'signed-out')
    return (
      <main id="main">
        <Outlet />
        <Toaster />
      </main>
    );

  if (status === 'forbidden')
    return (
      <div className={s.shell}>
        <main className={cn('container', s.main)} id="main">
          <Forbidden email={email} onSignOut={signOut} />
        </main>
        <Toaster />
      </div>
    );

  return (
    <AdminDataProvider>
      <ConfirmProvider>
        <Workspace email={email} onSignOut={signOut} />
      </ConfirmProvider>
    </AdminDataProvider>
  );
}

function Workspace({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  const { counts, refresh } = useAdminData();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);

  // a new screen: close the drawer, bring the counters up to date
  useEffect(() => {
    setMenu(false);
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const initials = (email ?? 'A').split('@')[0]!.slice(0, 2);
  const login = (email ?? '').replace(/@admin\.bilimgo\.local$/, '');

  return (
    <div className={crm.app}>
      <div className={crm.scrim} data-open={menu || undefined} onClick={() => setMenu(false)} aria-hidden="true" />
      <aside className={crm.sidebar} data-open={menu || undefined} aria-label="Меню админки">
        <div className={crm.brand}>
          <Logo size={26} to="/admin" />
          <span className={crm.brandTag}>Админка</span>
        </div>

        <nav className={crm.nav} aria-label="Разделы">
          {NAV.map((group) => (
            <div key={group.title} className={crm.navGroup}>
              <p className={crm.navTitle}>{group.title}</p>
              {group.items.map((item) => {
                const n = item.badge ? counts[item.badge] : 0;
                return (
                  <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(crm.navLink, isActive && crm.navActive)}>
                    <item.icon size={19} aria-hidden="true" />
                    <span className={crm.navLabel}>{item.label}</span>
                    {n > 0 && (
                      <span className={crm.navBadge} aria-label={`новых: ${n}`}>
                        {n}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={crm.sidebarFoot}>
          <a className={crm.navLink} href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={19} aria-hidden="true" />
            <span className={crm.navLabel}>Открыть сайт</span>
          </a>
          <div className={crm.account}>
            <span className={crm.avatar} aria-hidden="true">
              {initials}
            </span>
            <span className={crm.accountText}>
              <span className={crm.accountName}>{login}</span>
              <span className={crm.accountRole}>Администратор</span>
            </span>
            <IconButton label="Выйти" onClick={onSignOut} size="sm">
              <LogOut size={17} />
            </IconButton>
          </div>
        </div>
      </aside>

      <div className={crm.workspace}>
        <div className={crm.topbar}>
          <IconButton label="Меню" className={crm.menuButton} onClick={() => setMenu(true)}>
            <Menu size={20} />
          </IconButton>
          <button type="button" className={crm.searchTrigger} onClick={() => setPalette(true)}>
            <Search size={17} aria-hidden="true" />
            <span>Найти центр, заявку или раздел</span>
            <span className={crm.kbd}>⌘K</span>
          </button>
          <div className={crm.topbarEnd}>
            <ThemeToggle />
          </div>
        </div>
        <main className={crm.page} id="main">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <Toaster />
    </div>
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
