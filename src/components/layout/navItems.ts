import { useCallback } from 'react';
import { useLocation } from 'react-router';
import { Columns3, Compass, Heart, Home, Map as MapIcon, type LucideIcon } from 'lucide-react';
import { t } from '@/i18n';

export type NavPath = '/' | '/search' | '/map' | '/favorites' | '/compare';

export interface NavItem {
  to: NavPath;
  label: string;
  icon: LucideIcon;
}

const item = (to: NavPath, key: keyof typeof t.nav, icon: LucideIcon): NavItem => ({
  to,
  icon,
  get label() {
    return t.nav[key];
  },
});

/** Discovery — the main navigation */
export const NAV_ITEMS: NavItem[] = [item('/', 'home', Home), item('/search', 'search', Compass), item('/map', 'map', MapIcon)];

/** The user's own lists */
export const LIST_ITEMS: NavItem[] = [item('/favorites', 'saved', Heart), item('/compare', 'compare', Columns3)];

/**
 * Search ⇄ Map keep the same filters: switching views must not lose
 * what the user has chosen. Selection & camera are view-specific.
 */
export function useNavTarget() {
  const { pathname, search } = useLocation();
  return useCallback(
    (to: NavPath) => {
      const inApp = pathname === '/search' || pathname === '/map';
      if ((to !== '/search' && to !== '/map') || !inApp) return to;
      const p = new URLSearchParams(search);
      p.delete('sel');
      p.delete('v');
      const qs = p.toString();
      return qs ? `${to}?${qs}` : to;
    },
    [pathname, search],
  );
}
