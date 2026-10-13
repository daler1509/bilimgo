import { useInView } from './useInView';
import { useReducedMotion } from './useMediaQuery';

/**
 * Scroll-in entrance for a block of a page: it arrives once, the first time
 * the visitor scrolls it into view. Spread the result on the element; the
 * styles live in base.css ([data-reveal]).
 */
export function useReveal<T extends Element>() {
  const [ref, inView] = useInView<T>({ threshold: 0.1, once: true });
  const reduced = useReducedMotion();
  return { ref, 'data-reveal': '', 'data-shown': inView || reduced ? '' : undefined } as const;
}
