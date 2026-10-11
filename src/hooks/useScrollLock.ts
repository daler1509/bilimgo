import { useEffect } from 'react';

let locks = 0;

/** Locks page scroll while a modal surface is open (iOS-safe). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    const { body, documentElement } = document;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    if (locks === 1) {
      body.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    return () => {
      locks -= 1;
      if (locks === 0) {
        body.style.overflow = '';
        body.style.paddingRight = '';
      }
    };
  }, [active]);
}
