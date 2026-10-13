import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play } from 'lucide-react';
import { FadeImg } from '@/components/ui/FadeImg';
import type { Teacher } from '@/data/types';
import { useInView } from '@/hooks/useInView';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import s from './Teachers.module.css';

/** How fast the belt of portraits runs, px per second */
const BELT_SPEED = 46;

/** A bust in an arched window: stands in for a portrait that isn't published */
function Bust() {
  return (
    <svg className={s.bust} viewBox="0 0 120 150" aria-hidden="true">
      <circle cx="60" cy="60" r="22" />
      <path d="M12 150c0-31 21-50 48-50s48 19 48 50z" />
    </svg>
  );
}

function Portrait({ photo, name }: { photo: Teacher['photo']; name: string }) {
  return (
    <span className={s.frame}>
      {photo ? <FadeImg className={s.photo} src={photo.src} width={photo.width} height={photo.height} alt={name} loading="lazy" decoding="async" /> : <Bust />}
    </span>
  );
}

/**
 * The teaching staff as arched portraits — the window shape of Samarkand's
 * madrasas — set on alternating heights, like an arcade. When the row is wider
 * than its window it runs to the left as one endless belt; without published
 * teachers the section says so and shows the empty frames, so nothing is made up.
 */
export function Teachers({ teachers }: { teachers: Teacher[] | undefined }) {
  if (!teachers?.length) {
    return (
      <div className={s.empty}>
        <span className={s.ghosts} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={s.ghost}>
              <Bust />
            </span>
          ))}
        </span>
        <p className={s.emptyText}>{t.center.teachersEmpty}</p>
      </div>
    );
  }
  return <TeacherRow teachers={teachers} />;
}

function TeacherRow({ teachers }: { teachers: Teacher[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const set = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();
  const [rootRef, visible] = useInView<HTMLDivElement>({ threshold: 0.2, once: false });
  const [shown, setShown] = useState(false);
  const [loop, setLoop] = useState(false);
  const [duration, setDuration] = useState(40);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [held, setHeld] = useState(false);
  const [focused, setFocused] = useState(false);

  // the portraits slide in from the right the first time the row is seen
  useEffect(() => {
    if (visible) setShown(true);
  }, [visible]);

  // the belt only runs when one set of portraits is wider than the window;
  // a shorter row stands still, and with reduced motion it is a plain swipeable row
  const measure = useCallback(() => {
    const box = viewport.current;
    const one = set.current;
    if (!box || !one) return;
    const width = one.scrollWidth;
    setLoop(!reduced && width > box.clientWidth + 8);
    setDuration(Math.max(14, width / BELT_SPEED));
  }, [reduced]);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (viewport.current) ro.observe(viewport.current);
    return () => ro.disconnect();
  }, [measure, teachers.length]);

  const paused = userPaused || hovered || held || focused || !visible;

  // the owner of every portrait is named once, below the row
  const credits = new Map<string, string>();
  for (const x of teachers) if (x.photo) credits.set(x.photo.credit, x.photo.sourceUrl);

  const items = () =>
    teachers.map((x, i) => (
      <li key={`${i}-${x.name}`} className={s.item} style={{ '--i': i } as CSSProperties}>
        <figure className={s.card}>
          <Portrait photo={x.photo} name={x.name} />
          <figcaption className={s.caption}>
            <span className={s.name}>{x.name}</span>
            {x.role && <span className={s.role}>{x.role}</span>}
            {x.note && <span className={s.note}>{x.note}</span>}
          </figcaption>
        </figure>
      </li>
    ));

  return (
    <div
      ref={rootRef}
      className={s.root}
      style={{ '--belt': `${duration}s`, '--n': teachers.length } as CSSProperties}
      data-shown={shown || reduced || undefined}
      data-loop={loop || undefined}
      data-paused={paused || undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
      // a finger held on the belt stops it
      onPointerDown={(e) => e.pointerType !== 'mouse' && setHeld(true)}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <div ref={viewport} className={s.viewport}>
        <div className={s.belt}>
          <ul ref={set} className={s.list} aria-label={t.center.teachers}>
            {items()}
          </ul>
          {loop && (
            <ul className={s.list} aria-hidden="true">
              {items()}
            </ul>
          )}
        </div>
      </div>

      {loop && (
        <button
          type="button"
          className={s.pause}
          onClick={() => setUserPaused((p) => !p)}
          aria-label={userPaused ? t.carousel.play : t.carousel.pause}
          aria-pressed={userPaused}
        >
          {userPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
        </button>
      )}

      {credits.size > 0 && (
        <p className={cn(s.credit)}>
          {t.center.teachersPhoto}:{' '}
          {[...credits].map(([credit, url], i) => (
            <span key={credit}>
              {i > 0 && ', '}
              <a href={url} target="_blank" rel="noopener noreferrer">
                {credit}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
