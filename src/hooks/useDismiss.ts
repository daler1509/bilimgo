import { useEffect, type RefObject } from 'react';

/** Close on outside pointerdown and on Escape. */
export function useDismiss(
  refs: RefObject<HTMLElement | null>[],
  onDismiss: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onDismiss]);
}
