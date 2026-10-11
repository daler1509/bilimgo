import { useSyncExternalStore } from 'react';

export const BREAKPOINTS = { sm: 480, md: 768, lg: 1024, xl: 1280, xxl: 1536 } as const;

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Split-view search / map layout starts at lg */
export const useIsDesktop = () => useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
export const useIsMobile = () => useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const useCoarsePointer = () => useMediaQuery('(pointer: coarse)');
