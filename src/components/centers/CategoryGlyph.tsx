import type { CSSProperties } from 'react';
import { CATEGORY_BY_ID } from '@/data/categories';
import type { CategoryId } from '@/data/types';
import { cn } from '@/lib/cn';
import { CATEGORY_ICON } from './categoryIcons';
import s from './CategoryGlyph.module.css';

/** A direction's mark: a monogram for languages, a line icon otherwise — one outlined style. */
export function CategoryGlyph({ id, size = 36, className, style }: { id: CategoryId; size?: number; className?: string; style?: CSSProperties }) {
  const { mono } = CATEGORY_BY_ID[id];
  const Icon = CATEGORY_ICON[id];
  return (
    <span className={cn(s.glyph, mono && s.mono, className)} style={{ '--glyph-size': `${size}px`, ...style } as CSSProperties} aria-hidden="true">
      {mono ?? <Icon size={Math.round(size * 0.46)} strokeWidth={1.8} />}
    </span>
  );
}
