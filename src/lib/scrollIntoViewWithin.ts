/**
 * Scrolls an element into view inside its own scroll container only.
 * Native scrollIntoView() also scrolls `overflow: hidden` ancestors, which
 * would shift full-screen app layouts (the map + sheet screen).
 */
function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

export function scrollIntoViewWithin(el: HTMLElement, padding = 12) {
  const scroller = scrollParent(el);
  if (!scroller) return;
  const a = el.getBoundingClientRect();
  const b = scroller.getBoundingClientRect();
  if (a.top >= b.top + padding && a.bottom <= b.bottom - padding) return;
  const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  scroller.scrollTo({ top: scroller.scrollTop + (a.top - b.top) - padding, behavior });
}
