import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useDismiss } from '@/hooks/useDismiss';
import { useEvent } from '@/hooks/useEvent';
import { usePresence } from '@/hooks/usePresence';
import { cn } from '@/lib/cn';
import s from './Popover.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: 'start' | 'end';
  /** Match the anchor width (search segments) */
  matchWidth?: boolean;
  offset?: number;
  label: string;
  className?: string;
  minWidth?: number;
}

/** Anchored floating panel (desktop). Portaled, repositions on scroll/resize. */
export function Popover({ open, onClose, anchorRef, children, align = 'start', matchWidth, offset = 8, label, className, minWidth }: Props) {
  const [mounted, state] = usePresence(open, 200);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; width?: number }>({ top: -9999, left: -9999 });
  const close = useEvent(onClose);

  useDismiss([ref, anchorRef], close, mounted);

  useLayoutEffect(() => {
    if (!mounted) return;
    const update = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const top = a.bottom + offset;
      if (align === 'end') setPos({ top, right: Math.max(12, window.innerWidth - a.right), width: matchWidth ? a.width : undefined });
      else {
        const w = ref.current?.offsetWidth ?? 280;
        const left = Math.min(Math.max(12, a.left), window.innerWidth - w - 12);
        setPos({ top, left, width: matchWidth ? a.width : undefined });
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [mounted, anchorRef, align, matchWidth, offset]);

  if (!mounted) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-state={state}
      className={cn(s.popover, align === 'end' && s.alignEnd, className)}
      style={{ top: pos.top, left: pos.left, right: pos.right, width: pos.width, minWidth }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
          anchorRef.current?.focus();
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
