import { useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { usePresence } from '@/hooks/usePresence';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useEvent } from '@/hooks/useEvent';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';
import s from './Dialog.module.css';

export type DialogVariant = 'auto' | 'modal' | 'sheet' | 'side';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** auto = modal on ≥768px, bottom sheet on phones */
  variant?: DialogVariant;
  /** Desktop width of modal / side panel */
  width?: number;
  /** Mobile sheet takes full available height */
  fullHeight?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
}

/**
 * Accessible dialog surface: focus trap, Esc/overlay close, scroll lock,
 * enter/exit transitions. Becomes a drag-to-dismiss bottom sheet on phones.
 */
export function Dialog({ open, onClose, title, description, children, footer, variant = 'auto', width, fullHeight, initialFocus }: Props) {
  const isMobile = useIsMobile();
  const [mounted, state] = usePresence(open, 320);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const resolved: Exclude<DialogVariant, 'auto'> = variant === 'auto' ? (isMobile ? 'sheet' : 'modal') : variant === 'side' && isMobile ? 'sheet' : variant;

  useScrollLock(mounted);
  useFocusTrap(panelRef, mounted && state === 'open', initialFocus);

  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ y: number; t: number } | null>(null);
  const close = useEvent(onClose);

  const onDragStart = (e: ReactPointerEvent) => {
    if (resolved !== 'sheet' || (e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setDragY(Math.max(0, e.clientY - drag.current.y));
  };
  const onDragEnd = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.y;
    const v = dy / Math.max(1, performance.now() - drag.current.t);
    drag.current = null;
    setDragY(0);
    if (dy > 120 || v > 0.6) close();
  };

  if (!mounted) return null;

  const dragHandlers = { onPointerDown: onDragStart, onPointerMove: onDragMove, onPointerUp: onDragEnd, onPointerCancel: onDragEnd };

  return createPortal(
    <>
      <div className={s.overlay} data-state={state} onClick={close} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-state={state}
        className={cn(s.panel, s[resolved], resolved === 'sheet' && fullHeight && s.full, dragY > 0 && s.dragging)}
        style={{ '--dialog-width': width ? `${width}px` : undefined, '--drag-y': `${dragY}px` } as CSSProperties}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
        }}
      >
        {resolved === 'sheet' && <div className={s.handle} {...dragHandlers} aria-hidden="true" />}
        <div className={s.header} {...(resolved === 'sheet' ? dragHandlers : {})}>
          <div className={s.titles}>
            <h2 id={titleId} className={s.title}>
              {title}
            </h2>
            {description && (
              <p id={descId} className={s.description}>
                {description}
              </p>
            )}
          </div>
          <IconButton label={t.common.close} onClick={close} round>
            <X size={20} />
          </IconButton>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.footer}>{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
