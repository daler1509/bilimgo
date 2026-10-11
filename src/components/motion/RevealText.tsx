import { Children, isValidElement, type ElementType, type ReactNode } from 'react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/cn';
import s from './motion.module.css';

interface Props {
  as?: ElementType;
  id?: string;
  className?: string;
  /** Text, or text mixed with inline elements (each element moves as one word) */
  children: ReactNode;
  /** Hold the entrance until the content is final */
  play?: boolean;
  /** Offset for the first word, ms */
  delay?: number;
}

/**
 * Headline that rises into place word by word from under a mask the first
 * time it is on screen. The words stay real text: selection, wrapping and
 * screen readers work as with a plain heading.
 */
export function RevealText({ as: Tag = 'span', id, className, children, play = true, delay = 0 }: Props) {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.4 });

  const words: ReactNode[] = [];
  for (const part of Children.toArray(children)) {
    if (typeof part === 'string' || typeof part === 'number') words.push(...String(part).split(/\s+/).filter(Boolean));
    else if (isValidElement(part)) words.push(part);
  }

  return (
    <Tag ref={ref} id={id} className={cn(s.reveal, className)} data-shown={(play && inView) || undefined}>
      {words.map((word, i) => (
        <span key={i}>
          <span className={s.word}>
            <span className={s.wordInner} style={{ transitionDelay: `${delay + i * 55}ms` }}>
              {word}
            </span>
          </span>
          {i < words.length - 1 && ' '}
        </span>
      ))}
    </Tag>
  );
}
