import { NavLink } from 'react-router';
import { t } from '@/i18n';
import { useCompare } from '@/state/compare';
import { useFavorites } from '@/state/favorites';
import { LIST_ITEMS, NAV_ITEMS, useNavTarget } from './navItems';
import s from './MobileNav.module.css';

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
                  {n > 0 && <span className={s.badge}>{n}</span>}
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
