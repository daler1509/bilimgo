import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { useCompare } from '@/state/compare';
import { useFavorites } from '@/state/favorites';
import { LIST_ITEMS, NAV_ITEMS, useNavTarget } from './navItems';
import { LanguageMenu, ThemeToggle } from './Settings';
import s from './Header.module.css';

/** Compact top navigation. On app screens (Search, Map) it spans full width. */
export function Header({ variant = 'page' }: { variant?: 'page' | 'app' }) {
  const [scrolled, setScrolled] = useState(false);
  const favorites = useFavorites();
  const compare = useCompare();
  const target = useNavTarget();
  const counts: Record<string, number> = { '/favorites': favorites.ids.length, '/compare': compare.ids.length };

  useEffect(() => {
    if (variant === 'app') return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  return (
    <header className={cn(s.header, scrolled && s.scrolled, variant === 'app' && s.app)}>
      <div className={cn('container', s.inner)}>
        <Logo size={30} />
        <nav className={cn(s.nav, s.desktopOnly)} aria-label={t.nav.main}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={target(item.to)} end={item.to === '/'} className={s.link}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={s.spacer} />
        <nav className={cn(s.lists, s.desktopOnly)} aria-label={t.nav.lists}>
          {LIST_ITEMS.map(({ to, label, icon: Icon }) => {
            const n = counts[to] ?? 0;
            return (
              <NavLink key={to} to={to} className={s.listLink} aria-label={n ? `${label}: ${n}` : label}>
                <Icon size={17} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
                {n > 0 && (
                  <span className={s.count} aria-hidden="true">
                    {n}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className={s.settings}>
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
