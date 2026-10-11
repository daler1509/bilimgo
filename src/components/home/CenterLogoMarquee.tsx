import { useMemo, useRef, useState } from 'react';
import { CenterLink } from '@/components/centers/CenterLink';
import { CenterLogo } from '@/components/centers/CenterLogo';
import type { Center } from '@/data/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import { useMarquee } from './useMarquee';
import s from './CenterLogoMarquee.module.css';

interface Props {
  /** Comes from the data layer — the component never owns a list of names */
  centers: Center[];
  /** Short line above the strip */
  label: string;
  /** Two opposite rows need enough distinct centres to avoid repetition */
  rows?: 1 | 2;
  /** px per second */
  speed?: number;
}

interface RowProps {
  centers: Center[];
  direction: 1 | -1;
  speed: number;
  hoverPause: boolean;
  /** Still line without the duplicate group */
  still?: boolean;
}

/** Below this, a looping line would visibly repeat the same names */
const MIN_FOR_LOOP = 6;

/** One endlessly scrolling line: the same group twice, offset by its width. */
function MarqueeRow({ centers, direction, speed, hoverPause, still = false }: RowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);

  useMarquee({ trackRef, groupRef, direction, speed, paused: hoverPause && paused, enabled: !still && centers.length > 0 });

  const group = (duplicate: boolean) => (
    <ul
      className={cn(s.group, duplicate && s.duplicate)}
      ref={duplicate ? undefined : groupRef}
      aria-hidden={duplicate || undefined}
    >
      {centers.map((c) => (
        <li key={c.id} className={s.item}>
          <CenterLink id={c.id} className={s.logo} tabIndex={duplicate ? -1 : undefined} draggable={false}>
            <CenterLogo center={c} size={36} className={s.mark} eager />
            <span className={s.name}>{c.brand ?? c.name}</span>
          </CenterLink>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cn(s.viewport, still && s.static)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setPaused(false)}
      onFocusCapture={() => hoverPause && setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className={s.track} ref={trackRef}>
        {group(false)}
        {!still && group(true)}
      </div>
    </div>
  );
}

/**
 * Continuous strip of the centres in the catalogue, one per brand, in two
 * rows moving in opposite directions — on phones too. Every mark sits in the
 * same frame and is shown in monochrome; a centre without an official logo
 * gets a typographic monogram in that frame.
 */
export function CenterLogoMarquee({ centers: all, label, rows = 2, speed = 30 }: Props) {
  // pausing on hover only makes sense with a real pointer
  const hoverPause = useMediaQuery('(hover: hover) and (pointer: fine)');
  const centers = useMemo(() => {
    const seen = new Set<string>();
    return all.filter((c) => {
      const key = c.brand ?? c.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [all]);

  // two rows only when each line can be filled without repeating a centre;
  // while data is loading the rows render empty but keep their height
  const loading = centers.length === 0;
  const twoRows = rows === 2 && (loading || centers.length >= MIN_FOR_LOOP * 2);
  const lines = loading
    ? [[], []].slice(0, rows)
    : twoRows
      ? [centers.filter((_, i) => i % 2 === 0), centers.filter((_, i) => i % 2 === 1)]
      : [centers];
  const still = !loading && centers.length < MIN_FOR_LOOP;

  return (
    <div className={s.strip}>
      <div className="container">
        <p className={s.label}>{label}</p>
      </div>

      <div className={s.rows} aria-busy={loading || undefined}>
        {lines.map((line, i) => (
          <MarqueeRow
            key={i}
            centers={line}
            direction={i % 2 === 0 ? 1 : -1}
            speed={speed}
            hoverPause={hoverPause}
            still={still}
          />
        ))}
      </div>
    </div>
  );
}
