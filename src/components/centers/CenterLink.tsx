import { forwardRef } from 'react';
import { Link, useLocation, type LinkProps } from 'react-router';
import { t } from '@/i18n';

/** What a profile needs to send the visitor back where they came from */
export interface FromState {
  from?: string;
}

/** The current page as the place a profile should lead back to */
export function useFromHere(): FromState {
  const { pathname, search } = useLocation();
  return { from: pathname + search };
}

/**
 * Link to a centre's page that remembers the page it was followed from
 * (map, results, saved…). The profile turns that into «К карте» etc.
 */
export const CenterLink = forwardRef<HTMLAnchorElement, Omit<LinkProps, 'to' | 'state'> & { id: string }>(function CenterLink({ id, ...rest }, ref) {
  const state = useFromHere();
  return <Link ref={ref} to={`/centers/${id}`} state={state} {...rest} />;
});

/** Where the profile's back button leads and what it says; opened directly, it leads to the catalogue */
export function backTarget(from: string | undefined): { to: string; label: string } {
  const path = from?.split(/[?#]/)[0];
  if (!from || !path) return { to: '/search', label: t.back.catalog };
  if (path === '/') return { to: from, label: t.back.home };
  if (path === '/search') return { to: from, label: t.back.search };
  if (path === '/map') return { to: from, label: t.back.map };
  if (path === '/favorites') return { to: from, label: t.back.favorites };
  if (path === '/compare') return { to: from, label: t.back.compare };
  return { to: from, label: t.back.center };
}
