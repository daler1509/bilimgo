import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CenterPreviewCard } from '@/components/centers/CenterPreviewCard';
import type { Center } from '@/data/types';
import { usePresence } from '@/hooks/usePresence';
import { cn } from '@/lib/cn';
import s from './map.module.css';

/**
 * Phones: the picked place rises from the bottom edge and goes back down when
 * closed or swiped away. Picking another marker keeps the sheet and swaps
 * what is on it.
 */
export function PreviewSheet({ center, onClose }: { center: Center | null; onClose: () => void }) {
  const [mounted, state] = usePresence(!!center, 280);
  const last = useRef(center);
  if (center) last.current = center;
  const shown = center ?? last.current;

  // the first place rides up with the sheet; places picked after it slide in on their own
  const session = useRef<{ id: string | null; swapped: boolean }>({ id: null, swapped: false });
  if (!mounted) session.current = { id: null, swapped: false };
  else if (shown && session.current.id !== shown.id) session.current = { id: shown.id, swapped: session.current.id !== null };

  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ y: number; t: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // buttons and links keep their taps; the rest of the card is a handle
    if ((e.target as HTMLElement).closest('a, button')) return;
    drag.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (drag.current) setDragY(Math.max(0, e.clientY - drag.current.y));
  };
  const onPointerEnd = (e: ReactPointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dy = Math.max(0, e.clientY - start.y);
    const speed = dy / Math.max(1, performance.now() - start.t);
    setDragY(0);
    if (dy > 90 || speed > 0.6) onClose();
  };

  if (!mounted || !shown) return null;

  return (
    <div
      className={s.sheet}
      data-state={state}
      data-dragging={dragY > 0 || undefined}
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <span className={s.sheetGrip} aria-hidden="true" />
      <div key={shown.id} className={cn(session.current.swapped && s.sheetSwap)}>
        <CenterPreviewCard center={shown} detailsHref={`/centers/${shown.id}`} onClose={onClose} />
      </div>
    </div>
  );
}
