import { NavLink } from 'react-router';
import { useHop } from '@/hooks/useHop';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { useCompare } from '@/state/compare';
import { useFavorites } from '@/state/favorites';
import { LIST_ITEMS, NAV_ITEMS, useNavTarget } from './navItems';
import s from './MobileNav.module.css';

/** Count on a tab: always mounted, so the first item (0 → 1) hops in too */
function Badge({ n }: { n: number }) {
  const hops = useHop(n);
  if (n === 0) return null;
  return (
    <span key={hops} className={cn(s.badge, hops > 0 && s.hop)}>
      {n}
    </span>
  );
}

/** Thumb-zone tab bar for phones & tablets. */
export function MobileNav() {
  const target = useNavTarget();
  const favorites = useFavorites();
  const compare = useCompare();
  const counts: Record<string, number> = { '/favorites': favorites.ids.length, '/compare': compare.ids.length };

  return (
    <nav className={s.nav} aria-label={t.nav.main}>
      <ul className={s.list}>
        {[...NAV_ITEMS, ...LIST_ITEMS].map(({ to, label, icon: Icon }) => {
          const n = counts[to] ?? 0;
          return (
            <li key={to}>
              <NavLink to={target(to)} end={to === '/'} className={s.item} aria-label={n ? `${label}: ${n}` : undefined}>
                <span className={s.iconWrap} aria-hidden="true">
                  <Icon size={21} strokeWidth={1.9} />
                  <Badge n={n} />
                </span>
                <span className={s.label}>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
