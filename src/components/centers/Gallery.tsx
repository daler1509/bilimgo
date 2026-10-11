import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize2, Pause, Play, X } from 'lucide-react';
import type { CenterPhoto } from '@/data/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useInView } from '@/hooks/useInView';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { usePresence } from '@/hooks/usePresence';
import { useScrollLock } from '@/hooks/useScrollLock';
import { fill, t } from '@/i18n';
import { cn } from '@/lib/cn';
import s from './Gallery.module.css';

interface Props {
  photos: CenterPhoto[];
  name: string;
}

/**
 * Photos of a centre as a slideshow that turns by itself: slides cross-fade
 * with a slow camera drift, the bar above shows the timer. It pauses on
 * hover, focus, touch, off screen, while the lightbox is open and by the
 * button (WCAG 2.2.2). Swipe, arrows and the keyboard move it by hand; a tap
 * opens the lightbox. Every photo shows its owner and source.
 */
export function Gallery({ photos, name }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [rootRef, visible] = useInView<HTMLDivElement>({ threshold: 0.3, once: false });
  const still = useReducedMotion();
  const many = photos.length > 1;
  const autoplay = many && playing && !still;
  const paused = !autoplay || hovered || focused || !visible || open !== null;

  const go = useCallback((i: number) => setActive((i + photos.length) % photos.length), [photos.length]);

  // swipe: horizontal drags move, short taps open the lightbox
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(active + (dx < 0 ? 1 : -1));
    else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) setOpen(active);
  };

  const photo = photos[active]!;

  return (
    <div
      ref={rootRef}
      className={s.root}
      role="region"
      aria-roledescription={t.gallery.role}
      aria-label={fill(t.gallery.label, { name })}
      data-paused={paused || undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(active + 1);
        if (e.key === 'ArrowLeft') go(active - 1);
      }}
    >
      <div className={s.stage} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (drag.current = null)}>
        {photos.map((p, i) => (
          <img
            key={p.src}
            className={s.slide}
            data-active={i === active || undefined}
            src={p.src}
            width={p.width}
            height={p.height}
            alt={i === active ? p.alt : ''}
            aria-hidden={i !== active || undefined}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
          />
        ))}
      </div>

      {many && (
        <div className={s.bars} aria-hidden="true">
          {photos.map((p, i) => (
            <span key={p.src} className={s.bar} data-done={i < active || undefined}>
              {i === active && (autoplay ? <span key={active} className={s.barFill} onAnimationEnd={() => go(active + 1)} /> : <span className={s.barFull} />)}
            </span>
          ))}
        </div>
      )}

      <div className={s.overlay}>
        <a className={s.credit} href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">
          © {photo.credit}
        </a>
        <div className={s.controls}>
          <button type="button" className={s.control} onClick={() => setOpen(active)} aria-label={fill(t.gallery.open, { i: active + 1, n: photos.length })}>
            <Maximize2 size={16} aria-hidden="true" />
          </button>
          {many && (
            <>
              <button type="button" className={s.control} onClick={() => go(active - 1)} aria-label={t.gallery.prev}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button type="button" className={s.control} onClick={() => go(active + 1)} aria-label={t.gallery.next}>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              {!still && (
                <button
                  type="button"
                  className={s.control}
                  onClick={() => setPlaying((v) => !v)}
                  aria-label={playing ? t.gallery.pause : t.gallery.play}
                  aria-pressed={!playing}
                >
                  {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live={autoplay && !paused ? 'off' : 'polite'}>
        {fill(t.gallery.status, { i: active + 1, n: photos.length, alt: photo.alt })}
      </p>

      <Lightbox photos={photos} name={name} index={open} onIndex={(i) => {
        setOpen(i);
        if (i !== null) setActive(i);
      }} />
    </div>
  );
}

/** Where the photo was published, in words */
function licenseLabel(license: CenterPhoto['license']) {
  if (license === 'official-site') return t.gallery.officialSite;
  if (license === 'official-telegram') return t.gallery.officialTelegram;
  return license;
}

function Lightbox({ photos, name, index, onIndex }: { photos: CenterPhoto[]; name: string; index: number | null; onIndex: (i: number | null) => void }) {
  const [mounted, state] = usePresence(index !== null, 260);
  const panelRef = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  if (index !== null) last.current = index;
  const i = index ?? last.current;
  const photo = photos[i]!;

  useScrollLock(mounted);
  useFocusTrap(panelRef, mounted && state === 'open');

  const go = useCallback((d: number) => onIndex((i + d + photos.length) % photos.length), [i, onIndex, photos.length]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, go]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={s.lightbox}
      data-state={state}
      role="dialog"
      aria-modal="true"
      aria-label={fill(t.gallery.lightbox, { name, i: i + 1, n: photos.length })}
      onKeyDown={(e) => e.key === 'Escape' && onIndex(null)}
      onClick={(e) => e.target === e.currentTarget && onIndex(null)}
    >
      <button type="button" className={cn(s.lbButton, s.close)} onClick={() => onIndex(null)} aria-label={t.common.close}>
        <X size={20} />
      </button>
      {photos.length > 1 && (
        <>
          <button type="button" className={cn(s.lbButton, s.prev)} onClick={() => go(-1)} aria-label={t.gallery.prev}>
            <ChevronLeft size={22} />
          </button>
          <button type="button" className={cn(s.lbButton, s.next)} onClick={() => go(1)} aria-label={t.gallery.next}>
            <ChevronRight size={22} />
          </button>
        </>
      )}
      <figure className={s.figure}>
        <img key={photo.src} className={s.full} src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} />
        <figcaption className={s.caption}>
          <span>
            {i + 1} / {photos.length}
          </span>
          <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">
            © {photo.credit}, {licenseLabel(photo.license)}
          </a>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
