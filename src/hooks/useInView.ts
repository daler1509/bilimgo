import { useEffect, useState } from 'react';

/**
 * Whether an element is on screen. Returns a callback ref, so observation
 * starts whenever the element actually mounts (also after a placeholder).
 * `once` keeps it true after the first sighting — for entrances that should
 * not replay on every scroll.
 */
export function useInView<T extends Element>({ threshold = 0.35, once = true }: { threshold?: number; once?: boolean } = {}) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') return setInView(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = !!entry?.isIntersecting;
        setInView((was) => (once && was) || visible);
        if (visible && once) io.disconnect();
      },
      { threshold },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, threshold, once]);

  return [setNode, inView] as const;
}
