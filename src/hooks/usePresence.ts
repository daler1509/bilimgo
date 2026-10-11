import { useEffect, useState } from 'react';

/**
 * Keeps an element mounted long enough to play its exit animation.
 * Returns [mounted, state] where state drives data-state="open|closed".
 */
export function usePresence(open: boolean, exitMs = 240): [boolean, 'open' | 'closed'] {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<'open' | 'closed'>(open ? 'open' : 'closed');

  useEffect(() => {
    if (open) {
      setMounted(true);
      // next frame → CSS transition from closed to open
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setState('open')));
      return () => cancelAnimationFrame(raf);
    }
    setState('closed');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => setMounted(false), reduced ? 0 : exitMs);
    return () => window.clearTimeout(id);
  }, [open, exitMs]);

  return [mounted, state];
}
