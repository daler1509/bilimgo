import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Toaster } from '@/components/ui/Toaster';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import s from './AppShell.module.css';

export function AppShell() {
  const { pathname } = useLocation();
  const isDesktop = useIsDesktop();
  // screens that take over the viewport instead of scrolling as a page;
  // on phones search is a plain scrolling list, so the way back keeps its position
  const isAppScreen = pathname === '/map' || (pathname === '/search' && isDesktop);

  return (
    <div className={cn(s.shell, isAppScreen && s.shellApp)}>
      <a className="skip-link" href="#main">
        {t.nav.skip}
      </a>
      <Header variant={isAppScreen ? 'app' : 'page'} />
      <main id="main" className={s.main}>
        {/* keyed by route: the new page fades in, state inside a page is kept */}
        <div key={pathname} className={cn(s.page, 'page-enter')}>
          <Outlet />
        </div>
      </main>
      <MobileNav />
      <Toaster />
      <ScrollRestoration />
    </div>
  );
}
