import { useEffect, useState } from 'react';
import { useInView } from '@/hooks/useInView';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import s from './motion.module.css';

/** Two turns of the wheel, so every digit travels before it lands */
const STRIP = Array.from({ length: 20 }, (_, i) => i % 10);

interface Props {
  value: number;
  className?: string;
  /** Hold the roll until the caller is ready */
  play?: boolean;
  /** Roll on mount instead of on sight — for numbers inside a masked headline, which read as off screen until it rises */
  immediate?: boolean;
  /** Before the first digit moves, ms */
  delay?: number;
}

/**
 * A number that rolls in digit by digit, like a counter board, the first
 * time it is on screen. Each digit sits in a window sized by the final digit,
 * so the settled number takes exactly the space of plain text. Screen
 * readers get the plain value.
 */
export function RollingNumber({ value, className, play = true, immediate = false, delay = 0 }: Props) {
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.6 });
  const [landed, setLanded] = useState(false);
  const still = useReducedMotion();
  const go = play && (immediate || inView);

  // paint the zeros first, then move — otherwise there is nothing to transition from
  useEffect(() => {
    if (!go) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setLanded(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [go]);

  const text = value.toLocaleString('ru-RU');
  let n = 0;

  return (
    <span ref={ref} className={cn(s.number, className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className={s.digits}>
        {[...text].map((ch, i) => {
          if (!/\d/.test(ch)) return <span key={i}>{ch}</span>;
          const digit = Number(ch);
          // digits land left to right, as on the reference counter board
          const order = n++;
          const stop = landed || still ? 10 + digit : 0;
          return (
            <span key={i} className={s.window}>
              <span className={s.ghost}>{ch}</span>
              <span
                className={s.strip}
                style={{ transform: `translateY(${-stop * 5}%)`, transitionDelay: `${delay + order * 110}ms` }}
              >
                {STRIP.map((d, k) => (
                  <span key={k}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
